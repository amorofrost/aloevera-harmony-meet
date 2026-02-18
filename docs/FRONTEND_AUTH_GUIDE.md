# Frontend Authentication Integration Guide

**For Web App Developers** - How to integrate with LoveCraft authentication

---

## 🎯 Overview

The backend supports **three authentication methods** that can be linked to a single user account:

1. **Username/Password** - Standard registration
2. **OAuth** - Google, Facebook, VK
3. **Telegram** - Telegram Mini App integration

Users can link multiple authentication methods to their account (e.g., start with username/password, later add Google).

---

## 🔐 Authentication Flow

### JWT Token Management

The backend returns two tokens:

**Access Token** (15 minutes):
- Use for all API requests
- Include in `Authorization: Bearer {token}` header
- Store in memory (not localStorage for security)

**Refresh Token** (7 days):
- Used to get new access tokens
- Should be stored in HttpOnly secure cookie (backend handles this)
- One-time use (rotates on each refresh)

### Token Storage Recommendation

```javascript
// ❌ DON'T store in localStorage (XSS vulnerability)
localStorage.setItem('token', accessToken);

// ✅ DO store in memory with React Context/Redux
const AuthContext = createContext();

function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  
  // Refresh token is in HttpOnly cookie (set by backend)
  // Access token: 15 minutes
  // Refresh token: 7 days
  
  return (
    <AuthContext.Provider value={{ accessToken, user, setAccessToken, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 📋 API Endpoints

### Registration (Username/Password)

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-guid",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "expiresAt": "2024-12-01T10:30:00Z"
  },
  "timestamp": "2024-12-01T10:00:00Z"
}
```

### Login (Username/Password)

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",  // or username
  "password": "SecurePass123"
}
```

**Response:** Same as registration

### OAuth Login (Google, Facebook, VK)

**Step 1: Initiate OAuth**
```javascript
// Redirect user to backend OAuth endpoint
window.location.href = '/api/v1/auth/oauth/google/login';
```

**Step 2: Backend handles OAuth flow**
- User authenticates with provider
- Backend receives callback
- **Smart Linking:** If email matches existing account → Automatically link (no duplicate)
- Backend creates account or links OAuth method
- Backend redirects back to frontend with tokens

**Step 3: Handle callback**
```javascript
// Backend redirects to: https://yourapp.com/auth/callback?token=...&linked=true
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('token');
const refreshToken = urlParams.get('refresh');
const wasLinked = urlParams.get('linked') === 'true';

if (wasLinked) {
  showNotification('Your Google account has been linked to your existing account');
}

// Store tokens and redirect to dashboard
storeTokens(accessToken, refreshToken);
navigate('/dashboard');
```

### Telegram Login

```http
POST /api/v1/auth/telegram/login
Content-Type: application/json

{
  "initData": "query_id=AAH...&user=%7B%22id%22..."
}
```

**Response:** Same as other login methods

### Refresh Access Token

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token...",
    "refreshToken": "new-refresh-token...",
    "expiresAt": "2024-12-01T11:00:00Z"
  }
}
```

### Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-guid",
    "email": "john@example.com",
    "username": "johndoe",
    "emailVerified": true,
    "authMethods": ["local", "google"],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Cookie: refresh_token=...
