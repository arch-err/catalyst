# Development Guide

This section covers everything you need to work on Catalyst itself: the project structure, local development workflow, and contribution guidelines.

## Prerequisites for Development

- **Bun 1.x** -- Package manager and runtime
- **A code editor** with TypeScript support (VS Code recommended)
- **SSH access to a dev-VM** with Claude Code installed (for testing Claude features)
- **Git** for version control

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun install` | Install all dependencies for all packages |
| `bun run dev` | Start backend + frontend in development mode |
| `bun run build` | Production build of all packages |
| `bun run typecheck` | TypeScript type checking across all packages |

## Development Workflow

1. Clone the repo and run `bun install`.
2. Set up your SSH environment (see [Configuration](../getting-started/configuration.md)).
3. Run `bun run dev` to start both the backend (port 3001) and frontend (port 3000).
4. Open `http://localhost:3000` and log in with `dev-secret`.
5. Make changes -- the backend restarts automatically via `bun --watch`, and the frontend has Vite HMR.
6. Run `bun run typecheck` before committing to catch type errors.

## Sections

- **[Project Structure](project-structure.md)** -- Understand the monorepo layout and what each package does.
- **[Local Development](local-dev.md)** -- Detailed guide for running and debugging locally.
- **[Contributing](contributing.md)** -- How to contribute, PR workflow, and CI checks.
