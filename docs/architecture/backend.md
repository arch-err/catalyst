# Backend Architecture

The Catalyst backend is an Express 4 server written in TypeScript, running on Bun. It handles authentication, serves the REST API for ideas, manages SSH connections to the dev-VM, orchestrates Claude Code sessions, and runs the WebSocket server for real-time streaming.

## Entry Point

The server is defined in `packages/backend/src/index.ts`. At startup, it:

1. Creates an Express app with JSON body parsing and cookie parsing.
2. Registers the health endpoint (unauthenticated).
3. Mounts the auth router (`/api/login`, `/api/logout`, `/api/auth/check`).
4. Mounts the ideas router (`/api/ideas/*`) behind the `requireAuth` middleware.
5. In production, serves the frontend static files with SPA fallback.
6. Starts the HTTP server on the configured port (default `3001`).
7. Attaches the WebSocket server to the same HTTP server.
8. Registers a `SIGTERM` handler for graceful shutdown.

```typescript
const server = app.listen(config.port, () => {
  console.log(`Catalyst backend listening on :${config.port}`);
});

setupWebSocket(server);

process.on('SIGTERM', () => {
  sshService.closeAll();
  server.close(() => process.exit(0));
});
```

## SSH Service

**File:** `packages/backend/src/services/ssh.ts`

The SSH service manages a pool of persistent SSH connections to the dev-VM using the `ssh2` library. This avoids the overhead of establishing a new SSH handshake for every operation.

### Connection Pooling

The pool has a configurable maximum size (`MAX_SSH_CONNECTIONS`, default 3). When a connection is requested:

1. If an idle connection exists in the pool, it is marked as busy and returned.
2. If the pool is not full, a new connection is created, added to the pool, and returned.
3. If the pool is full and all connections are busy, the request waits (polling every 100ms) until one becomes available or a 10-second timeout is reached.

```typescript
async getConnection(): Promise<Client> {
  const idle = this.pool.find((c) => !c.busy);
  if (idle) {
    idle.busy = true;
    idle.lastUsed = Date.now();
    return idle.client;
  }
  if (this.pool.length < config.maxSshConnections) {
    const client = await this.connect();
    // ...
  }
  // Wait for one to free up...
}
```

Connections are configured with keepalive (`keepaliveInterval: 15000`, `keepaliveCountMax: 3`) to detect and remove dead connections. When a connection errors or closes, it is automatically removed from the pool.

### Two Execution Modes

The SSH service provides two methods for running commands:

- **`exec(command)`** -- Runs a command and returns the full stdout as a string. Used for filesystem operations (listing ideas, reading files, creating directories).
- **`execStream(command, callbacks)`** -- Runs a command and streams output via callbacks (`onData`, `onError`, `onClose`). Returns the SSH channel, allowing the caller to send signals. Used for Claude Code sessions.

## Ideas Service

**File:** `packages/backend/src/services/ideas.ts`

The ideas service performs CRUD operations on idea data stored on the dev-VM's filesystem. All file operations happen over SSH -- the backend does not have direct filesystem access to the dev-VM.

### Storage Format

Each idea is a directory under `IDEAS_BASE_PATH`:

```
~/catalyst/ideas/
  my-idea-slug/
    meta.json    # IdeaMeta as JSON
    idea.md      # Original idea content
    project/     # Created during build mode
```

### Operations

| Method | SSH Command | Description |
|--------|-----------|-------------|
| `list()` | `find $BASE -maxdepth 2 -name meta.json -exec cat {} \;` | Lists all ideas by reading every `meta.json` |
| `get(idOrSlug)` | `cat $DIR/meta.json` and `cat $DIR/idea.md` | Gets a single idea by slug, falls back to grep-by-ID |
| `create(title, content)` | `mkdir -p $DIR && echo ... > meta.json && echo ... > idea.md` | Creates a new idea directory with metadata and content |
| `update(idOrSlug, updates)` | `echo ... > $DIR/meta.json` | Patches metadata fields (title, status, sessionId) |
| `delete(idOrSlug)` | `rm -rf $DIR` | Removes the entire idea directory |

Slugs are generated from the title using the `slugify` library (lowercase, strict mode). IDs are UUIDv4.

### Lookup Strategy

When looking up an idea by `idOrSlug`, the service first tries to interpret the parameter as a slug (attempting to `cat` the `meta.json` at that path). If that fails, it falls back to searching all `meta.json` files for a matching `id` field using `grep -rl`.

## Claude Service

**File:** `packages/backend/src/services/claude.ts`

The Claude service orchestrates Claude Code sessions. It builds the CLI command, runs it over SSH, and parses the NDJSON output stream. See the dedicated [Claude Integration](claude-integration.md) page for details on the stream protocol and command structure.

### Chat vs Build

The service exposes two methods:

- **`chat(ideaId, message, callbacks)`** -- Invokes Claude with `--allowedTools 'Read,Grep,Glob'`, restricting it to read-only operations. Updates the idea status to `chatting`.
- **`build(ideaId, instructions, callbacks)`** -- Invokes Claude with no tool restrictions, inside a `project/` subdirectory under the idea. Updates the idea status to `building`.

Both methods resume from the existing session ID if one is stored on the idea's metadata, enabling conversation continuity.

### Cancellation

Active Claude sessions are tracked in a `Map<string, ClientChannel>` keyed by idea ID. The `cancel(ideaId)` method sends `SIGINT` to the SSH channel. If the process is still running after 5 seconds, it sends `SIGKILL`.

### Timeout

A timeout mechanism monitors the last output timestamp. If Claude produces no output for `CLAUDE_TIMEOUT_MS` (default 10 minutes), the process is automatically cancelled and an error is reported to the client.

## WebSocket Handler

**File:** `packages/backend/src/ws.ts`

The WebSocket server is created with `{ noServer: true }` and attached to the HTTP server's `upgrade` event. This allows the backend to authenticate the request before completing the upgrade.

### Authentication on Upgrade

```typescript
server.on('upgrade', (req, socket, head) => {
  const token = extractToken(req);
  if (!token || !verifyToken(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});
```

Cookie extraction is done manually since Express middleware does not run on upgrade requests. The signed cookie is parsed from the `Cookie` header, the HMAC signature is verified against `COOKIE_SECRET`, and the token is checked against the in-memory token set.

### Message Routing

Incoming WebSocket messages are parsed as JSON and dispatched based on their `type` field:

| Client Message Type | Handler | Description |
|--------------------|---------|-------------|
| `chat` | `handleChat()` | Starts or continues a chat session |
| `build` | `handleBuild()` | Triggers build mode for an idea |
| `cancel` | `claudeService.cancel()` | Cancels the active Claude session |

Server messages are sent back using a `sendMessage()` helper that checks `ws.readyState` before sending. All messages include an `ideaId` field for client-side multiplexing.

## Health Endpoint

The `GET /api/health` endpoint is unauthenticated and returns the server's health status including SSH connectivity:

```json
{
  "status": "ok",
  "ssh": true,
  "uptime": 42.5
}
```

If no SSH connections exist yet, it attempts a quick `echo ok` command to test connectivity. The status is `"ok"` when SSH is healthy, `"degraded"` when it is not. This endpoint is used by the Kubernetes liveness and readiness probes.
