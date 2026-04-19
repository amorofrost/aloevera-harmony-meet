# API Integration Guide

## 🔄 API Modes

The frontend supports two modes controlled by environment variables:

### 1. Mock Mode (Default - Development)
- Uses local mock data from `src/data/`
- No backend required
- Perfect for UI development and testing
- Instant responses

### 2. API Mode (Production)
- Calls real backend REST APIs
- Requires backend server running
- Full authentication and data persistence

---

## 🔧 Configuration

### Environment Files

**`.env.development`** (default for `npm run dev`):
```bash
VITE_API_MODE=mock
VITE_API_BASE_URL=http://localhost:5000
```

**`.env.production`** (used for `npm run build`):
```bash
VITE_API_MODE=api
VITE_API_BASE_URL=
# Empty string — all API calls use relative paths (/api/v1/...); nginx proxies them.
# No domain needed because the frontend and API are served from the same origin (aloeve.club).
```

### Switching Modes

**Development with Mock Data:**
```bash
npm run dev
```

**Development with Real Backend:**
```bash
VITE_API_MODE=api npm run dev
# Backend must be running at http://localhost:5000
```

**Production Build:**
```bash
npm run build
# Uses .env.production (API mode by default)
```

---

## 📁 API Service Structure

```
src/
├── config/
│   └── api.config.ts          # API configuration
├── services/
│   └── api/
│       ├── apiClient.ts        # Base HTTP client
│       ├── authApi.ts          # Authentication endpoints
│       ├── usersApi.ts         # User endpoints
│       └── index.ts            # Central exports
```

### API Client (`apiClient.ts`)

Provides HTTP methods with automatic:
- Token injection from auth context
- Error handling
- Timeout management
- Credentials (cookies)

```typescript
import { apiClient } from '@/services/api';

// GET request
const response = await apiClient.get<User>('/api/v1/users/123');

// POST request
const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', {
  email: 'user@example.com',
  password: 'password'
});
```

### API Services

Each service automatically switches between mock and real API:

```typescript
import { authApi, usersApi } from '@/services/api';

// Login (automatically uses mock or real API)
const response = await authApi.login({
  email: 'user@example.com',
  password: 'password'
});

// Get users (automatically uses mock or real API)
const response = await usersApi.getUsers(0, 10);
```

---

## 🎯 Usage Examples

### In Components

```typescript
import { authApi, isApiMode } from '@/services/api';

function LoginForm() {
  const handleLogin = async () => {
    const response = await authApi.login({ email, password });
    
    if (response.success) {
      console.log('Logged in:', response.data);
      // Navigate to dashboard
    } else {
      console.error('Login failed:', response.error);
    }
  };

  return (
    <div>
      {isApiMode() && <Badge>Live API</Badge>}
      {/* ... form fields ... */}
    </div>
  );
}
```

### Response Format

All API responses follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}
```

**Success Example:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": { ... }
  },
  "timestamp": "2024-12-01T10:00:00Z"
}
```

**Error Example:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  },
  "timestamp": "2024-12-01T10:00:00Z"
}
```

---

## 🐳 Docker Usage

### Full Stack with Docker Compose (Recommended)

```bash
# From aloevera-harmony-meet/
docker compose up --build -d
# App: https://aloeve.club  (via Cloudflare → nginx port 443)
# API proxied at: https://aloeve.club/api/
# Swagger at:     https://aloeve.club/swagger
```

nginx inside the frontend container handles TLS termination (Cloudflare Origin Certificate) and proxies `/api/`, `/swagger`, and `/hubs/` to the backend container over the internal Docker network (`http://backend:8080`). **Only ports 80 and 443 need to be publicly exposed** — the backend is not reachable from outside Docker. See [HTTPS_SETUP.md](./HTTPS_SETUP.md) for the full SSL/DNS setup guide.

**Important**: `VITE_API_BASE_URL` is baked into the JS bundle at build time. It is set to an **empty string** in production — all API calls use relative paths (`/api/v1/...`) so nginx can proxy them regardless of the host domain. No changes to `docker-compose.yml` are needed when migrating hosts; only update the Cloudflare DNS A record.

```yaml
args:
  VITE_API_MODE: api
  # VITE_API_BASE_URL is intentionally omitted (defaults to "")
```

Backend reads `USE_AZURE_STORAGE` and `AZURE_STORAGE_CONNECTION_STRING` from `../../lovecraft/Lovecraft/.env` via `env_file`. Set `USE_AZURE_STORAGE=true` to use Azure Table Storage.

### Mock Mode (UI Development Only)
```bash
docker build -t aloevera-frontend .
docker run -p 8080:80 aloevera-frontend
# VITE_API_MODE defaults to mock — no backend required
```

---

## ✅ Benefits

1. **No Backend Required for UI Work**
   - Develop and test UI independently
   - Fast iteration without API delays
   - No need to run backend locally

2. **Easy Testing**
   - Test both mock and real API modes
   - Verify API integration before deployment
   - Mock mode for automated UI tests

3. **Production Ready**
   - Same codebase for dev and prod
   - Environment-based configuration
   - No code changes needed

4. **Type Safety**
   - TypeScript interfaces for all APIs
   - Autocomplete and validation
   - Catch errors at compile time

---

## ✅ Current State

All API services are implemented and wired. The full stack is deployed on Azure VM. JWT token refresh is fully implemented end-to-end.

**Remaining gaps**:
- `chatsApi.ts` and `songsApi.ts` always return mock data — backend has no endpoints for these yet
- No user-visible error messages for failed API calls (console.error only)

---

## Image Upload

```typescript
import { uploadImage } from '@/services/api/imagesApi';

// Upload a single File object; returns { url: string }
const { url } = await uploadImage(file);
```

In mock mode (`VITE_API_MODE=mock`), returns `https://placehold.co/600x400` after a 300ms delay. In API mode, calls `POST /api/v1/images/upload`.

---

## Events & event forum (API mode)

- **`eventsApi`** — list/detail events, register/unregister with invite code, interest (`POST`/`DELETE .../interest`), etc.
- **`forumsApi`** — `GET /api/v1/forum/event-discussions/summary`, `.../event-discussions/{eventId}/topics`, plus standard topic/reply routes for threads the user can access.
- **Admin** (`adminApi` in API mode) — event editor: forum topics with **visibility** (`public` / `attendeesOnly` / `specificUsers`) and optional **allowed user IDs**.

Product rules (visibility, invites, multiline descriptions, free-text price, forum topic access) are documented in **[EVENTS.md](./EVENTS.md)**.

---

## 🔜 Next Steps

1. **Chat / Songs backend endpoints** — implement in `Lovecraft.Backend` and wire frontend services
2. **Error handling** — surface API errors to users via toast notifications
3. **Form validation** — apply React Hook Form + Zod to login/register/profile forms
