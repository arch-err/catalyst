# Contributing

Guidelines for contributing to Catalyst.

## Development Setup

1. Fork and clone the repository.
2. Run `bun install` to install all dependencies.
3. Create a feature branch from `main`:

    ```bash
    git checkout -b feature/my-feature
    ```

4. Make your changes.
5. Run checks locally before pushing:

    ```bash
    bun run typecheck
    bun run build
    ```

6. Push and open a pull request.

## Pull Request Workflow

### Branch Naming

Use descriptive branch names with a prefix:

- `feature/` -- New features
- `fix/` -- Bug fixes
- `refactor/` -- Code improvements without behavior changes
- `docs/` -- Documentation updates
- `chore/` -- Maintenance tasks (dependency updates, CI changes)

### PR Requirements

Before a PR can be merged:

1. **TypeScript type checking passes** -- The CI runs `bun run typecheck` across all packages.
2. **Frontend builds successfully** -- The CI runs a full Vite production build.
3. **Backend builds successfully** -- The CI runs `tsc` to compile the backend.
4. **PR description** -- Describe what changed and why. Include screenshots for UI changes.

### Review Process

- PRs are reviewed for correctness, code style, and alignment with the project's architecture.
- Keep PRs focused. One logical change per PR is easier to review than a large omnibus PR.
- If a PR touches the shared types package, pay extra attention to backward compatibility with the WebSocket protocol.

## CI Checks

Three CI workflows run on every PR to `main`:

### `ci.yaml`

| Job | Command | Description |
|-----|---------|-------------|
| `typecheck` | `bun run typecheck` | Type-checks all packages |
| `build-frontend` | `bun run --filter '@catalyst/frontend' build` | Full Vite production build |
| `build-backend` | `bun run --filter '@catalyst/backend' build` | TypeScript compilation |

### `container.yaml` (push to `main` only)

Builds the Docker image and pushes to GHCR. This does not run on PRs.

### `helm.yaml` (push to `main` when `chart/` changes)

Lints and publishes the Helm chart to GHCR OCI.

## Code Style

### TypeScript

- **Strict mode** is enabled. All code must pass strict type checking.
- Use `satisfies` for type-checking API responses:

    ```typescript
    res.json({ ok: true, data: ideas } satisfies ApiResponse<IdeaMeta[]>);
    ```

- Prefer `interface` over `type` for object shapes.
- Use named exports, not default exports.

### React

- Use function components with hooks.
- State management with zustand stores for global state, `useState` for local state.
- Custom hooks for reusable logic (e.g., `useWebSocket`, `useIdeas`).
- Use `@/` path alias for imports within the frontend package.

### CSS

- Use Tailwind CSS utility classes. Avoid custom CSS where possible.
- Use shadcn/ui components as the base for UI elements.
- Follow the existing dark theme (slate scheme).

### File Organization

- One component per file.
- Group by feature/concern: pages in `pages/`, hooks in `hooks/`, stores in `stores/`, reusable UI in `components/ui/`.
- Keep the shared package as types only -- no runtime code.

## Making Changes to the WebSocket Protocol

The WebSocket protocol is defined in `packages/shared/src/index.ts`. If you need to add or modify message types:

1. Update the type definitions in `@catalyst/shared`.
2. Update the backend WebSocket handler (`packages/backend/src/ws.ts`).
3. Update the frontend message handler (typically in `pages/Session.tsx`).
4. Document the changes in `docs/api/websocket.md`.

Since the shared package is imported from source, there is no build step needed for type changes to propagate. However, ensure both the backend and frontend handle the new message types.

## Making Changes to the REST API

1. Update or add route handlers in `packages/backend/src/routes/`.
2. Add any new response types to `@catalyst/shared`.
3. Update frontend hooks or add new ones in `packages/frontend/src/hooks/`.
4. Document the changes in `docs/api/rest.md`.

## Making Changes to the Helm Chart

1. Modify templates in `chart/templates/` or values in `chart/values.yaml`.
2. Run `helm lint chart/` locally to check for errors.
3. Update `docs/deployment/helm-values.md` if you add or change values.
4. Bump the chart version in `chart/Chart.yaml` for significant changes.

## Versioning

Catalyst follows [Semantic Versioning](https://semver.org/):

- **Patch** (`v1.0.x`) -- Bug fixes, dependency updates
- **Minor** (`v1.x.0`) -- New features, non-breaking changes
- **Major** (`vx.0.0`) -- Breaking changes to the API, WebSocket protocol, or Helm chart values

Version tags (`v*`) trigger the container image and Helm chart CI workflows.
