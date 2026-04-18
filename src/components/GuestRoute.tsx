import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { isMockMode } from '@/config/api.config';
import { apiClient } from '@/services/api/apiClient';

function getTokenStatus(): 'valid' | 'expired' | 'missing' {
  const token = localStorage.getItem('access_token');
  if (!token) return 'missing';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return 'valid';
    if (payload.exp * 1000 - Date.now() <= 0) {
      localStorage.removeItem('access_token');
      return 'expired';
    }
    return 'valid';
  } catch {
    localStorage.removeItem('access_token');
    return 'missing';
  }
}

interface GuestRouteProps {
  children: React.ReactNode;
}

const GuestRoute = ({ children }: GuestRouteProps) => {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'guest'>('checking');

  useEffect(() => {
    // In mock mode there is no backend — always show the welcome page
    if (isMockMode()) {
      setAuthState('guest');
      return;
    }

    const status = getTokenStatus();

    if (status === 'valid') {
      setAuthState('authenticated');
      return;
    }

    // Try silent refresh if we have a refresh token
    const hasRefreshToken = Boolean(localStorage.getItem('refresh_token'));
    if (!hasRefreshToken) {
      setAuthState('guest');
      return;
    }

    apiClient.refreshAccessToken().then(success => {
      setAuthState(success ? 'authenticated' : 'guest');
    });
  }, []);

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (authState === 'authenticated') {
    return <Navigate to="/friends" replace />;
  }

  return <>{children}</>;
};

export default GuestRoute;
