# Frontend Authentication Integration Guide

**For Web App Developers** - How authentication is implemented in the AloeVera Harmony Meet web client

**Last Updated**: March 15, 2026
**Status**: ✅ Fully implemented — JWT + localStorage token management, silent refresh, protected routes

---

## 🎯 Current Implementation Overview

Authentication uses **JWT tokens stored in `localStorage`** managed by `src/services/api/apiClient.ts`. There is no React AuthContext or `useAuth()` hook — token access is imperative via `apiClient`.

**Token keys in `localStorage`:**
- `access_token` — 15-minute JWT access token
- `refresh_token` — 7-day refresh token (rotates on each refresh)

**Auth methods currently implemented:**
- ✅ Username/Password (email + password)

**Planned but not yet implemented:**
- 🔜 OAuth (Google, Facebook, VK)
- 🔮 Telegram Mini App integration

---

## 🔐 Authentication Flow

### Login / Registration

`Welcome.tsx` handles both login and registration using `react-hook-form` + Zod validation (`src/lib/validators.ts`).

On success:
```typescript
// Welcome.tsx (simplified)
const result = await authApi.login({ email, password });
if (result.success && result.data) {
  apiClient.setAccessToken(result.data.accessToken);
  apiClient.setRefreshToken(result.data.refreshToken);
  navigate('/friends');
}
```

### Token Storage — `apiClient.ts`

```typescript
// src/services/api/apiClient.ts
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

setAccessToken(token: string)   → localStorage.setItem(ACCESS_TOKEN_KEY, token)
getAccessToken()                → localStorage.getItem(ACCESS_TOKEN_KEY)
setRefreshToken(token: string)  → localStorage.setItem(REFRESH_TOKEN_KEY, token)
getRefreshToken()               → localStorage.getItem(REFRESH_TOKEN_KEY)
clearTokens()                   → removes both keys from localStorage
```

Every outgoing request includes the access token:
```
Authorization: Bearer <access_token>
```

### Silent Token Refresh on 401

When any API request returns `401 Unauthorized`, `apiClient` automatically:
1. Calls `POST /api/v1/auth/refresh` with the refresh token in the request body
2. Stores the new access + refresh tokens
3. Retries the original request

Concurrent 401 responses are deduplicated — only one refresh call fires; others queue behind it.

```typescript
// src/services/api/apiClient.ts (simplified)
if (response.status === 401 && !isRetry) {
  const refreshToken = getRefreshToken();
  const refreshResult = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
  if (refreshResult.ok) {
    setAccessToken(newTokens.accessToken);
    setRefreshToken(newTokens.refreshToken);
    return retryOriginalRequest();
  } else {
    clearTokens();
    window.location.href = '/';
  }
}
```

### Proactive Refresh — `ProtectedRoute.tsx`

`src/components/ProtectedRoute.tsx` runs on every route transition:
- If no `access_token` → redirects to `/`
- If `access_token` is expired but `refresh_token` is present → attempts silent refresh with loading spinner
- If `access_token` expires within **5 minutes** → lets user through immediately, fires background refresh
- If refresh fails → redirects to `/`

### Logout

`SettingsPage.tsx` calls:
```typescript
await authApi.logout();   // POST /api/v1/auth/logout (server-side revocation)
apiClient.clearTokens();  // removes both tokens from localStorage
navigate('/');
```

---

## 📋 API Endpoints (Currently Implemented)

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "age": 25,
  "gender": "male",
  "location": "Moscow"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": "...", "email": "john@example.com", "name": "John Doe" }
  }
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:** Same as register.

### Refresh Access Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

The backend also accepts the refresh token via an HttpOnly cookie when over HTTPS (the `Secure` flag is conditional on `Request.IsHttps`). The web client always sends it in the request body (localStorage flow).

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token...",
    "refreshToken": "new-refresh-token..."
  }
}
```

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

### Get Current User

```http
GET /api/v1/users/me
Authorization: Bearer <access_token>
```

---

## 🛠️ Key Files

| File | Role |
|------|------|
| `src/services/api/apiClient.ts` | Base HTTP client — adds auth headers, handles 401 + silent refresh |
| `src/services/api/authApi.ts` | Auth endpoints (login, register, logout, refresh) |
| `src/components/ProtectedRoute.tsx` | Route guard — proactive refresh, redirect if unauthenticated |
| `src/pages/Welcome.tsx` | Login + register forms (react-hook-form + Zod) |
| `src/pages/SettingsPage.tsx` | Logout logic |
| `src/lib/validators.ts` | Zod schemas — `loginSchema`, `registerSchema` |

---

## 📝 Form Validation

All auth forms use `react-hook-form` + `zodResolver`:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginSchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';

const form = useForm<LoginSchema>({ resolver: zodResolver(loginSchema) });

const handleLogin = form.handleSubmit(async (data) => {
  try {
    const result = await authApi.login(data);
    if (!result.success) throw result;
    apiClient.setAccessToken(result.data.accessToken);
    apiClient.setRefreshToken(result.data.refreshToken);
    navigate('/friends');
  } catch (err) {
    showApiError(err, 'Login failed');
  }
});
```

**`loginSchema`:** email (valid format), password (non-empty)

**`registerSchema`:** email, password (≥8 chars + uppercase + lowercase + digit + special char), name, age (18–99 int), location, gender, bio (optional, max 500 chars)

---

## 📝 Error Handling

```typescript
// Known field-level errors (e.g. email already taken)
if (err.error?.code === 'EMAIL_TAKEN') {
  form.setError('email', { message: 'This email is already registered' });
  return;
}

// Unexpected errors
showApiError(err, 'Fallback message');  // → toast.error(...)
```

---

## 🔒 Security Notes

The current implementation stores tokens in `localStorage`, which is susceptible to XSS attacks. This was chosen for simplicity and compatibility with the mock mode. For higher security environments:
- Store the access token in memory (React state/context)
- Store the refresh token in an HttpOnly cookie (the backend already supports this via `Secure` cookie on HTTPS)

The backend's `POST /api/v1/auth/refresh` accepts the refresh token both in the request body (localStorage flow) and via HttpOnly cookie (HTTPS flow), so switching is straightforward when needed.

---

## 🔮 Planned Authentication Features (Not Yet Implemented)

See `@lovecraft/Lovecraft/docs/AUTHENTICATION.md` for the full planned architecture.

- **OAuth 2.0** (Google, Facebook, VK) — account creation and linking
- **Telegram Mini App** — `initData` validation
- **Account linking** — multiple auth methods per user, smart email-based linking
- **Full `AuthContext`** — React Context for user identity instead of imperative `apiClient` calls

---

**See Also:**
- [AUTHENTICATION.md](../../lovecraft/Lovecraft/docs/AUTHENTICATION.md) - Planned full authentication architecture
- [API_INTEGRATION.md](./API_INTEGRATION.md) - API service layer guide
- [BACKEND_PLAN.md](./BACKEND_PLAN.md) - Backend implementation roadmap
