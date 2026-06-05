// src/services/api/authApi.ts
import { apiClient, isApiMode } from './apiClient';
import { mockUsers } from '@/data/mockUsers';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  accountName: string;
  email: string;
  password: string;
  name: string;
  age?: number;
  country?: string;
  region?: string;
  secondaryCountry?: string;
  secondaryRegion?: string;
  gender?: string;
  bio?: string;
  inviteCode?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    accountName?: string;
    emailVerified: boolean;
    authMethods: string[];
    profileImage: string;
  };
  expiresAt: string;
}

/** Telegram Login Widget user payload (snake_case from Telegram). */
export interface TelegramWidgetUserPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Verified Telegram identity carried across the pending-ticket flow. */
export interface TelegramUserInfo {
  id: number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
}

/** Either an immediate signed-in JWT pair, or a pending ticket for an unknown Telegram id. */
export interface TelegramLoginResult {
  status: 'signedIn' | 'pending';
  auth?: AuthResponse;
  ticket?: string;
  telegram?: TelegramUserInfo;
}

export interface TelegramRegisterRequest {
  ticket: string;
  accountName: string;
  name: string;
  age: number;
  country: string;
  region?: string;
  secondaryCountry?: string;
  secondaryRegion?: string;
  gender: string;
  bio?: string;
  inviteCode?: string;
}

export interface TelegramLinkLoginRequest {
  email: string;
  password: string;
  ticket: string;
}

/** Result of <c>/telegram-miniapp-login</c>: <c>signedIn</c> with JWT or <c>needsRegistration</c> with verified identity. */
export interface TelegramMiniAppLoginResult {
  status: 'signedIn' | 'needsRegistration';
  auth?: AuthResponse;
  telegram?: TelegramUserInfo;
}

export interface TelegramMiniAppRegisterRequest {
  initData: string;
  accountName: string;
  name: string;
  age: number;
  country: string;
  region?: string;
  secondaryCountry?: string;
  secondaryRegion?: string;
  gender: string;
  bio?: string;
  inviteCode?: string;
}

export interface TelegramMiniAppLinkLoginRequest {
  initData: string;
  email: string;
  password: string;
}

/** Result of POST /api/v1/auth/google-login */
export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
  pictureUrl?: string | null;
}

export interface GoogleLoginResult {
  status: 'signedIn' | 'pending' | 'emailConflict';
  auth?: AuthResponse;
  ticket?: string;
  google?: GoogleUserInfo;
  message?: string;
}

export interface GoogleRegisterRequest {
  ticket: string;
  accountName: string;
  name: string;
  age: number;
  country: string;
  region?: string;
  secondaryCountry?: string;
  secondaryRegion?: string;
  gender: string;
  bio?: string;
  inviteCode?: string;
}

