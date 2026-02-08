import { Server as HttpServer, IncomingMessage } from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import cookie from 'cookie';
import { config } from './config.js';
import { verifyToken, COOKIE_NAME } from './auth.js';
import { claudeService } from './services/claude.js';
import type { WsClientMessage, WsServerMessage } from '@catalyst/shared';

// Manually unsign cookie (replicating cookie-signature logic for WebSocket upgrade)
function extractToken(req: IncomingMessage): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const parsed = cookie.parse(cookies);
  const signed = parsed[COOKIE_NAME];
  if (!signed) return null;

  // Signed cookies from cookie-parser are prefixed with 's:'
  if (signed.startsWith('s:')) {
    const val = signed.slice(2);
    const dot = val.lastIndexOf('.');
    if (dot === -1) return null;
    const payload = val.slice(0, dot);
    const sig = val.slice(dot + 1);
    const expected = crypto
      .createHmac('sha256', config.cookieSecret)
      .update(payload)
      .digest('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    if (sig === expected) return payload;
    return null;
  }

  return signed || null;
}

export function setupWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    // Verify auth cookie
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

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', async (data) => {
      let msg: WsClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendMessage(ws, { type: 'claude:error', ideaId: '', error: 'Invalid message format' });
        return;
      }

      switch (msg.type) {
        case 'chat':
          await handleChat(ws, msg.ideaId, msg.message);
          break;
        case 'build':
          await handleBuild(ws, msg.ideaId, msg.instructions);
          break;
        case 'cancel':
          claudeService.cancel(msg.ideaId);
          break;
      }
    });
  });
}

function sendMessage(ws: WebSocket, msg: WsServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function handleChat(ws: WebSocket, ideaId: string, message: string): Promise<void> {
  try {
    await claudeService.chat(ideaId, message, {
      onSystem: (sessionId, model) => {
        sendMessage(ws, { type: 'claude:system', ideaId, sessionId, model });
      },
      onText: (text) => {
        sendMessage(ws, { type: 'claude:text', ideaId, text });
      },
      onToolUse: (toolUseId, name, input) => {
        sendMessage(ws, { type: 'claude:tool_use', ideaId, toolUseId, name, input });
      },
      onToolResult: (toolUseId, content) => {
        sendMessage(ws, { type: 'claude:tool_result', ideaId, toolUseId, content });
      },
      onResult: (result) => {
        sendMessage(ws, { type: 'claude:result', ideaId, ...result });
      },
      onError: (error) => {
        sendMessage(ws, { type: 'claude:error', ideaId, error });
      },
    });
  } catch (err) {
    sendMessage(ws, {
      type: 'claude:error',
      ideaId,
      error: err instanceof Error ? err.message : 'Chat failed',
    });
  }
}

async function handleBuild(ws: WebSocket, ideaId: string, instructions: string): Promise<void> {
  try {
    await claudeService.build(ideaId, instructions, {
      onSystem: (sessionId, model) => {
        sendMessage(ws, { type: 'claude:system', ideaId, sessionId, model });
      },
      onText: (text) => {
        sendMessage(ws, { type: 'claude:text', ideaId, text });
      },
      onToolUse: (toolUseId, name, input) => {
        sendMessage(ws, { type: 'claude:tool_use', ideaId, toolUseId, name, input });
      },
      onToolResult: (toolUseId, content) => {
        sendMessage(ws, { type: 'claude:tool_result', ideaId, toolUseId, content });
      },
      onResult: (result) => {
        sendMessage(ws, { type: 'claude:result', ideaId, ...result });
      },
      onError: (error) => {
        sendMessage(ws, { type: 'claude:error', ideaId, error });
      },
    });
  } catch (err) {
    sendMessage(ws, {
      type: 'claude:error',
      ideaId,
      error: err instanceof Error ? err.message : 'Build failed',
    });
  }
}
