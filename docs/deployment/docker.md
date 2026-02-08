# Docker Deployment

Catalyst can be run as a single Docker container using Docker Compose. This is the simplest deployment option for a single-machine setup.

## Prerequisites

- Docker and Docker Compose installed
- SSH key for the dev-VM accessible on the Docker host
- The dev-VM reachable from the Docker host

## Building the Image

Build the Catalyst image from the project root:

```bash
docker compose build
```

Or build directly with Docker:

```bash
docker build -t catalyst:latest .
```

### Dockerfile Stages

The multi-stage Dockerfile optimizes the final image size:

```dockerfile
### Stage 1: Dependencies
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN bun install --frozen-lockfile || bun install

### Stage 2: Build
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/*/node_modules
COPY . .
RUN bun run --filter '*' build

### Stage 3: Runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Copy only what's needed at runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/frontend/dist ./packages/frontend/dist
EXPOSE 3001
CMD ["bun", "packages/backend/dist/index.js"]
```

Key points:

- Dependencies are installed in a separate stage and cached.
- The runtime image uses `oven/bun:1-slim` for a smaller footprint.
- Only compiled backend, shared source (imported at runtime), and frontend static files are copied to the runtime image.

## Running with Docker Compose

The project includes a `docker-compose.yml`:

```yaml
services:
  catalyst:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - CATALYST_SECRET=${CATALYST_SECRET:-dev-secret}
      - COOKIE_SECRET=${COOKIE_SECRET:-dev-cookie-secret}
      - SSH_HOST=${SSH_HOST:-host.docker.internal}
      - SSH_PORT=${SSH_PORT:-22}
      - SSH_USER=${SSH_USER:-user}
      - SSH_KEY_PATH=/secrets/ssh/id_ed25519
      - IDEAS_BASE_PATH=${IDEAS_BASE_PATH:-~/catalyst/ideas}
    volumes:
      - ${SSH_KEY_FILE:-~/.ssh/id_ed25519}:/secrets/ssh/id_ed25519:ro
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### Configuration

Set your secrets and SSH details as environment variables before running:

```bash
export CATALYST_SECRET="$(openssl rand -hex 32)"
export COOKIE_SECRET="$(openssl rand -hex 32)"
export SSH_HOST=192.168.56.10
export SSH_USER=vagrant
export SSH_KEY_FILE=~/.ssh/catalyst_ed25519
```

### Start

```bash
docker compose up -d
```

Catalyst is now available at `http://localhost:3001`.

### Stop

```bash
docker compose down
```

## SSH Connectivity from Docker

The container needs to reach the dev-VM over SSH. There are a few scenarios:

### Dev-VM on the Docker Host

If your dev-VM is on the same machine (e.g., a Vagrant VM with port forwarding), the `docker-compose.yml` uses `host.docker.internal` as the default `SSH_HOST` with the `extra_hosts` directive:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

This works on Linux with Docker 20.10+. On macOS and Windows, `host.docker.internal` resolves automatically.

### Dev-VM on the Network

If the dev-VM is on a different machine, set `SSH_HOST` to its IP or hostname:

```bash
export SSH_HOST=192.168.1.100
```

### Dev-VM Runs Locally via Vagrant Port Forwarding

If Vagrant forwards SSH from the VM to a host port:

```bash
export SSH_HOST=host.docker.internal
export SSH_PORT=2222
```

## SSH Key Mount

The SSH private key is mounted as a read-only volume into the container at `/secrets/ssh/id_ed25519`. The `SSH_KEY_PATH` environment variable points to this location.

!!! warning
    Ensure the SSH key file on the host has restrictive permissions (`chmod 600`). Docker will mount it with the same permissions.

## Running Without Compose

You can also run the container directly:

```bash
docker run -d \
  --name catalyst \
  -p 3001:3001 \
  -e CATALYST_SECRET="your-secret" \
  -e COOKIE_SECRET="your-cookie-secret" \
  -e SSH_HOST="192.168.56.10" \
  -e SSH_USER="vagrant" \
  -e SSH_KEY_PATH="/secrets/ssh/id_ed25519" \
  -e IDEAS_BASE_PATH="~/catalyst/ideas" \
  -e NODE_ENV="production" \
  -v ~/.ssh/catalyst_ed25519:/secrets/ssh/id_ed25519:ro \
  --add-host=host.docker.internal:host-gateway \
  catalyst:latest
```

## Health Check

Verify the container is running and SSH is connected:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "ssh": true,
  "uptime": 10.2
}
```

If `"ssh": false`, check that:

1. The SSH key is correctly mounted (check `docker exec catalyst ls -la /secrets/ssh/`).
2. The dev-VM is reachable from inside the container (check `docker exec catalyst ping -c1 $SSH_HOST`).
3. SSH key permissions are correct on the dev-VM's `authorized_keys`.
