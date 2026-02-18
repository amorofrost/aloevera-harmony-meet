// src/services/api/authApi.ts
import { apiClient, isApiMode } from './apiClient';

// Mock data imports
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
    
    // Find user by email
    const user = mockUsers.find(u => u.email === data.email);
    
    if (!user || data.password !== 'Test123!@#') {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: true,
          authMethods: ['local'],
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  },

  // Register
  async register(data: RegisterRequest) {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/register', data);
    }

    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if email exists
    const exists = mockUsers.some(u => u.email === data.email);
    if (exists) {
      return {
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
        timestamp: new Date().toISOString(),
      };
    }

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

  // Refresh token
  async refreshToken() {
    if (isApiMode()) {
      return apiClient.post<AuthResponse>('/api/v1/auth/refresh');
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
    const currentUser = mockUsers[0]; // Use first mock user
    
    return {
      success: true,
      data: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        emailVerified: true,
        authMethods: ['local'],
      },
      timestamp: new Date().toISOString(),
    };
  },
};
