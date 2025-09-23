import { useState, useCallback } from 'react';

// Generic hook for API calls with loading state
export function useApiCall<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async (apiFunction: () => Promise<{ data?: T; error?: string }>) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await apiFunction();
      
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data || null);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    error,
    loading,
    execute,
    reset
  };
}

// Specific hook for health check
export function useHealthCheck() {
  return useApiCall<{
    status: string;
    timestamp: string;
    version?: string;
    environment?: string;
    [key: string]: any;
  }>();
}