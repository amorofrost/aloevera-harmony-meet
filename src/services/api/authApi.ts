// src/services/api/authApi.ts
import { apiClient, isApiMode } from './apiClient';
import { mockUsers } from '@/data/mockUsers';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  age?: number;
  location?: string;
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
    emailVerified: boolean;
    authMethods: string[];
  };
  expiresAt: string;
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

  // Registration config — returns whether an invite code is required
  async getRegistrationConfig() {
    if (isApiMode()) {
      return apiClient.get<{ inviteCodeRequired: boolean }>('/api/v1/auth/registration-config');
    }
    return { success: true, data: { inviteCodeRequired: false }, timestamp: new Date().toISOString() };
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
