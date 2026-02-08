# Catalyst

**From quick idea capture to full project build -- powered by Claude Code.**

Catalyst is a personal web application that takes a raw idea from a quick phone capture through Claude-powered refinement to a fully built project, all within a single continuous Claude Code session. It runs on a local Kubernetes cluster behind a VPN, with Claude Code executing on a Vagrant dev-VM over SSH.

## The Pipeline

Every idea flows through four stages:

```
Captured --> Chatting --> Building --> Done
```

1. **Capture** -- Jot down a rough idea from your phone or browser. Give it a title and a short description.
2. **Chat** -- Refine the idea with Claude in a read-only conversation. Claude can read files, search code, and explore the filesystem, but it cannot write anything yet. This is the brainstorming phase.
3. **Build** -- When the idea is ready, switch to build mode. Claude gets full tool access and creates the entire project in a dedicated directory on the dev-VM.
4. **Done** -- The project is built. Review the results, iterate, or start a new idea.

## How It Works

```
Phone/Browser --> k8s ingress (VPN) --> Catalyst Pod --> SSH --> Dev-VM --> Claude Code
```

Catalyst is a full-stack web application deployed as a single container on Kubernetes. When you send a message or trigger a build, the backend opens an SSH connection to a development VM where Claude Code is installed. It invokes `claude` with the appropriate arguments, streams the NDJSON output back over SSH, and relays it to your browser in real time over WebSocket.

Because Claude Code runs on the dev-VM (not inside the container), it has access to a real development environment with all the tools, runtimes, and configurations that a human developer would use.

## Key Features

- **Mobile-first capture** -- The UI is designed for quick idea entry on a phone. Open the app, type a title and description, and you are immediately in a session with Claude.
- **Real-time streaming** -- Claude's output streams to your browser as it is generated. You see text appear token by token, and you can watch tool calls (file reads, grep searches) happen live.
- **Session persistence** -- Each idea maintains a Claude Code session ID. When you return to an idea, the conversation picks up exactly where you left off.
- **Two interaction modes** -- Chat mode restricts Claude to read-only tools (`Read`, `Grep`, `Glob`) for safe exploration and refinement. Build mode unlocks all tools so Claude can create files, run commands, and build the project.
- **Cancellation** -- Long-running Claude processes can be cancelled from the UI. The backend sends `SIGINT` to the SSH channel, with a `SIGKILL` fallback after 5 seconds.
- **Connection pooling** -- SSH connections to the dev-VM are pooled and reused, with configurable limits and keepalive settings.
- **Secure by default** -- Authentication via a shared secret with timing-safe comparison, signed HTTP-only cookies, WebSocket auth on upgrade, and a Kubernetes NetworkPolicy that restricts traffic to the ingress controller and SSH egress only.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, zustand, react-router-dom |
| Backend | Node.js, Express 4, TypeScript, SSH2, ws (WebSocket) |
| Shared | TypeScript types package (`@catalyst/shared`) |
| Runtime | Bun (package manager and runtime) |
| Container | Multi-stage Dockerfile on `oven/bun` |
| Orchestration | Kubernetes with Helm chart |
| CI/CD | GitHub Actions (typecheck, build, container image to GHCR, Helm chart to GHCR OCI) |
| AI | Claude Code CLI on a Vagrant dev-VM |

## Quick Start

```bash
git clone <repo-url> catalyst
cd catalyst
bun install
bun run dev
```

The frontend runs on `http://localhost:3000` and proxies API/WebSocket requests to the backend on port `3001`. See the [Getting Started](getting-started/index.md) guide for full setup instructions.
