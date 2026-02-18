// src/services/api/index.ts
// Central export for all API services

export { apiClient, isApiMode, isMockMode } from './apiClient';
export { authApi } from './authApi';
export { usersApi } from './usersApi';

// Re-export types
export type { ApiResponse } from './apiClient';
export type { LoginRequest, RegisterRequest, AuthResponse } from './authApi';
