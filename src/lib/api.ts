// API configuration and helper functions
const API_BASE_URL = 'https://20.153.164.3:5002';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      // For development with self-signed certificates
      mode: 'cors',
    };

    try {
      const response = await fetch(url, {
        ...defaultOptions,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // Enhanced error handling for common development issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(
          `Network error: Cannot connect to ${url}. ` +
          `This might be due to:\n` +
          `1. CORS policy blocking the request\n` +
          `2. Self-signed HTTPS certificate not trusted by browser\n` +
          `3. Backend server not running\n` +
          `4. Firewall blocking the connection\n\n` +
          `For self-signed certificates, try visiting ${this.baseUrl} directly in your browser first to accept the certificate.`
        );
      }
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create a default API client instance
export const apiClient = new ApiClient();

// Debug API functions
export const debugApi = {
  health: () => apiClient.get('/debug/health'),
};