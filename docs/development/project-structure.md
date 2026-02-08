# Project Structure

Catalyst is organized as a Bun workspace monorepo. This page explains the directory layout and the role of each package and file.

## Root Layout

```
catalyst/
  .github/
    workflows/
      ci.yaml              # Typecheck and build CI
      container.yaml        # Docker image build and push to GHCR
      helm.yaml             # Helm chart lint, package, and push to GHCR
  chart/
    Chart.yaml              # Helm chart metadata
    values.yaml             # Default Helm values
    templates/
      _helpers.tpl          # Helm template helpers (names, labels)
      configmap.yaml        # SSH connection config
      deployment.yaml       # Catalyst pod deployment
      ingress.yaml          # Nginx ingress with WebSocket support
      namespace.yaml        # Namespace resource
      networkpolicy.yaml    # Ingress/egress restrictions
      NOTES.txt             # Post-install instructions
      secret.yaml           # Optional chart-managed secrets
      service.yaml          # ClusterIP service
  packages/
    shared/                 # Shared TypeScript types
    backend/                # Express server
    frontend/               # React SPA
  docker-compose.yml        # Single-machine Docker deployment
  Dockerfile                # Multi-stage container build
  package.json              # Root workspace configuration
  tsconfig.base.json        # Shared TypeScript compiler options
  bun.lock                  # Bun lockfile
  .gitignore
```

## Root `package.json`

The root `package.json` defines the workspace and top-level scripts:

```json
{
  "name": "catalyst",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "build": "bun run --filter '*' build",
    "typecheck": "bun run --filter '*' typecheck"
  }
}
```

The `--filter '*'` flag runs the script in all workspace packages that define it. Bun handles dependency ordering automatically.

## `tsconfig.base.json`

Shared TypeScript configuration extended by all packages:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Key choices:

- **ES2022 target** -- Allows modern syntax (top-level await, etc.)
- **Bundler module resolution** -- Works with both Vite (frontend) and Bun (backend)
- **Strict mode** -- Full TypeScript strictness enabled

## `@catalyst/shared`

```
packages/shared/
  src/
    index.ts               # All type definitions
  package.json
  tsconfig.json
```

The shared package contains only TypeScript type definitions -- no runtime code. It exports:

- **Idea types:** `IdeaStatus`, `IdeaMeta`, `Idea`
- **Claude stream types:** `ClaudeSystemInit`, `ClaudeAssistantText`, `ClaudeToolUse`, `ClaudeToolResult`, `ClaudeResult`, `ClaudeStreamMessage`
- **WebSocket protocol:** `WsChatMessage`, `WsBuildMessage`, `WsCancelMessage`, `WsClientMessage`, `WsClaudeSystemMessage`, `WsClaudeTextMessage`, `WsClaudeToolUseMessage`, `WsClaudeToolResultMessage`, `WsClaudeResultMessage`, `WsClaudeErrorMessage`, `WsServerMessage`
- **API types:** `ApiResponse<T>`, `AuthCheckResponse`, `HealthResponse`

The package is referenced as `@catalyst/shared` with `"workspace:*"` in the dependent packages. Its `main` and `types` fields both point to `./src/index.ts`, so both the backend and frontend import types directly from source.

**Scripts:**

- `dev` -- `tsc --watch --noEmit` (type checking in watch mode)
- `typecheck` -- `tsc --noEmit`

## `@catalyst/backend`

```
packages/backend/
  src/
    index.ts               # Express app entry point, server startup
    config.ts              # Environment variable loading
    auth.ts                # Login/logout routes, cookie auth, token store
    ws.ts                  # WebSocket server setup and message routing
    routes/
      ideas.ts             # REST API for ideas CRUD
    services/
      ssh.ts               # SSH connection pooling and command execution
      ideas.ts             # Ideas filesystem CRUD via SSH
      claude.ts            # Claude Code CLI invocation and NDJSON parsing
  dist/                    # Compiled output (tsc)
  package.json
  tsconfig.json
```

**Key dependencies:**

| Package | Purpose |
|---------|---------|
| `express` | HTTP server and routing |
| `cookie-parser` | Signed cookie parsing |
| `cookie` | Manual cookie parsing for WebSocket auth |
| `ws` | WebSocket server |
| `ssh2` | SSH connections to the dev-VM |
| `uuid` | Idea ID generation |
| `slugify` | Title-to-slug conversion |

**Scripts:**

- `dev` -- `bun --watch src/index.ts` (auto-restart on changes)
- `build` -- `tsc` (compile to `dist/`)
- `start` -- `bun dist/index.js`
- `typecheck` -- `tsc --noEmit`

## `@catalyst/frontend`

```
packages/frontend/
  src/
    main.tsx               # React entry point, routing, AuthGuard
    index.css              # Tailwind CSS entry point
    pages/
      Login.tsx            # Secret-based login form
      Dashboard.tsx        # Ideas list with status badges
      Capture.tsx          # New idea form
      Session.tsx          # Chat/build interface with real-time streaming
    components/
      Layout.tsx           # App shell (sidebar + bottom nav)
      ConnectionIndicator.tsx  # WebSocket status dot
      Toast.tsx            # Toast notification system
      ui/
        badge.tsx          # shadcn/ui Badge component
        button.tsx         # shadcn/ui Button component
        input.tsx          # shadcn/ui Input component
        textarea.tsx       # shadcn/ui Textarea component
    hooks/
      useWebSocket.ts      # WebSocket connection with auto-reconnect
      useIdeas.ts          # Ideas REST API data fetching
    stores/
      auth.ts              # zustand auth state (check, login, logout)
      connection.ts        # zustand WebSocket connection status
    lib/
      utils.ts             # Tailwind class merging utility (cn)
  vite.config.ts           # Vite configuration with proxy and plugins
  package.json
  tsconfig.json
```

**Key dependencies:**

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `zustand` | State management |
| `react-markdown` + `remark-gfm` | Markdown rendering |
| `react-syntax-highlighter` | Code block syntax highlighting |
| `lucide-react` | Icons |
| `class-variance-authority` | Component variant system |
| `tailwindcss` | Utility-first CSS |

**Scripts:**

- `dev` -- `vite --port 3000` (dev server with HMR)
- `build` -- `tsc --noEmit && vite build` (type-check then bundle)
- `typecheck` -- `tsc --noEmit`

## Helm Chart

```
chart/
  Chart.yaml               # Chart metadata (name, version, appVersion)
  values.yaml              # Default configurable values
  templates/
    _helpers.tpl           # Template helpers for names and labels
    configmap.yaml         # SSH_HOST, SSH_PORT, SSH_USER, IDEAS_BASE_PATH
    deployment.yaml        # Pod spec with env vars, volume mounts, probes
    ingress.yaml           # Nginx ingress with WebSocket annotations
    namespace.yaml         # Namespace creation
    networkpolicy.yaml     # Traffic restrictions
    NOTES.txt              # Post-install user instructions
    secret.yaml            # Optional chart-managed secrets
    service.yaml           # ClusterIP service
```

See the [Helm Values Reference](../deployment/helm-values.md) for documentation of all configurable values.
