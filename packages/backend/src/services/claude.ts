import type { ClientChannel } from 'ssh2';
import { sshService } from './ssh.js';
import { config } from '../config.js';
import { ideasService } from './ideas.js';
import type { ClaudeStreamMessage } from '@catalyst/shared';

interface ClaudeCallbacks {
  onSystem: (sessionId: string, model: string) => void;
  onText: (text: string) => void;
  onToolUse: (toolUseId: string, name: string, input: Record<string, unknown>) => void;
  onToolResult: (toolUseId: string, content: string) => void;
  onResult: (result: { result?: string; error?: string; sessionId: string; costUsd: number; durationMs: number; turns: number }) => void;
  onError: (error: string) => void;
}

// Track active channels per idea for cancellation
const activeChannels = new Map<string, ClientChannel>();

function escapeForShell(s: string): string {
  return "$'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + "'";
}

function buildClaudeCommand(opts: {
  message: string;
  sessionId?: string;
  allowedTools?: string;
  projectDir?: string;
}): string {
  const parts = ['claude', '-p', escapeForShell(opts.message), '--output-format', 'stream-json'];

  if (opts.sessionId) {
    parts.push('--resume', opts.sessionId);
  }

  if (opts.allowedTools) {
    parts.push('--allowedTools', escapeForShell(opts.allowedTools));
  }

  if (opts.projectDir) {
    parts.push('--project-dir', opts.projectDir);
  }

  return parts.join(' ');
}

function parseNdjsonStream(callbacks: ClaudeCallbacks): (data: string) => void {
  let buffer = '';

  return (data: string) => {
    buffer += data;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg: ClaudeStreamMessage = JSON.parse(trimmed);

        switch (msg.type) {
          case 'system':
            if (msg.subtype === 'init') {
              callbacks.onSystem(msg.session_id, msg.model);
            }
            break;
          case 'assistant':
            if (msg.subtype === 'text') {
              callbacks.onText(msg.text);
            } else if (msg.subtype === 'tool_use') {
              callbacks.onToolUse(msg.tool_use_id, msg.name, msg.input);
            }
            break;
          case 'tool_result':
            callbacks.onToolResult(msg.tool_use_id, msg.content);
            break;
          case 'result':
            callbacks.onResult({
              result: msg.subtype === 'success' ? msg.result : undefined,
              error: msg.subtype === 'error' ? msg.error : undefined,
              sessionId: msg.session_id,
              costUsd: msg.cost_usd,
              durationMs: msg.duration_ms,
              turns: msg.turns,
            });
            break;
        }
      } catch {
        // Non-JSON line, skip
      }
    }
  };
}

export class ClaudeService {
  async chat(ideaId: string, message: string, callbacks: ClaudeCallbacks): Promise<void> {
    const idea = await ideasService.get(ideaId);
    if (!idea) throw new Error(`Idea not found: ${ideaId}`);

    const cmd = buildClaudeCommand({
      message,
      sessionId: idea.sessionId,
      allowedTools: 'Read,Grep,Glob',
    });

    // Update status to chatting
    if (idea.status === 'captured') {
      await ideasService.update(ideaId, { status: 'chatting' });
    }

    await this.runClaude(ideaId, cmd, callbacks);
  }

  async build(ideaId: string, instructions: string, callbacks: ClaudeCallbacks): Promise<void> {
    const idea = await ideasService.get(ideaId);
    if (!idea) throw new Error(`Idea not found: ${ideaId}`);

    const basePath = config.ideasBasePath;
    const projectDir = `${basePath}/${idea.slug}/project`;

    // Ensure project dir exists
    await sshService.exec(`mkdir -p ${projectDir}`);

    const cmd = buildClaudeCommand({
      message: instructions,
      sessionId: idea.sessionId,
      projectDir,
    });

    // Update status to building
    await ideasService.update(ideaId, { status: 'building' });

    await this.runClaude(ideaId, cmd, callbacks);
  }

  cancel(ideaId: string): void {
    const channel = activeChannels.get(ideaId);
    if (channel) {
      // Send SIGINT
      channel.signal('INT');
      setTimeout(() => {
        // If still running after 5s, kill
        if (activeChannels.has(ideaId)) {
          channel.signal('KILL');
          activeChannels.delete(ideaId);
        }
      }, 5000);
    }
  }

  private async runClaude(ideaId: string, command: string, callbacks: ClaudeCallbacks): Promise<void> {
    const parser = parseNdjsonStream({
      ...callbacks,
      onSystem: (sessionId, model) => {
        // Persist session ID
        ideasService.update(ideaId, { sessionId }).catch(() => {});
        callbacks.onSystem(sessionId, model);
      },
    });

    // Timeout: kill if no output for 10 minutes
    let lastOutput = Date.now();
    const timeoutCheck = setInterval(() => {
      if (Date.now() - lastOutput > config.claudeTimeout) {
        clearInterval(timeoutCheck);
        this.cancel(ideaId);
        callbacks.onError('Claude process timed out (no output for 10 minutes)');
      }
    }, 30000);

    try {
      const channel = await sshService.execStream(command, {
        onData: (data) => {
          lastOutput = Date.now();
          parser(data);
        },
        onError: (err) => {
          clearInterval(timeoutCheck);
          activeChannels.delete(ideaId);
          callbacks.onError(err.message);
        },
        onClose: (_code) => {
          clearInterval(timeoutCheck);
          activeChannels.delete(ideaId);
        },
      });
      activeChannels.set(ideaId, channel);
    } catch (err) {
      clearInterval(timeoutCheck);
      callbacks.onError(err instanceof Error ? err.message : 'SSH exec failed');
    }
  }
}

export const claudeService = new ClaudeService();
