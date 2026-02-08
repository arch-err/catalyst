# Claude Integration

Catalyst integrates with Claude Code by invoking the `claude` CLI over SSH on the dev-VM. This page explains the command structure, stream protocol, interaction modes, and how sessions are managed.

## How Claude Code is Invoked

When a user sends a chat message or triggers a build, the backend constructs a `claude` CLI command and executes it over an SSH channel on the dev-VM. The command follows this structure:

```bash
claude -p <message> --output-format stream-json [--resume <session-id>] [--allowedTools <tools>] [--project-dir <dir>]
```

### Command Flags

| Flag | Description |
|------|-------------|
| `-p <message>` | The prompt message to send to Claude. The `p` flag runs Claude in non-interactive (pipe) mode. |
| `--output-format stream-json` | Tells Claude to output NDJSON (newline-delimited JSON) to stdout, one JSON object per line. |
| `--resume <session-id>` | Resumes an existing Claude session. Omitted for the first interaction with a new idea. |
| `--allowedTools <tools>` | Comma-separated list of tools Claude is allowed to use. Used in chat mode to restrict to read-only tools. |
| `--project-dir <dir>` | Sets Claude's working directory. Used in build mode to point at the idea's `project/` subdirectory. |

### Command Construction

The backend builds the command in `packages/backend/src/services/claude.ts`:

```typescript
function buildClaudeCommand(opts: {
  message: string;
  sessionId?: string;
  allowedTools?: string;
  projectDir?: string;
}): string {
  const parts = ['claude', '-p', escapeForShell(opts.message),
                  '--output-format', 'stream-json'];

  if (opts.sessionId) parts.push('--resume', opts.sessionId);
  if (opts.allowedTools) parts.push('--allowedTools', escapeForShell(opts.allowedTools));
  if (opts.projectDir) parts.push('--project-dir', opts.projectDir);

  return parts.join(' ');
}
```

Shell escaping uses `$'...'` quoting to safely handle special characters in messages.

## NDJSON Stream Protocol

Claude Code outputs one JSON object per line to stdout. Each line is a `ClaudeStreamMessage` with a `type` field that determines the message structure.

### Message Types

#### `system` (subtype: `init`)

Sent once at the start of a session. Contains the session ID, available tools, and model name.

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "sess_01J5XYZ...",
  "tools": ["Read", "Write", "Bash", "Grep", "Glob"],
  "model": "claude-sonnet-4-20250514"
}
```

When the backend receives this message, it persists the `session_id` to the idea's `meta.json` so future interactions can resume the session.

#### `assistant` (subtype: `text`)

A chunk of text from Claude's response. These arrive incrementally as Claude generates tokens.

```json
{
  "type": "assistant",
  "subtype": "text",
  "text": "Here's my analysis of "
}
```

The backend relays these as `claude:text` WebSocket messages. The frontend accumulates them in a stream buffer for live rendering.

#### `assistant` (subtype: `tool_use`)

Claude has decided to use a tool. Sent before the tool executes.

```json
{
  "type": "assistant",
  "subtype": "tool_use",
  "tool_use_id": "tu_01ABC...",
  "name": "Read",
  "input": {
    "file_path": "/home/user/project/src/index.ts"
  }
}
```

#### `tool_result`

The result of a tool execution.

```json
{
  "type": "tool_result",
  "subtype": "result",
  "tool_use_id": "tu_01ABC...",
  "content": "import express from 'express';\n..."
}
```

#### `result`

Sent once at the end of the interaction. Contains a summary, the session ID, cost, duration, and turn count.

Success:

```json
{
  "type": "result",
  "subtype": "success",
  "result": "I've analyzed the codebase and here are my findings...",
  "session_id": "sess_01J5XYZ...",
  "cost_usd": 0.042,
  "duration_ms": 15234,
  "turns": 3
}
```

Error:

```json
{
  "type": "result",
  "subtype": "error",
  "error": "Context window exceeded",
  "session_id": "sess_01J5XYZ...",
  "cost_usd": 0.012,
  "duration_ms": 5000,
  "turns": 1
}
```

### Stream Parsing

The backend parses the NDJSON stream using a buffered line parser. Because SSH delivers data in arbitrary chunks (not aligned to line boundaries), the parser maintains a buffer and splits on newlines:

```typescript
function parseNdjsonStream(callbacks: ClaudeCallbacks): (data: string) => void {
  let buffer = '';

  return (data: string) => {
    buffer += data;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';  // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg: ClaudeStreamMessage = JSON.parse(trimmed);
        // Dispatch based on msg.type...
      } catch {
        // Non-JSON line, skip
      }
    }
  };
}
```

## Chat Mode vs Build Mode

Catalyst enforces two distinct interaction modes, each with different tool permissions:

### Chat Mode

**Purpose:** Explore and refine the idea with Claude. Safe for brainstorming -- Claude cannot modify anything.

**Allowed tools:** `Read`, `Grep`, `Glob`

**Invoked by:** The `chat` WebSocket message type.

```bash
claude -p "What tech stack would work best for this?" \
  --output-format stream-json \
  --resume sess_01J5XYZ... \
  --allowedTools 'Read,Grep,Glob'
