import { useCallback, useEffect, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { apiClient, authApi, isApiMode } from '@/services/api';
import { toast } from '@/components/ui/sonner';
import { showApiError } from '@/lib/apiError';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  /** "signin" | "signup" alters the Google button text/UX slightly */
  useCase?: 'signin' | 'signup';
}

/**
 * Renders the official Google Sign-In button. Requires `VITE_GOOGLE_CLIENT_ID` and/or
 * `GET /api/v1/auth/google-config` in API mode. Same Web client id must be configured on the backend
 * to validate the ID token.
 */
export function GoogleSignInButton({ disabled, useCase = 'signin' }: GoogleSignInButtonProps) {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const env = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
    if (env) {
      setClientId(env);
      return;
    }
    if (!isApiMode()) {
      setClientId('');
      return;
    }
    let cancelled = false;
    authApi
      .getGoogleConfig()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.clientId?.trim()) {
          setClientId(res.data.clientId.trim());
        } else {
          setClientId('');
        }
      })
      .catch(() => {
        if (!cancelled) setClientId('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCredential = useCallback(
    async (credential: string) => {
      if (!isApiMode()) {
        toast.error('Google sign-in requires API mode (set VITE_API_MODE=api).');
        return;
      }
      try {
        const result = await authApi.googleLogin(credential);
        if (!result.success || !result.data) {
          const msg = (result as { error?: { message?: string } }).error?.message ?? 'Google sign-in failed';
          toast.error(msg);
          return;
        }
        const data = result.data;
        if (data.status === 'signedIn' && data.auth) {
          apiClient.setAccessToken(data.auth.accessToken);
          if (data.auth.refreshToken) apiClient.setRefreshToken(data.auth.refreshToken);
          toast.success('Signed in with Google');
          navigate('/friends');
          return;
        }
        if (data.status === 'pending' && data.ticket && data.google) {
          navigate('/welcome/google', { state: { ticket: data.ticket, google: data.google } });
          return;
        }
        if (data.status === 'emailConflict') {
          toast.error(data.message || 'This email is already registered with a different sign-in method.');
          return;
        }
        toast.error('Google sign-in failed');
      } catch (err) {
        showApiError(err, 'Google sign-in failed');
      }
    },
    [navigate]
  );

  if (clientId === null) {
    return (
      <div className="h-10 w-full rounded-md bg-white/5 border border-white/20 text-white/50 text-sm flex items-center justify-center">
        …
      </div>
    );
  }
  if (clientId === '') {
    return (
      <div
        className="h-10 w-full rounded-md bg-white/5 border border-dashed border-white/30 text-white/50 text-xs flex items-center justify-center px-2 text-center"
        title="Set VITE_GOOGLE_CLIENT_ID or Google__ClientId on the API"
      >
        Google (not configured)
      </div>
    );
  }

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      <GoogleOAuthProvider clientId={clientId}>
        <div className="w-full flex justify-center [&>div]:!w-full max-w-sm mx-auto">
          <GoogleLogin
            onSuccess={(cred) => {
              if (cred.credential) void onCredential(cred.credential);
              else toast.error('Google did not return a credential');
            }}
            onError={() => {
              toast.error('Google sign-in was cancelled or failed');
            }}
            useOneTap={false}
            text={useCase === 'signup' ? 'signup_with' : 'continue_with'}
            shape="rectangular"
            size="large"
            width="320"
            theme="outline"
          />
        </div>
      </GoogleOAuthProvider>
    </div>
  );
}
