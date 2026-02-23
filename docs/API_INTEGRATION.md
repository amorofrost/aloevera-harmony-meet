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
VITE_API_BASE_URL=https://api.aloevera-harmony.com
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
# From loveable/aloevera-harmony-meet/
docker compose up --build -d
# App: http://<host>:8080
# API proxied at: http://<host>:8080/api/
# Swagger at:     http://<host>:8080/swagger
```

nginx inside the frontend container proxies `/api/` and `/swagger` to the backend container over the internal Docker network (`http://backend:8080`). **Only port 8080 needs to be publicly exposed** — port 5000 does not need to be open in firewall/NSG rules.

**Important**: `VITE_API_BASE_URL` is baked into the JS bundle at build time. When deploying to a remote server, update this arg in `docker-compose.yml` before building:

```yaml
args:
  VITE_API_MODE: api
  VITE_API_BASE_URL: http://<your-server-ip-or-domain>:8080
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

All API services are implemented and wired. The full stack is deployed on Azure VM.

**Remaining gaps**:
- `chatsApi.ts` and `songsApi.ts` always return mock data — backend has no endpoints for these yet
- No token refresh — users must re-login after ~1h (access token expiry)
- No user-visible error messages for failed API calls (console.error only)

## 🔜 Next Steps

1. **Token refresh** — implement `AuthContext` with auto-refresh using the refresh token endpoint (`POST /api/v1/auth/refresh`)
2. **Chat / Songs backend endpoints** — implement in `Lovecraft.Backend` and wire frontend services
3. **Error handling** — surface API errors to users via toast notifications
