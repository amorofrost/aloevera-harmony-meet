// src/services/api/apiClient.ts
import { API_CONFIG, isApiMode } from '@/config/api.config';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

// Auth endpoints that should never trigger a token refresh attempt
const AUTH_ENDPOINTS = ['/auth/refresh', '/auth/login', '/auth/register'];

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private isRefreshing = false;
  private refreshQueue: Array<(newToken: string | null) => void> = [];

  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.timeout = API_CONFIG.timeout;
  }

  private buildHeaders(extraHeaders?: HeadersInit): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extraHeaders as Record<string, string> || {}),
    };
    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Attempt to refresh using the stored refresh token.
  // Returns the new access token on success, null on failure.
  private async attemptTokenRefresh(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return null;
      }

      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        this.setAccessToken(data.data.accessToken);
        if (data.data.refreshToken) {
          this.setRefreshToken(data.data.refreshToken);
        }
        return data.data.accessToken;
      }

      this.clearTokens();
      return null;
    } catch {
      this.clearTokens();
      return null;
    }
  }

  // Coordinate concurrent 401 responses — only one refresh call flies at a time.
  // Other callers wait in the queue and receive the result.
  private handleUnauthorized(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise<string | null>(resolve => {
        this.refreshQueue.push(resolve);
      });
    }

    this.isRefreshing = true;
    return this.attemptTokenRefresh().then(newToken => {
      this.isRefreshing = false;
      this.refreshQueue.forEach(resolve => resolve(newToken));
      this.refreshQueue = [];
      return newToken;
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const isAuthEndpoint = AUTH_ENDPOINTS.some(e => endpoint.includes(e));

    const config: RequestInit = {
      ...options,
      headers: this.buildHeaders(options.headers),
      credentials: 'include',
    };

    try {
      const response = await this.fetchWithTimeout(url, config);

      if (response.status === 401 && !isAuthEndpoint) {
        const newToken = await this.handleUnauthorized();

        if (newToken) {
          // Retry the original request with the fresh token
          const retryConfig: RequestInit = {
            ...config,
            headers: {
              ...(config.headers as Record<string, string>),
              Authorization: `Bearer ${newToken}`,
            },
          };
          try {
            const retryResponse = await this.fetchWithTimeout(url, retryConfig);
            if (!retryResponse.ok) {
              const errBody = await retryResponse.json().catch(() => ({}));
              return {
                success: false,
                error: errBody.error || { code: `HTTP_${retryResponse.status}`, message: retryResponse.statusText },
                timestamp: new Date().toISOString(),
              };
            }
            return retryResponse.json();
          } catch {
            return {
              success: false,
              error: { code: 'RETRY_FAILED', message: 'Request failed after token refresh' },
              timestamp: new Date().toISOString(),
            };
          }
        }

        // Refresh failed — redirect to login
        window.location.href = '/';
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
          timestamp: new Date().toISOString(),
        };
      }

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errBody.error || { code: `HTTP_${response.status}`, message: response.statusText },
          timestamp: new Date().toISOString(),
        };
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: { code: 'TIMEOUT', message: 'Request timeout' },
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: error.message || 'Network request failed' },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // ── Token management (localStorage) ──────────────────────────────────────

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  setAccessToken(token: string) {
    localStorage.setItem('access_token', token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  setRefreshToken(token: string) {
    localStorage.setItem('refresh_token', token);
  }

  /** Remove only the access token (e.g. on expiry detection before a refresh). */
  clearAccessToken() {
    localStorage.removeItem('access_token');
  }

  /** Remove both tokens — call on explicit sign-out or when refresh fails. */
  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  /**
   * Public helper used by ProtectedRoute to proactively refresh when the
   * stored access token is missing or near expiry.
   * Returns true if a fresh access token is now available.
   */
  async refreshAccessToken(): Promise<boolean> {
    const newToken = await this.attemptTokenRefresh();
    return newToken !== null;
  }
}

export const apiClient = new ApiClient();

// Helper to check if we're in API mode
export { isApiMode, isMockMode } from '@/config/api.config';