export const authApi = {
  // Login
  async login(data: LoginRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/login', data);
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockUser = mockUsers.find(u => u.email === data.email);

    // Simple mock validation
    if (mockUser && data.password === mockUser.password) {
      return {
        success: true,
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            emailVerified: true,
            authMethods: ['local'],
            profileImage: mockUser.profileImage || '',
          },
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
    else {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  // Register
  async register(data: RegisterRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/register', data);
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: `user-${Date.now()}`,
          email: data.email,
          name: data.name,
          emailVerified: false,
          authMethods: ['local'],
          profileImage: '',
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  },

  // Logout
  async logout() {
    if (isApiMode()) {
      return apiClient.post('/api/v1/auth/logout');
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  },

  // Refresh token — sends the stored refresh token in the request body so the
  // endpoint works over plain HTTP (cookie Secure flag would block it otherwise)
  async refreshToken() {
    if (isApiMode()) {
      const refreshToken = apiClient.getRefreshToken();
      return apiClient.post<AuthResponse>('/api/v1/auth/refresh', refreshToken ? { refreshToken } : undefined);
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      success: true,
      data: {
        accessToken: 'mock-access-token-refreshed',
        refreshToken: 'mock-refresh-token-new',
        user: {
          id: 'current-user',
          email: 'user@example.com',
          name: 'Mock User',
          emailVerified: true,
          authMethods: ['local'],
          profileImage: '/placeholder.svg',
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  },

  // Get current user
  async getCurrentUser() {
    if (isApiMode()) {
      return apiClient.get<AuthResponse['user']>('/api/v1/auth/me');
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 200));

    const mockUser = mockUsers[0];

    return {
      success: true,
      data: {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        emailVerified: true,
        authMethods: ['local'],
        profileImage: mockUser.profileImage || '',
      },
      timestamp: new Date().toISOString(),
    };
  },

  // Forgot password — sends reset email; always returns success (anti-enumeration)
  async forgotPassword(email: string) {
    if (isApiMode()) {
      return apiClient.post<{ success: boolean }>('/api/v1/auth/forgot-password', { email });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, timestamp: new Date().toISOString() };
  },

  // Verify email — GET with token as query param (matches backend [HttpGet] endpoint)
  async verifyEmail(token: string) {
    if (isApiMode()) {
      return apiClient.get<{ success: boolean }>(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, timestamp: new Date().toISOString() };
  },

  async getTelegramLoginConfig() {
    if (isApiMode()) {
      return apiClient.get<{ botUsername: string; botId: string }>('/api/v1/auth/telegram-login-config');
    }
    return {
      success: true,
      data: {
        botUsername: (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string) || '',
        botId: (import.meta.env.VITE_TELEGRAM_BOT_ID as string) || '',
      },
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Telegram Login Widget — backend verifies hash. Returns either <c>signedIn</c> with a JWT pair
   * for a known Telegram id, or <c>pending</c> with a short-lived ticket for a new identity that
   * must be redeemed via telegramRegister / telegramLinkLogin.
   */
  async telegramLogin(data: TelegramWidgetUserPayload) {
    if (isApiMode()) {
      return apiClient.post<TelegramLoginResult>('/api/v1/auth/telegram-login', data);
    }
    await new Promise((r) => setTimeout(r, 300));
    return {
      success: false,
      error: { code: 'MOCK', message: 'Telegram login requires VITE_API_MODE=api' },
      timestamp: new Date().toISOString(),
    };
  },

  /** Create a new account from a verified Telegram pending ticket + profile fields. */
  async telegramRegister(data: TelegramRegisterRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/telegram-register', data);
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  /** Link a verified Telegram pending ticket to an existing email+password account in one call. */
  async telegramLinkLogin(data: TelegramLinkLoginRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/telegram-link-login', data);
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  /** Authenticated: link a verified Telegram ticket to the current account. */
  async telegramLink(ticket: string) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/telegram-link', { ticket });
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  /** Authenticated (Telegram-only): request attaching an email+password. Verification email sent. */
  async attachEmail(email: string, password: string) {
    if (isApiMode()) {
      return apiClient.post<boolean>('/api/v1/auth/attach-email', { email, password });
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  /**
   * Mini App: verify <c>initData</c> from <c>window.Telegram.WebApp</c>. Signs in a known
   * Telegram id, or returns <c>needsRegistration</c> with the verified identity so the Mini App
   * can render an inline onboarding wizard without leaving Telegram.
   */
  async miniAppLogin(initData: string) {
    if (isApiMode()) {
      return apiClient.post<TelegramMiniAppLoginResult>('/api/v1/auth/telegram-miniapp-login', { initData });
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  /** Mini App: create a new account from verified initData + profile fields + optional invite. */
  async miniAppRegister(data: TelegramMiniAppRegisterRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/telegram-miniapp-register', data);
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  /** Mini App: link verified initData to an existing email+password account in one call. */
  async miniAppLinkLogin(data: TelegramMiniAppLinkLoginRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/telegram-miniapp-link-login', data);
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  async getGoogleConfig() {
    if (isApiMode()) {
      return apiClient.get<{ clientId: string }>('/api/v1/auth/google-config');
    }
    const env = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
    return {
      success: true,
      data: { clientId: env },
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Google Identity: send the JWT `credential` from GoogleLogin / One Tap.
   * Returns signed in, pending (navigate to /welcome/google), or emailConflict.
   */
  async googleLogin(idToken: string) {
    if (isApiMode()) {
      return apiClient.post<GoogleLoginResult>('/api/v1/auth/google-login', { idToken });
    }
    await new Promise((r) => setTimeout(r, 200));
    return {
      success: false,
      error: { code: 'MOCK', message: 'Google sign-in requires VITE_API_MODE=api' },
      timestamp: new Date().toISOString(),
    };
  },

  async googleRegister(data: GoogleRegisterRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/google-register', data);
    }
    return { success: false, error: { code: 'MOCK', message: 'Requires VITE_API_MODE=api' }, timestamp: new Date().toISOString() };
  },

  // Registration config — whether appconfig requires an event invite to register
  async getRegistrationConfig() {
    if (isApiMode()) {
      return apiClient.get<{ requireEventInvite: boolean }>('/api/v1/auth/registration-config');
    }
    return { success: true, data: { requireEventInvite: false }, timestamp: new Date().toISOString() };
  },

  async checkAccountNameAvailability(name: string): Promise<{ available: boolean; reason?: 'invalidFormat' | 'reserved' | 'taken' }> {
    if (isApiMode()) {
      const resp = await apiClient.get<{ available: boolean; reason?: 'invalidFormat' | 'reserved' | 'taken' }>(
        `/api/v1/auth/account-name-availability?name=${encodeURIComponent(name)}`
      );
      if (resp.success && resp.data) return resp.data;
      return { available: false, reason: 'invalidFormat' };
    }

    // Mock implementation: format check, reserved check, then mockUsers collision check.
    await new Promise((r) => setTimeout(r, 150));
    const RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
    if (!RE.test(name)) return { available: false, reason: 'invalidFormat' };
    const reserved = new Set(['admin', 'root', 'system', 'support', 'help', 'api', 'auth', 'login', 'logout',
      'register', 'settings', 'profile', 'user', 'users', 'me', 'you', 'search', 'feed',
      'friends', 'talks', 'aloevera', 'aloeve', 'aloeband', 'telegram', 'google',
      'official', 'mod', 'moderator', 'staff', 'undefined', 'null', 'anonymous', 'bot']);
    if (reserved.has(name.toLowerCase())) return { available: false, reason: 'reserved' };
    const taken = mockUsers.some(u => (u.accountName ?? '').toLowerCase() === name.toLowerCase());
    return taken ? { available: false, reason: 'taken' } : { available: true };
  },

  // Reset password — data.password (form field) maps to newPassword in the API body
  async resetPassword(token: string, newPassword: string) {
    if (isApiMode()) {
      return apiClient.post<{ success: boolean }>('/api/v1/auth/reset-password', { token, newPassword });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, timestamp: new Date().toISOString() };
  },
};
