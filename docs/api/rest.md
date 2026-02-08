# REST API

Detailed documentation for all REST API endpoints.

## Authentication Endpoints

### POST `/api/login`

Authenticate with the shared secret. On success, sets a signed session cookie.

**Request:**

```json
{
  "secret": "your-catalyst-secret"
}
```

**Headers:**

```
Content-Type: application/json
```

**Response (200 OK):**

```json
{
  "ok": true
}
```

**Response (400 Bad Request):**

```json
{
  "ok": false,
  "error": "Secret required"
}
```

**Response (401 Unauthorized):**

```json
{
  "ok": false,
  "error": "Invalid secret"
}
```

**Cookie Set:**

```
Set-Cookie: catalyst_session=s:<token>.<signature>;
  Path=/;
  HttpOnly;
  SameSite=Strict;
  Max-Age=2592000;
  Secure  (production only)
```

The secret comparison uses `crypto.timingSafeEqual` to prevent timing attacks. The input and expected buffers must be the same length, so an incorrect-length secret will also return 401.

---

### POST `/api/logout`

Clear the session cookie and invalidate the token server-side.

**Request:** No body required.

**Response (200 OK):**

```json
{
  "ok": true
}
```

The server removes the token from the in-memory set and clears the cookie.

---

### GET `/api/auth/check`

Check whether the current session is authenticated. Used by the frontend on page load to verify an existing cookie.

**Response (200 OK):**

```json
{
  "ok": true,
  "data": {
    "authenticated": true
  }
}
```

Or if not authenticated:

```json
{
  "ok": true,
  "data": {
    "authenticated": false
  }
}
```

Note: This endpoint always returns 200 OK. The `authenticated` field in the response data indicates the actual auth status.

---

## Health Endpoint

### GET `/api/health`

Returns the server's health status including SSH connectivity. This endpoint does not require authentication and is used by Kubernetes liveness and readiness probes.

**Response (200 OK):**

```json
{
  "status": "ok",
  "ssh": true,
  "uptime": 42.5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok" \| "degraded"` | `"ok"` when SSH is healthy, `"degraded"` when SSH is unreachable |
| `ssh` | boolean | Whether the backend can connect to the dev-VM |
| `uptime` | number | Server uptime in seconds |

If no SSH connections exist in the pool, the endpoint attempts a quick `echo ok` command to test connectivity.

---

## Ideas Endpoints

All ideas endpoints require authentication (the `catalyst_session` cookie).

### GET `/api/ideas`

List all ideas, sorted by `updatedAt` descending (most recently updated first).

**Response (200 OK):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "slug": "my-cool-idea",
      "title": "My Cool Idea",
      "status": "chatting",
      "sessionId": "sess_01J5XYZ...",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T11:45:00.000Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "slug": "another-idea",
      "title": "Another Idea",
      "status": "captured",
      "createdAt": "2025-01-14T09:00:00.000Z",
      "updatedAt": "2025-01-14T09:00:00.000Z"
    }
  ]
}
```

Each item is an `IdeaMeta` object (without the `content` field). If no ideas exist yet, `data` is an empty array.

---

### POST `/api/ideas`

Create a new idea. This creates a directory on the dev-VM with `meta.json` and `idea.md` files.

**Request:**

```json
{
  "title": "My Cool Idea",
  "content": "A web app that does X, Y, and Z. The main goal is to solve..."
}
```

**Headers:**

```
Content-Type: application/json
```

**Response (201 Created):**

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "slug": "my-cool-idea",
    "title": "My Cool Idea",
    "status": "captured",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Response (400 Bad Request):**

```json
{
  "ok": false,
  "error": "Title and content required"
}
```

The slug is generated from the title using the `slugify` library (lowercase, strict mode, special characters removed). The ID is a UUID v4.

The backend calls `ensureBasePath()` before creating the idea, which runs `mkdir -p` on the dev-VM to ensure the base ideas directory exists.

---

### GET `/api/ideas/:idOrSlug`

Get a single idea by its slug or UUID. Returns the full idea including the `content` field (the original idea text from `idea.md`).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `idOrSlug` | string | The idea's slug (e.g., `my-cool-idea`) or UUID |

**Response (200 OK):**

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "slug": "my-cool-idea",
    "title": "My Cool Idea",
    "status": "chatting",
    "sessionId": "sess_01J5XYZ...",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T11:45:00.000Z",
    "content": "A web app that does X, Y, and Z. The main goal is to solve..."
  }
}
```

**Response (404 Not Found):**

```json
{
  "ok": false,
  "error": "Idea not found"
}
```

**Lookup strategy:** The backend first tries to read `$IDEAS_BASE_PATH/<idOrSlug>/meta.json` (treating the parameter as a slug). If that fails, it uses `grep -rl` to search all `meta.json` files for a matching `id` field.

---

### PATCH `/api/ideas/:idOrSlug`

Update an idea's metadata. Only the provided fields are changed; others are preserved.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `idOrSlug` | string | The idea's slug or UUID |

**Request:**

```json
{
  "title": "Updated Title",
  "status": "done",
  "sessionId": "sess_01NEWID..."
}
```

All fields are optional. Updatable fields:

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | New title for the idea |
| `status` | `"captured" \| "chatting" \| "building" \| "done"` | New status |
| `sessionId` | string | Claude session ID |

**Response (200 OK):**

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-...",
    "slug": "my-cool-idea",
    "title": "Updated Title",
    "status": "done",
    "sessionId": "sess_01NEWID...",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

The `updatedAt` timestamp is automatically set to the current time.

**Response (404 Not Found):**

```json
{
  "ok": false,
  "error": "Idea not found"
}
```

!!! note
    The slug is not updated when the title changes. Slugs are immutable after creation.

---

### DELETE `/api/ideas/:idOrSlug`

Delete an idea and all its files (metadata, content, and project directory) from the dev-VM.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `idOrSlug` | string | The idea's slug or UUID |

**Response (200 OK):**

```json
{
  "ok": true
}
```

**Response (404 Not Found):**

```json
{
  "ok": false,
  "error": "Idea not found"
}
```

!!! warning
    This permanently deletes the idea directory on the dev-VM using `rm -rf`, including any project files built by Claude. This action cannot be undone.

---

## Error Handling

All endpoints wrap their logic in try/catch blocks. Unexpected errors return a 500 response:

```json
{
  "ok": false,
  "error": "Description of the error"
}
```

The error message is taken from the caught exception's `.message` property.

## Type Definitions

All request and response types are defined in `packages/shared/src/index.ts`:

```typescript
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface AuthCheckResponse {
  authenticated: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  ssh: boolean;
  uptime: number;
}

export type IdeaStatus = 'captured' | 'chatting' | 'building' | 'done';

export interface IdeaMeta {
  id: string;
  slug: string;
  title: string;
  status: IdeaStatus;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Idea extends IdeaMeta {
  content?: string;
}
```
