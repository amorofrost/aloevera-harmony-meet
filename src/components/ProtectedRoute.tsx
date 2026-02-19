import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isMockMode } from '@/config/api.config';

function hasValidToken(): boolean {
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  // Basic JWT expiry check — parse the payload without a library
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('access_token');
      return false;
    }
  } catch {
    // Token is malformed — treat as invalid
    localStorage.removeItem('access_token');
    return false;
  }

  return true;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();

  // In mock mode there is no backend, so always allow access
  if (isMockMode()) {
    return <>{children}</>;
  }

  if (!hasValidToken()) {
    // Preserve the intended destination so we can redirect back after login
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