```

When chat mode starts, the idea status is updated from `captured` to `chatting` (only on the first chat interaction).

### Build Mode

**Purpose:** Claude creates the actual project with full access to all tools, including file writing, command execution, and more.

**Allowed tools:** All (no `--allowedTools` flag).

**Invoked by:** The `build` WebSocket message type.

```bash
claude -p "Build this project based on our discussion..." \
  --output-format stream-json \
  --resume sess_01J5XYZ... \
  --project-dir ~/catalyst/ideas/my-idea/project
```

Before invoking Claude, the backend creates the `project/` subdirectory under the idea folder. The idea status is updated to `building`.

## Session Persistence

Claude Code sessions are identified by a session ID (e.g., `sess_01J5XYZ...`). Catalyst persists this ID in the idea's `meta.json` after receiving the `system:init` message:

```typescript
onSystem: (sessionId, model) => {
  ideasService.update(ideaId, { sessionId }).catch(() => {});
  callbacks.onSystem(sessionId, model);
},
```

On subsequent interactions with the same idea, the stored `sessionId` is passed via `--resume`, allowing Claude to continue the conversation with full context of previous messages.

This means:

- You can close the browser, reopen it days later, and pick up exactly where you left off.
- Chat context carries into build mode -- Claude remembers the refinement discussion when building.
- Each idea has its own independent session.

## Timeout Handling

Long-running Claude processes are monitored for activity. The backend tracks the timestamp of the last output received from the SSH stream. A check runs every 30 seconds:

```typescript
const timeoutCheck = setInterval(() => {
  if (Date.now() - lastOutput > config.claudeTimeout) {
    clearInterval(timeoutCheck);
    this.cancel(ideaId);
    callbacks.onError('Claude process timed out (no output for 10 minutes)');
  }
}, 30000);
```

The default timeout is 10 minutes (`CLAUDE_TIMEOUT_MS=600000`). This is per-output, not per-session -- if Claude is actively producing output (even tool results), the timeout resets. It only triggers when Claude goes completely silent.

## Cancellation

Users can cancel an in-progress Claude session from the UI. The cancellation flow:

1. Frontend sends `{ type: "cancel", ideaId: "..." }` over WebSocket.
2. Backend looks up the active SSH channel for that idea.
3. Sends `SIGINT` to the channel (equivalent to Ctrl+C).
4. If the process is still alive after 5 seconds, sends `SIGKILL`.
5. The channel's `onClose` callback fires, cleaning up the tracking map.

```typescript
cancel(ideaId: string): void {
  const channel = activeChannels.get(ideaId);
  if (channel) {
    channel.signal('INT');
    setTimeout(() => {
      if (activeChannels.has(ideaId)) {
        channel.signal('KILL');
        activeChannels.delete(ideaId);
      }
    }, 5000);
  }
}
```
