import fs from 'node:fs';

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing env var: ${key}`);
  return val;
}

function loadSshKey(): string {
  const keyPath = env('SSH_KEY_PATH', '/secrets/ssh/id_ed25519');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf-8');
  }
  // For local dev, allow SSH_KEY env var directly
  return env('SSH_KEY', '');
}

export const config = {
  port: parseInt(env('PORT', '3001'), 10),
  nodeEnv: env('NODE_ENV', 'development'),
  catalystSecret: env('CATALYST_SECRET', 'dev-secret'),
  cookieSecret: env('COOKIE_SECRET', 'dev-cookie-secret'),
  sshHost: env('SSH_HOST', 'localhost'),
  sshPort: parseInt(env('SSH_PORT', '22'), 10),
  sshUser: env('SSH_USER', process.env.USER ?? 'user'),
  sshKey: loadSshKey(),
  ideasBasePath: env('IDEAS_BASE_PATH', '~/catalyst/ideas'),
  maxSshConnections: parseInt(env('MAX_SSH_CONNECTIONS', '3'), 10),
  claudeTimeout: parseInt(env('CLAUDE_TIMEOUT_MS', '600000'), 10), // 10 min
};
