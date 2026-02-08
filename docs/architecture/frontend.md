# Frontend Architecture

The Catalyst frontend is a React 18 single-page application built with Vite, styled with Tailwind CSS 4 and shadcn/ui components, and powered by zustand for state management. It is designed mobile-first for quick idea capture from a phone.

## Build Tooling

The frontend uses Vite 5 with the following plugins:

- **`@vitejs/plugin-react`** -- React Fast Refresh for HMR
- **`@tailwindcss/vite`** -- Tailwind CSS 4 integration

Path aliases are configured so `@/` maps to the `src/` directory:

```typescript
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

During development, Vite proxies API and WebSocket requests to the backend:

```typescript
server: {
  proxy: {
    '/api': { target: 'http://localhost:3001', changeOrigin: true },
    '/ws': { target: 'ws://localhost:3001', ws: true },
  },
}
```

## Application Structure

### Entry Point

`src/main.tsx` renders the root `<App>` component inside `React.StrictMode` with `BrowserRouter` for client-side routing. It also registers a service worker for potential offline support.

### Routing

| Route | Component | Auth Required | Description |
|-------|----------|--------------|-------------|
| `/login` | `LoginPage` | No | Secret-based authentication |
| `/` | `DashboardPage` | Yes | List of all ideas with status badges |
| `/capture` | `CapturePage` | Yes | Form to create a new idea |
| `/idea/:slug` | `SessionPage` | Yes | Chat and build interface for an idea |

Protected routes are wrapped in an `AuthGuard` component that checks authentication status on mount and redirects to `/login` if the user is not authenticated.

```typescript
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, checking } = useAuthStore();

  React.useEffect(() => {
    useAuthStore.getState().check();
  }, []);

  if (checking) return <Spinner />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

### Layout

The `Layout` component provides navigation structure:

- **Desktop** -- A narrow 64px sidebar on the left with icon buttons for Home, Capture, and Logout, plus a connection status indicator at the bottom.
- **Mobile** -- A fixed bottom navigation bar with the same items.

The main content area fills the remaining space. On mobile, bottom padding accounts for the nav bar and the safe area inset.

## Pages

### Login Page

A minimal centered form with a password input and submit button. Uses `useAuthStore.login()` to POST the secret to `/api/login`. On success, redirects to the dashboard.

### Dashboard Page

Displays all ideas sorted by last updated (descending). Each idea shows its title, status badge, and timestamp. Features:

- **Pull to refresh** via a refresh button
- **Delete** on hover (desktop) or long-press interaction
- **Floating action button** (bottom right) to navigate to the capture page

### Capture Page

A two-field form (title + content textarea) for quick idea entry. The title input is auto-focused on mount. On submit, it calls the `POST /api/ideas` endpoint and navigates to the new idea's session page.

### Session Page

The most complex page, providing the real-time Claude interaction interface:

- **Header** -- Idea title and status badge
- **Message area** -- Scrollable list of chat messages (user and assistant), rendered with Markdown support
- **Streaming buffer** -- Displays the currently streaming response as it arrives
- **Tool activity** -- Collapsible list of tool calls (Read, Grep, Glob, etc.) with their inputs and results
- **Input bar** -- Text input with Send (chat) and Build (hammer icon) buttons; switches to a Cancel button while Claude is streaming

Messages from Claude are rendered with `react-markdown` + `remark-gfm` for tables and task lists, and `react-syntax-highlighter` with the One Dark theme for code blocks.

## State Management

### Auth Store (`stores/auth.ts`)

A zustand store managing authentication state:

```typescript
interface AuthState {
  authenticated: boolean;
  checking: boolean;
  error: string | null;
  check: () => Promise<void>;   // GET /api/auth/check
  login: (secret: string) => Promise<boolean>;  // POST /api/login
  logout: () => Promise<void>;  // POST /api/logout
}
```

The `check()` action is called on app mount to verify the existing session cookie. The `login()` action returns a boolean indicating success.

### Connection Store (`stores/connection.ts`)

A simple zustand store tracking the WebSocket connection status:

```typescript
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
}
```

This drives the `ConnectionIndicator` component in the layout sidebar/nav, which shows a colored dot:

- Green for connected
- Yellow (pulsing) for connecting
- Red for disconnected

## Hooks

### `useWebSocket`

A custom React hook that manages the WebSocket connection lifecycle:

- **Auto-connect** on mount
- **Auto-reconnect** on close with exponential backoff (1s, 2s, 4s, ... up to 30s)
- **Reconnect counter reset** on successful connection
- **Stable `send()` function** for dispatching typed `WsClientMessage` objects
- **Connection status** tracking (`connecting`, `connected`, `disconnected`)
- **Clean disconnect** on unmount

```typescript
const { send, status } = useWebSocket({
  onMessage: (msg: WsServerMessage) => {
    // Handle incoming messages
  },
});
```

The URL is derived from the current page location, automatically using `wss:` for HTTPS and `ws:` for HTTP.

### `useIdeas` and `useIdea`

Data-fetching hooks for the ideas REST API:

- **`useIdeas()`** -- Fetches the full list of ideas on mount. Returns `{ ideas, loading, error, fetchIdeas, createIdea, deleteIdea }`.
- **`useIdea(slug)`** -- Fetches a single idea by slug. Returns `{ idea, loading, refetch }`.

Both hooks manage loading and error state internally.

## UI Components

Catalyst uses shadcn/ui components with Tailwind CSS 4:

| Component | File | Description |
|-----------|------|-------------|
| `Button` | `components/ui/button.tsx` | Styled button with variants (default, destructive, ghost, secondary) and sizes (default, sm, lg, icon) |
| `Input` | `components/ui/input.tsx` | Styled text input |
| `Textarea` | `components/ui/textarea.tsx` | Styled textarea |
| `Badge` | `components/ui/badge.tsx` | Status badges with color variants for each `IdeaStatus` |
| `Layout` | `components/Layout.tsx` | App shell with sidebar (desktop) and bottom nav (mobile) |
| `ConnectionIndicator` | `components/ConnectionIndicator.tsx` | Colored dot showing WebSocket status |
| `Toast` / `ToastContainer` | `components/Toast.tsx` | Toast notification system |

## Dependencies

Key frontend dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 18.3.1 | UI framework |
| `react-router-dom` | 7.1.x | Client-side routing |
| `zustand` | 5.0.11 | Lightweight state management |
| `react-markdown` | 10.1.0 | Markdown rendering for Claude responses |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown support |
| `react-syntax-highlighter` | 16.1.0 | Syntax highlighting in code blocks |
| `lucide-react` | 0.474.x | Icon library |
| `class-variance-authority` | 0.7.x | Component variant system (used by shadcn/ui) |
| `clsx` + `tailwind-merge` | Latest | Tailwind class merging utilities |
