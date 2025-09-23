// API configuration and client
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://20.153.164.3:5002';

// Custom fetch wrapper that handles API calls
// For development with self-signed certificates, the browser will show a warning
// that users need to accept once by visiting the API URL directly
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      // Add credentials if needed for authentication
      credentials: 'omit', // Change to 'include' if you need cookies
      ...options,
    };

    console.log('Making API request to:', url);
    
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      return {
        error: `HTTP ${response.status}: ${errorText || response.statusText}`
      };
    }

    const data = await response.json();
    console.log('API Response:', data);
    
    return { data };
  } catch (error) {
    console.error('API Request failed:', error);
    
    // Handle different types of errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        error: 'Network error: Unable to connect to backend service. If using HTTPS with self-signed certificate, please visit ' + API_BASE_URL + ' first to accept the certificate.'
      };
    }
    
    if (error instanceof Error && error.message.includes('certificate')) {
      return {
        error: 'SSL Certificate error: Please visit ' + API_BASE_URL + ' in your browser and accept the self-signed certificate first.'
      };
    }
    
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Health check endpoint
export async function checkBackendHealth() {
  return apiRequest<{
    status: string;
    timestamp: string;
    version?: string;
    environment?: string;
    [key: string]: any;
  }>('/debug/health');
}

// Future API endpoints can be added here
export async function getUserProfile(userId: string) {
  return apiRequest(`/api/users/${userId}`);
}

export async function updateUserProfile(userId: string, profileData: any) {
  return apiRequest(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
}

// Export the base API function for custom requests
export { apiRequest };