```

---

## 🛠️ Frontend Implementation

### React Authentication Hook

```typescript
// hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  authMethods: string[];
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include' // Include refresh token cookie
      });

      if (response.ok) {
        const result = await response.json();
        setUser(result.data);
      } else {
        // Try to refresh token
        await refreshAccessToken();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAccessToken = async () => {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include' // Send refresh token cookie
      });

      if (response.ok) {
        const result = await response.json();
        setAccessToken(result.data.accessToken);
        await checkAuth(); // Get user info with new token
      } else {
        // Refresh failed, user needs to log in again
        setUser(null);
        setAccessToken(null);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      setUser(null);
      setAccessToken(null);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Login failed');
    }

    const result = await response.json();
    setAccessToken(result.data.accessToken);
    setUser(result.data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Registration failed');
    }

    const result = await response.json();
    setAccessToken(result.data.accessToken);
    setUser(result.data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        register,
        isAuthenticated: !!user,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Usage in Components

```typescript
// Login.tsx
import { useAuth } from '../hooks/useAuth';

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
      
      {/* OAuth buttons */}
      <a href="/api/v1/auth/oauth/google/login">
        <button type="button">Sign in with Google</button>
      </a>
    </form>
  );
}
```

### Protected Route

```typescript
// components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Usage in App.tsx
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

### Authenticated API Requests

```typescript
// utils/api.ts
import { useAuth } from '../hooks/useAuth';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { accessToken } = useAuth();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  });

  // Handle 401 Unauthorized (token expired)
  if (response.status === 401) {
    // Try to refresh token
    const refreshResponse = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (refreshResponse.ok) {
      const result = await refreshResponse.json();
      // Retry original request with new token
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${result.data.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
  }

  return response;
}

// Usage
const users = await fetchWithAuth('/api/v1/users').then(r => r.json());
```

---

## 🔗 Account Linking

### Link OAuth Account (Google example)

```typescript
// Settings.tsx
function AccountSettings() {
  const { user } = useAuth();

  const linkGoogleAccount = () => {
    // Redirect to OAuth with link flag
    window.location.href = '/api/v1/auth/oauth/google/link';
  };

  return (
    <div>
      <h2>Linked Accounts</h2>
      <ul>
        {user?.authMethods.includes('local') && <li>✓ Username/Password</li>}
        {user?.authMethods.includes('google') && <li>✓ Google</li>}
        {user?.authMethods.includes('telegram') && <li>✓ Telegram</li>}
      </ul>

      {!user?.authMethods.includes('google') && (
        <button onClick={linkGoogleAccount}>
          Link Google Account
        </button>
      )}
    </div>
  );
}
```

---

## 📝 Error Handling

### Common Error Responses

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
  timestamp: string;
}

// Error codes
const ERROR_CODES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
  USERNAME_TAKEN: 'This username is already taken',
  WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  ACCOUNT_LOCKED: 'Account is locked due to too many failed attempts (15 min)',
  EMAIL_NOT_VERIFIED: 'Please verify your email before continuing',
  TOKEN_EXPIRED: 'Session expired, please log in again',
  TOKEN_INVALID: 'Invalid authentication token',
  OAUTH_LINKED: 'Your [Provider] account has been linked to your existing account'
};
```

---

## 🎨 UI Considerations

### Welcome/Login Page

Your existing `Welcome.tsx` should be updated to:
1. Add login form (email/password)
2. Add registration form (username/email/password with requirements)
3. Add OAuth buttons (Google, Facebook, VK)
4. Add "Forgot Password" link
5. Show email verification notice after registration
6. Handle smart linking notifications (e.g., "Your Google account was linked")

### Registration Form Validation

```typescript
// Validate before sending to backend
const validatePassword = (password: string): string[] => {
  const errors = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('At least one special character');
  }
  return errors;
};
```

### Email Verification Banner

```typescript
function EmailVerificationBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  // Don't show if user is verified OR if user is Telegram-only (no email)
  if (!user || user.emailVerified || !user.email) return null;

  const resendVerification = async () => {
    setSending(true);
    try {
      await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        credentials: 'include'
      });
      alert('Verification email sent!');
    } catch (error) {
      alert('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="banner warning">
      ⚠️ Please verify your email address to access the system.
      <button onClick={resendVerification} disabled={sending}>
        Resend Email
      </button>
    </div>
  );
}
```

---

## 🔒 Security Best Practices

1. **Never store access token in localStorage** - Use in-memory state
2. **Always use HTTPS** in production
3. **Validate inputs** on frontend before sending to backend
4. **Handle token expiration** gracefully with automatic refresh
5. **Clear tokens on logout** from memory and cookies
6. **Show security indicators** (email verified badge, linked accounts)
7. **Rate limit login attempts** on frontend (disable button after failures)
8. **Use CSRF tokens** if not using HttpOnly cookies for refresh tokens

---

## 📖 Next Steps

1. Update `Welcome.tsx` with login/registration forms
2. Implement `useAuth` hook
3. Add protected routes
4. Update API calls to use authentication
5. Add account settings page for linking providers
6. Test OAuth flows in development
7. Add email verification UI

---

**See Also:**
- [AUTHENTICATION.md](../../lovecraft/Lovecraft/docs/AUTHENTICATION.md) - Full authentication design
- [BACKEND_PLAN.md](./BACKEND_PLAN.md) - Backend implementation plan
- Backend API documentation (when available)
