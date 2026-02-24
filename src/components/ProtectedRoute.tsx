import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isMockMode } from '@/config/api.config';
import { apiClient } from '@/services/api/apiClient';

type TokenStatus = 'valid' | 'near-expiry' | 'expired' | 'missing';

function getTokenStatus(): TokenStatus {
  const token = localStorage.getItem('access_token');
  if (!token) return 'missing';

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return 'valid';

    const msUntilExpiry = payload.exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      localStorage.removeItem('access_token');
      return 'expired';
    }
    // Proactively refresh within the last 5 minutes of the access token lifetime
    if (msUntilExpiry < 5 * 60 * 1000) return 'near-expiry';
    return 'valid';
  } catch {
    localStorage.removeItem('access_token');
    return 'missing';
  }
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');

  useEffect(() => {
    // In mock mode there is no backend — always allow
    if (isMockMode()) {
      setAuthState('authenticated');
      return;
    }

    const status = getTokenStatus();

    if (status === 'valid') {
      setAuthState('authenticated');
      return;
    }

    if (status === 'near-expiry') {
      // Token is still valid, let the user through immediately. Refresh in background
      // so the next request won't hit a 401.
      setAuthState('authenticated');
      apiClient.refreshAccessToken(); // fire-and-forget
      return;
    }

    // Token is expired or missing — try refresh if we have a refresh token
    const hasRefreshToken = Boolean(localStorage.getItem('refresh_token'));
    if (!hasRefreshToken) {
      setAuthState('unauthenticated');
      return;
    }

    // Attempt silent refresh (shows a loading state while waiting)
    apiClient.refreshAccessToken().then(success => {
      setAuthState(success ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  if (authState === 'checking') {
    // Brief loading indicator while the refresh is in flight
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
