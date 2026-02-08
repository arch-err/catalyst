import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { authRouter, requireAuth } from './auth.js';
import { ideasRouter } from './routes/ideas.js';
import { setupWebSocket } from './ws.js';
import { sshService } from './services/ssh.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());
app.use(cookieParser(config.cookieSecret));

// Health endpoint (no auth) — includes SSH connectivity check
app.get('/api/health', async (_req, res) => {
  let sshOk = sshService.isHealthy();
  // If no connections yet, try a quick echo command
  if (!sshOk) {
    try {
      await sshService.exec('echo ok');
      sshOk = true;
    } catch {
      sshOk = false;
    }
  }
  res.json({
    status: sshOk ? 'ok' : 'degraded',
    ssh: sshOk,
    uptime: process.uptime(),
  });
});

// Auth routes
app.use('/api', authRouter);

// Protected API routes
app.use('/api/ideas', requireAuth, ideasRouter);

// In production, serve frontend static files
if (config.nodeEnv === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const server = app.listen(config.port, () => {
  console.log(`Catalyst backend listening on :${config.port}`);
});

// Setup WebSocket on the same HTTP server
setupWebSocket(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  sshService.closeAll();
  server.close(() => process.exit(0));
});
