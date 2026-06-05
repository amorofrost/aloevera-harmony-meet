import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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
    Telegram?: {
      Login?: {
        /**
         * Legacy programmatic auth — opens the Telegram OAuth popup and calls back with the
         * signed user object (or `false` if the user closes it). Same payload the iframe widget
         * produces, so the existing backend HMAC verifier handles it unchanged.
         */
        auth: (
          options: { bot_id: number; request_access?: string; lang?: string },
          callback: (user: TelegramWidgetUser | false) => void,
        ) => void;
      };
    };
  }
}

interface TelegramLoginWidgetProps {
  disabled?: boolean;
  onSuccess?: () => void;
  redirectTo?: string;
  /**
   * Override what happens on a pending (unknown Telegram id) response. Defaults to navigating
   * to <c>/welcome/telegram</c> with the ticket. Used by <c>/settings</c> → "Link Telegram" to
   * redeem the ticket against the current account instead of starting a signup flow.
   */
  onPending?: (result: { ticket: string; telegram: { id: number; firstName: string; lastName?: string | null; username?: string | null; photoUrl?: string | null; } }) => void;
}

const TELEGRAM_WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';

// Load telegram-widget.js once (module-level, dedup across instances). The script registers
// window.Telegram.Login.auth; we don't render its iframe widget — we drive auth from our own button.
let telegramScriptPromise: Promise<void> | null = null;
function loadTelegramScript(): Promise<void> {
  if (telegramScriptPromise) return telegramScriptPromise;
  telegramScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TELEGRAM_WIDGET_SRC}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = TELEGRAM_WIDGET_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      telegramScriptPromise = null; // allow retry on next attempt
      reject(new Error('Failed to load Telegram widget script'));
    };
    document.head.appendChild(script);
  });
  return telegramScriptPromise;
}

/** Telegram paper-plane glyph (so the round button is brand-recognisable). */
function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

/**
 * Round Telegram sign-in icon button. Uses the legacy `Telegram.Login.auth({ bot_id })` flow so it
 * keeps the existing backend verifier, while matching the Google icon in the social-login row.
 * bot_id comes from GET /api/v1/auth/telegram-login-config (or VITE_TELEGRAM_BOT_ID).
 */
export function TelegramLoginWidget({ disabled, onSuccess, onPending, redirectTo }: TelegramLoginWidgetProps) {
  const [botId, setBotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
        navigate(redirectTo ?? '/friends');
      } catch (err) {
        showApiError(err, 'Telegram sign-in failed');
      }
    },
    [navigate, onSuccess, onPending, redirectTo]
  );

  useEffect(() => {
    const envId = (import.meta.env.VITE_TELEGRAM_BOT_ID as string | undefined)?.trim();
    if (envId) {
      setBotId(envId);
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
        if (res.success && res.data?.botId?.trim()) {
          setBotId(res.data.botId.trim());
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

  // Warm the script as soon as we know we'll need it, so the first click is instant.
  useEffect(() => {
    if (botId) loadTelegramScript().catch(() => { /* surfaced on click */ });
  }, [botId]);

  const handleClick = useCallback(async () => {
    if (!isApiMode()) {
      toast.error('Telegram sign-in requires API mode (set VITE_API_MODE=api).');
      return;
    }
    if (!botId) return;
    setBusy(true);
    try {
      await loadTelegramScript();
      const login = window.Telegram?.Login;
      if (!login?.auth) {
        toast.error('Telegram sign-in failed to load. Please try again.');
        return;
      }
      login.auth({ bot_id: Number(botId), request_access: 'write' }, (user) => {
        // user === false → the user closed the popup; stay silent.
        if (user) void handleTelegramUser(user);
      });
    } catch (err) {
      showApiError(err, 'Telegram sign-in failed');
    } finally {
      setBusy(false);
    }
  }, [botId, handleTelegramUser]);

  if (loading) {
    return <div className="h-11 w-11 rounded-full bg-white/10 border border-white/20 animate-pulse" />;
  }

  if (!botId) {
    return (
      <div
        className="h-11 w-11 rounded-full bg-white/5 border border-dashed border-white/30 text-white/50 text-[10px] flex items-center justify-center text-center"
        title="Set Telegram:BotToken + Telegram:BotUsername on the API to enable Telegram sign-in."
      >
        TG?
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      aria-label="Sign in with Telegram"
      title="Sign in with Telegram"
      className="h-11 w-11 rounded-full bg-[#229ED9] hover:bg-[#1c8dc2] active:scale-95 transition-transform flex items-center justify-center shadow disabled:opacity-50 disabled:pointer-events-none"
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      ) : (
        <TelegramGlyph className="h-5 w-5 text-white" />
      )}
    </button>
  );
}
