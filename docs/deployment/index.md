# Deployment Overview

Catalyst can be deployed in several ways, from a simple Docker container to a full Kubernetes deployment with Helm. This section covers all options.

## Deployment Options

| Method | Best For | Complexity |
|--------|---------|-----------|
| [Docker Compose](docker.md) | Quick single-machine deployment | Low |
| [Kubernetes + Helm](kubernetes.md) | Production deployment on a local cluster | Medium |
| Local (no container) | Development only | Lowest |

All deployment methods require SSH access to a dev-VM where Claude Code is installed. The container/pod does not run Claude Code itself -- it connects to the dev-VM over SSH.

## Container Image

Catalyst uses a multi-stage Dockerfile based on `oven/bun`:

1. **deps** -- Installs all workspace dependencies with `bun install --frozen-lockfile`.
2. **build** -- Copies source code and runs `bun run --filter '*' build` (TypeScript compilation + Vite build).
3. **runtime** -- Slim image with only production artifacts: backend dist, shared source, frontend dist, and runtime dependencies.

The final image exposes port `3001` and runs `bun packages/backend/dist/index.js`.

## CI/CD

Catalyst's GitHub Actions workflows automate the entire delivery pipeline:

### CI (`ci.yaml`)

Runs on every push and pull request to `main`:

- **typecheck** -- Runs `bun run typecheck` across all packages.
- **build-frontend** -- Builds the frontend and uploads the dist as an artifact.
- **build-backend** -- Builds the backend TypeScript.

### Container Image (`container.yaml`)

Runs on push to `main` and version tags (`v*`):

- Builds the Docker image using BuildKit with GitHub Actions cache.
- Pushes to GitHub Container Registry (`ghcr.io`).
- Tags: branch name, semver version, semver major.minor, and git SHA.

### Helm Chart (`helm.yaml`)

Runs on push to `main` (when `chart/` files change) and version tags:

- Lints the Helm chart with `helm lint`.
- Packages the chart and pushes it as an OCI artifact to `ghcr.io`.

## Environment Requirements

Regardless of deployment method, you need:

- A dev-VM accessible over SSH from wherever Catalyst runs
- An SSH private key that Catalyst can use to authenticate
- The `CATALYST_SECRET` and `COOKIE_SECRET` set to strong values
- DNS or `/etc/hosts` configured for your chosen hostname (if using ingress)

## Security Considerations

Catalyst should only be accessible over a VPN. It provides authenticated access to Claude Code with full tool permissions in build mode, which means it can read and write files, execute commands, and install packages on the dev-VM.

Key security measures in place:

- Authentication via a shared secret with timing-safe comparison
- Signed, HTTP-only, secure (in production) cookies with `sameSite: strict`
- WebSocket authentication on upgrade
- Kubernetes NetworkPolicy restricting ingress and egress traffic
- SSH key authentication (no passwords)
