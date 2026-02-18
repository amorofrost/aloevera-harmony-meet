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

### Mock Mode (UI Development)
```bash
docker build -t aloevera-frontend .
docker run -p 8080:80 aloevera-frontend
```

### API Mode (with Backend)
```bash
# Build with API mode
docker build \
  --build-arg VITE_API_MODE=api \
  --build-arg VITE_API_BASE_URL=http://backend:8080 \
  -t aloevera-frontend .

# Run
docker run -p 8080:80 aloevera-frontend
```

### Full Stack with Docker Compose
```bash
docker-compose up
# Frontend: http://localhost:8080
# Backend: http://localhost:5000
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

## 🔜 Next Steps

1. **Add More API Services**
   - Create `eventsApi.ts` for event endpoints
   - Create `matchingApi.ts` for matching endpoints
   - Create `forumsApi.ts` for forum endpoints

2. **Implement Auth Context**
   - Store access token in React Context
   - Auto-refresh tokens
   - Handle 401 responses

3. **Add Loading States**
   - Global loading indicator
   - Per-request loading states
   - Optimistic updates

4. **Error Handling**
   - Global error boundary
   - Toast notifications
   - Retry logic
