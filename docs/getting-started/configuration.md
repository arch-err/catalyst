# Configuration

Catalyst is configured entirely through environment variables. There are no configuration files to edit. All variables have sensible defaults for local development, but several must be changed for production.

## Environment Variables

### Application Secrets

| Variable | Description | Default | Required in Production |
|----------|------------|---------|----------------------|
| `CATALYST_SECRET` | The shared secret used to authenticate users. Users enter this value on the login screen. Must be a strong, unique string in production. | `dev-secret` | Yes |
| `COOKIE_SECRET` | Secret used to sign session cookies. Must be a strong, unique string in production. Used by `cookie-parser` for HMAC signing. | `dev-cookie-secret` | Yes |

!!! warning
    The default secrets are suitable only for local development. In production, generate strong random values:
    ```bash
    openssl rand -hex 32
    ```

### SSH Connection

| Variable | Description | Default |
|----------|------------|---------|
| `SSH_HOST` | Hostname or IP address of the dev-VM where Claude Code runs. | `localhost` |
| `SSH_PORT` | SSH port on the dev-VM. | `22` |
| `SSH_USER` | Username for SSH authentication on the dev-VM. | Value of `$USER` env var, or `user` |
| `SSH_KEY_PATH` | Path to the SSH private key file used for authentication. The backend reads this file at startup. | `/secrets/ssh/id_ed25519` |
| `SSH_KEY` | Alternative to `SSH_KEY_PATH`. The SSH private key as a string. Useful when you cannot mount a key file (e.g., in some CI environments). Only used if `SSH_KEY_PATH` does not exist on disk. | (empty) |
| `MAX_SSH_CONNECTIONS` | Maximum number of concurrent SSH connections in the pool. Each active Claude session or filesystem operation requires one connection. | `3` |

### Application Settings

| Variable | Description | Default |
|----------|------------|---------|
| `PORT` | Port the backend HTTP server listens on. | `3001` |
| `NODE_ENV` | Set to `production` to serve frontend static files from the backend and enable secure cookie flags. | `development` |
| `IDEAS_BASE_PATH` | Base directory on the dev-VM where idea folders are created. Each idea gets a subdirectory named by its slug (e.g., `~/catalyst/ideas/my-cool-idea/`). | `~/catalyst/ideas` |
| `CLAUDE_TIMEOUT_MS` | Timeout in milliseconds for Claude Code processes. If Claude produces no output for this duration, the process is killed. | `600000` (10 minutes) |

## How Configuration is Loaded

The backend loads configuration in `packages/backend/src/config.ts` at startup. The `env()` helper reads from `process.env` with an optional fallback. If a required variable is missing and has no default, the server will crash immediately with a clear error message.

```typescript
function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing env var: ${key}`);
  return val;
}
```

SSH key loading follows a two-step process:

1. Try to read the file at `SSH_KEY_PATH`.
2. If the file does not exist, fall back to the `SSH_KEY` environment variable.

This allows the same code to work both locally (where you have a key file) and in Kubernetes (where the key is mounted from a Secret).

## Directory Structure on the Dev-VM

Catalyst creates the following structure under `IDEAS_BASE_PATH` on the dev-VM:

```
~/catalyst/ideas/
  my-cool-idea/
    meta.json          # Idea metadata (id, slug, title, status, sessionId, timestamps)
    idea.md            # The original idea content entered during capture
    project/           # Created when build mode is activated; Claude builds here
      ...
  another-idea/
    meta.json
    idea.md
    project/
      ...
```

The `meta.json` file tracks the idea lifecycle:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "slug": "my-cool-idea",
  "title": "My Cool Idea",
  "status": "chatting",
  "sessionId": "sess_abc123",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:45:00.000Z"
}
```

## Example Configurations

### Local Development (Minimal)

```bash
export SSH_HOST=192.168.56.10
export SSH_USER=vagrant
export SSH_KEY_PATH=~/.ssh/id_ed25519
```

Everything else uses defaults.

### Docker Compose

See the `docker-compose.yml` in the project root. Environment variables are set in the `environment` block, and the SSH key is mounted as a read-only volume:

```yaml
services:
  catalyst:
    build: .
    ports:
      - "3001:3001"
    environment:
      - CATALYST_SECRET=${CATALYST_SECRET:-dev-secret}
      - COOKIE_SECRET=${COOKIE_SECRET:-dev-cookie-secret}
      - SSH_HOST=${SSH_HOST:-host.docker.internal}
      - SSH_PORT=${SSH_PORT:-22}
      - SSH_USER=${SSH_USER:-user}
      - SSH_KEY_PATH=/secrets/ssh/id_ed25519
      - IDEAS_BASE_PATH=${IDEAS_BASE_PATH:-~/catalyst/ideas}
    volumes:
      - ${SSH_KEY_FILE:-~/.ssh/id_ed25519}:/secrets/ssh/id_ed25519:ro
```

### Kubernetes (via Helm)

In Kubernetes, secrets are managed as `Secret` resources and non-sensitive config as a `ConfigMap`. See the [Helm Values Reference](../deployment/helm-values.md) for the full set of configurable values.
