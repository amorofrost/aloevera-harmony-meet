/**
 * Thin typed wrapper around <c>window.Telegram.WebApp</c>, injected by
 * <c>telegram-web-app.js</c> (loaded from index.html) when the SPA runs inside a Telegram client.
 * Outside Telegram, <c>window.Telegram</c> is undefined and all helpers no-op / return null.
 */

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function webApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * True when the SPA is rendered inside the Telegram WebView. We treat presence of a non-empty
 * <c>initData</c> as the real signal — <c>window.Telegram.WebApp</c> may exist on web too if
 * the script loaded, but initData is only populated by Telegram itself.
 */
export function isTelegramMiniApp(): boolean {
  const wa = webApp();
  return !!(wa && wa.initData && wa.initData.length > 0);
}

export function getInitData(): string | null {
  const wa = webApp();
  return wa?.initData || null;
}

export function getTelegramUserHint(): { firstName?: string; lastName?: string } | null {
  const u = webApp()?.initDataUnsafe?.user;
  if (!u) return null;
  return { firstName: u.first_name, lastName: u.last_name };
}

export function ready(): void {
  webApp()?.ready();
}

export function expand(): void {
  webApp()?.expand();
}

/**
 * Push Telegram's themeParams into our CSS variables so the Mini App blends with the
 * user's client theme. Safe to call unconditionally; no-op outside Telegram.
 */
export function applyTheme(): void {
  const wa = webApp();
  if (!wa || typeof document === 'undefined') return;
  const p = wa.themeParams;
  const root = document.documentElement;
  if (p.bg_color) root.style.setProperty('--tg-bg', p.bg_color);
  if (p.text_color) root.style.setProperty('--tg-text', p.text_color);
  if (p.hint_color) root.style.setProperty('--tg-hint', p.hint_color);
  if (p.button_color) root.style.setProperty('--tg-button', p.button_color);
  if (p.button_text_color) root.style.setProperty('--tg-button-text', p.button_text_color);
  root.dataset.tgColorScheme = wa.colorScheme;
}
