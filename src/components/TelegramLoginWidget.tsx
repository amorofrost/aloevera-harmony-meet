import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient, authApi, isApiMode } from '@/services/api';
import { toast } from '@/components/ui/sonner';
import { showApiError } from '@/lib/apiError';
import { useNavigate } from 'react-router-dom';

/** Payload from https://core.telegram.org/widgets/login */
export interface TelegramWidgetUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

interface TelegramLoginWidgetProps {
  disabled?: boolean;
  onSuccess?: () => void;
  /**
   * Override what happens on a pending (unknown Telegram id) response. Defaults to navigating
   * to <c>/welcome/telegram</c> with the ticket. Used by <c>/settings</c> → "Link Telegram" to
   * redeem the ticket against the current account instead of starting a signup flow.
   */
  onPending?: (result: { ticket: string; telegram: { id: number; firstName: string; lastName?: string | null; username?: string | null; photoUrl?: string | null; } }) => void;
}

/**
 * Renders the official Telegram Login button (script from telegram.org).
 * Bot username comes from GET /api/v1/auth/telegram-login-config or VITE_TELEGRAM_BOT_USERNAME.
 */
export function TelegramLoginWidget({ disabled, onSuccess, onPending }: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleTelegramUser = useCallback(
    async (user: TelegramWidgetUser) => {
      if (!isApiMode()) {
        toast.error('Telegram sign-in requires API mode (set VITE_API_MODE=api).');
        return;
      }
      try {
        const result = await authApi.telegramLogin(user);
        if (!result.success || !result.data) {
          const msg = (result as { error?: { message?: string } }).error?.message ?? 'Telegram sign-in failed';
          toast.error(msg);
          return;
        }

        const payload = result.data;
        if (payload.status === 'pending') {
          if (!payload.ticket || !payload.telegram) {
            toast.error('Telegram sign-in failed');
            return;
          }
          if (onPending) {
            onPending({ ticket: payload.ticket, telegram: payload.telegram });
            return;
          }
          // Default: route to /welcome/telegram so the user can either link an existing
          // account or create a new one.
          navigate('/welcome/telegram', {
            state: { ticket: payload.ticket, telegram: payload.telegram },
          });
          return;
        }

        if (!payload.auth) {
          toast.error('Telegram sign-in failed');
          return;
        }
        apiClient.setAccessToken(payload.auth.accessToken);
        if (payload.auth.refreshToken) {
          apiClient.setRefreshToken(payload.auth.refreshToken);
        }
        toast.success('Signed in with Telegram');
        onSuccess?.();
        navigate('/friends');
      } catch (err) {
        showApiError(err, 'Telegram sign-in failed');
      }
    },
    [navigate, onSuccess, onPending]
  );

  useEffect(() => {
    const envName = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
    if (envName?.trim()) {
      setBotUsername(envName.trim());
      setLoading(false);
      return;
    }

    if (!isApiMode()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    authApi
      .getTelegramLoginConfig()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.botUsername?.trim()) {
          setBotUsername(res.data.botUsername.trim());
        }
      })
      .catch(() => {
        /* optional endpoint */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!botUsername || disabled || loading) return;
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = '';
    window.onTelegramAuth = (user: TelegramWidgetUser) => {
      void handleTelegramUser(user);
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    el.appendChild(script);

    return () => {
      el.innerHTML = '';
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, [botUsername, disabled, loading, handleTelegramUser]);

  if (loading) {
    return (
      <div className="flex justify-center py-1">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  if (!botUsername) {
    return (
      <p className="text-xs text-white/50 text-center">
        Set <code className="text-white/70">Telegram:BotUsername</code> and{' '}
        <code className="text-white/70">TELEGRAM_BOT_TOKEN</code> on the API to enable Telegram sign-in.
      </p>
    );
  }

  return <div ref={containerRef} className="flex justify-center min-h-[40px]" />;
}
