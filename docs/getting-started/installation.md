# Installation

This guide covers cloning the Catalyst repository, installing dependencies, and running the application locally for development.

## Clone the Repository

```bash
git clone <repo-url> catalyst
cd catalyst
```

## Install Dependencies

Catalyst is a monorepo with three packages (`shared`, `backend`, `frontend`). Bun's workspaces handle all of them in a single install:

```bash
bun install
```

This installs dependencies for all three packages and links the shared `@catalyst/shared` package so the backend and frontend can import types from it.

## Configure Environment

For local development, the defaults are designed to work out of the box with minimal configuration. The two things you most likely need to set are the SSH connection details for your dev-VM.

Create a `.env` file in the project root (or export the variables in your shell):

```bash
# .env (not committed to git)
SSH_HOST=192.168.56.10       # Your dev-VM's IP or hostname
SSH_USER=vagrant             # SSH username on the dev-VM
SSH_KEY_PATH=~/.ssh/id_ed25519  # Path to your SSH private key
IDEAS_BASE_PATH=~/catalyst/ideas  # Where ideas are stored on the dev-VM
```

!!! note
    For local development, `CATALYST_SECRET` defaults to `dev-secret` and `COOKIE_SECRET` defaults to `dev-cookie-secret`. These must be changed for production. See the [Configuration](configuration.md) page for all available variables.

## Run Locally

Start both the backend and frontend in development mode:

```bash
bun run dev
```

This runs `bun run --filter '*' dev`, which starts:

- **Backend** on port `3001` -- Express server with hot reload via `bun --watch`
- **Frontend** on port `3000` -- Vite dev server with HMR

The Vite dev server proxies `/api/*` and `/ws` requests to the backend on port `3001`, so you only need to open one URL:

```
http://localhost:3000
```

## First Login

1. Open `http://localhost:3000` in your browser.
2. You will see a login screen asking for a secret.
3. Enter `dev-secret` (the default `CATALYST_SECRET` for development).
4. You are now on the Dashboard. Click the **+** button to capture your first idea.

## Verify SSH Connectivity

After logging in, you can check that the backend can reach your dev-VM by hitting the health endpoint:

```bash
curl http://localhost:3001/api/health
```

A healthy response looks like:

```json
{
  "status": "ok",
  "ssh": true,
  "uptime": 42.5
}
```

If `ssh` is `false`, the backend cannot connect to the dev-VM. Double-check your `SSH_HOST`, `SSH_USER`, and `SSH_KEY_PATH` settings, and verify that you can SSH into the dev-VM manually:

```bash
ssh -i ~/.ssh/id_ed25519 vagrant@192.168.56.10 "echo ok"
```

## Build for Production

To create a production build of both packages:

```bash
bun run build
```

This runs:

- `tsc` for the backend (compiles TypeScript to `packages/backend/dist/`)
- `tsc --noEmit && vite build` for the frontend (type-checks then bundles to `packages/frontend/dist/`)

To start the production server:

```bash
cd packages/backend
bun dist/index.js
```

In production mode (`NODE_ENV=production`), the backend serves the frontend's static files from `packages/frontend/dist/` and handles the SPA fallback routing.
