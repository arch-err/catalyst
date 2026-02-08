# Local Development

This guide covers the day-to-day development workflow for working on Catalyst locally.

## Starting the Dev Servers

From the project root:

```bash
bun run dev
```

This starts both services concurrently:

| Service | Port | Command | Features |
|---------|------|---------|----------|
| Backend | 3001 | `bun --watch src/index.ts` | Auto-restart on file changes |
| Frontend | 3000 | `vite --port 3000` | Hot Module Replacement (HMR) |

Open `http://localhost:3000` in your browser. The Vite dev server proxies all `/api/*` and `/ws` requests to the backend on port 3001, so everything works from a single URL.

## How the Proxy Works

The Vite dev server is configured in `packages/frontend/vite.config.ts` to proxy requests:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:3001',
      ws: true,
    },
  },
}
```

This means:

- `http://localhost:3000/api/health` proxies to `http://localhost:3001/api/health`
- `ws://localhost:3000/ws` proxies to `ws://localhost:3001/ws`
- All other requests are served by Vite (your React app)

## Backend Development

The backend runs with `bun --watch`, which automatically restarts the process when any TypeScript file in the backend package changes. There is no compilation step during development -- Bun runs TypeScript directly.

### Testing SSH Connectivity

If you do not have a dev-VM available, you can test the backend partially by pointing SSH at your local machine:

```bash
export SSH_HOST=localhost
export SSH_USER=$USER
export SSH_KEY_PATH=~/.ssh/id_ed25519
```

This requires:

- An SSH server running on your machine
- Your SSH key in `~/.ssh/authorized_keys`
- Claude Code installed locally

### Testing Without Claude Code

You can test the REST API, authentication, and WebSocket connection without Claude Code. The health endpoint will report `"ssh": false` if the dev-VM is unreachable, but the app will still function for:

- Logging in and out
- Creating, listing, and deleting ideas
- WebSocket connection (messages will return errors when you try to chat or build)

### Debugging

Since Bun is the runtime, you can use the Bun debugger:

```bash
cd packages/backend
bun --inspect --watch src/index.ts
```

Then attach your editor's debugger to the Bun debug port.

Alternatively, add `console.log` statements -- Bun's fast restart makes the edit-run-debug cycle very quick.

## Frontend Development

The frontend uses Vite with React Fast Refresh. Changes to React components are reflected instantly in the browser without a full page reload. CSS changes via Tailwind are also hot-reloaded.

### Path Aliases

The `@/` alias maps to `packages/frontend/src/`:

```typescript
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
```

### Adding shadcn/ui Components

Catalyst uses shadcn/ui components manually installed (not via the CLI). To add a new component:

1. Visit the [shadcn/ui documentation](https://ui.shadcn.com/).
2. Copy the component source code.
3. Create a new file in `packages/frontend/src/components/ui/`.
4. Adjust imports to use the project's `@/lib/utils` utility.

### Tailwind CSS 4

The project uses Tailwind CSS 4 with the `@tailwindcss/vite` plugin. Configuration is done via CSS rather than a `tailwind.config.js` file. The theme is defined in `src/index.css`.

## Running Individual Packages

You can run scripts for specific packages using Bun's filter:

```bash
# Start only the backend
bun run --filter '@catalyst/backend' dev

# Build only the frontend
bun run --filter '@catalyst/frontend' build

# Type-check only shared types
bun run --filter '@catalyst/shared' typecheck
```

## Type Checking

Run type checking across all packages:

```bash
bun run typecheck
```

This runs `tsc --noEmit` in each package. The shared package is checked first since the backend and frontend depend on it.

During development, you can run type checking in watch mode for a specific package:

```bash
cd packages/shared
bun run dev    # tsc --watch --noEmit
```

## Production Build Locally

To test the production build locally:

```bash
# Build everything
bun run build

# Start the production server
NODE_ENV=production bun packages/backend/dist/index.js
```

In production mode, the backend serves the frontend's static files from `packages/frontend/dist/`. Visit `http://localhost:3001` (not port 3000).

## Docker Build Locally

To test the Docker image:

```bash
docker compose build
docker compose up
```

The container runs in production mode on port 3001. See [Docker Deployment](../deployment/docker.md) for details.

## Common Issues

### "Missing env var: SSH_KEY"

The backend cannot find an SSH key. Either:

- Set `SSH_KEY_PATH` to your SSH private key file
- Set `SSH_KEY` to the key contents directly
- Create a key file at the default path `/secrets/ssh/id_ed25519`

### Frontend shows "Disconnected"

The WebSocket connection to the backend failed. Check that:

- The backend is running on port 3001
- The Vite proxy configuration is correct
- You are accessing the app via `localhost:3000` (not 3001 during development)

### "SSH connection pool exhausted"

All SSH connections are busy and the 10-second timeout was reached. This happens when multiple concurrent Claude sessions exceed `MAX_SSH_CONNECTIONS` (default 3). Increase the limit or wait for a session to complete.

### Changes not reflected

- **Backend:** Check that `bun --watch` is running. It should automatically restart on file changes.
- **Frontend:** Vite HMR should apply changes instantly. If not, try a hard refresh (`Ctrl+Shift+R`).
- **Shared types:** Changes to `@catalyst/shared` are picked up automatically since it is imported from source. However, your editor's TypeScript server may need a restart to recognize new types.
