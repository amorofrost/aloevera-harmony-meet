// src/config/api.config.ts
export const API_CONFIG = {
  mode: import.meta.env.VITE_API_MODE || 'mock',
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
} as const;

export const isApiMode = () => API_CONFIG.mode === 'api';
export const isMockMode = () => API_CONFIG.mode === 'mock';

// Log current mode
console.log('🔧 API Mode:', API_CONFIG.mode);
console.log('🌐 Base URL:', API_CONFIG.baseURL);
