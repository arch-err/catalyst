# API Reference

Catalyst exposes a REST API for managing ideas and authentication, a WebSocket endpoint for real-time Claude interactions, and a health endpoint for monitoring.

## Base URL

- **Local development:** `http://localhost:3001` (backend) or `http://localhost:3000` (through Vite proxy)
- **Production:** Your configured ingress hostname (e.g., `https://catalyst.yourdomain.com`)

## Authentication

All API endpoints except `/api/health`, `/api/login`, and `/api/auth/check` require authentication. Authentication is cookie-based:

1. POST to `/api/login` with the shared secret.
2. The server sets a signed `catalyst_session` cookie (HTTP-only, 30-day expiry).
3. All subsequent requests include this cookie automatically.

If a request to a protected endpoint lacks a valid session cookie, the server responds with:

```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

HTTP status: `401`

## Response Format

All REST API responses follow the `ApiResponse<T>` format:

### Success

```json
{
  "ok": true,
  "data": { ... }
}
```

### Error

```json
{
  "ok": false,
  "error": "Description of what went wrong"
}
```

## Endpoints Overview

### REST API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check with SSH status |
| `POST` | `/api/login` | No | Authenticate with shared secret |
| `POST` | `/api/logout` | No | Clear session |
| `GET` | `/api/auth/check` | No | Check authentication status |
| `GET` | `/api/ideas` | Yes | List all ideas |
| `POST` | `/api/ideas` | Yes | Create a new idea |
| `GET` | `/api/ideas/:idOrSlug` | Yes | Get a single idea |
| `PATCH` | `/api/ideas/:idOrSlug` | Yes | Update an idea |
| `DELETE` | `/api/ideas/:idOrSlug` | Yes | Delete an idea |

See the [REST API](rest.md) page for detailed request/response documentation.

### WebSocket

| URL | Auth | Description |
|-----|------|-------------|
| `/ws` | Cookie (on upgrade) | Real-time Claude Code interaction |

See the [WebSocket Protocol](websocket.md) page for the full message schema.
