import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi } from '@/services/api/authApi';
import { Check, HelpCircle, Loader2, X } from 'lucide-react';

type Status = 'idle' | 'checking' | 'available' | 'invalidFormat' | 'reserved' | 'taken';
type Variant = 'hero' | 'plain';

interface AccountNameInputProps {
  value: string;
  onChange: (v: string) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  prefillSuggestion?: string;
  id?: string;
  /**
   * Visual variant. `hero` (default) renders white text + translucent input
   * on the dark hero-background of the Welcome forms. `plain` renders with
   * standard theme colors so the field is visible on a regular `bg-background`
   * surface (e.g. the Telegram Mini App entry).
   */
  variant?: Variant;
}

const FORMAT_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const RESERVED = new Set([
  'admin', 'root', 'system', 'support', 'help', 'api', 'auth', 'login', 'logout',
  'register', 'settings', 'profile', 'user', 'users', 'me', 'you', 'search', 'feed',
  'friends', 'talks', 'aloevera', 'aloeve', 'aloeband', 'telegram', 'google',
  'official', 'mod', 'moderator', 'staff', 'undefined', 'null', 'anonymous', 'bot',
]);

export function AccountNameInput({
  value,
  onChange,
  onValidityChange,
  disabled,
  prefillSuggestion,
  id = 'accountName',
  variant = 'hero',
}: AccountNameInputProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>('idle');

  const isHero = variant === 'hero';
  const labelRowClass = isHero
    ? 'flex items-center justify-center gap-1.5'
    : 'flex items-center gap-1.5';
  const labelClass = isHero ? 'text-white font-medium' : 'font-medium';
  const infoBtnClass = isHero
    ? 'text-white/70 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full'
    : 'text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full';
  const inputClass = isHero
    ? 'bg-white/20 border-white/30 text-white placeholder:text-white/60'
    : '';
  const hintClass = isHero ? 'text-xs text-white/60' : 'text-xs text-muted-foreground';
  const abortRef = useRef<AbortController | null>(null);
  const prefillApplied = useRef(false);

  // Prefill once if empty.
  useEffect(() => {
    if (!prefillApplied.current && !value && prefillSuggestion) {
      const sanitized = prefillSuggestion.replace(/[^A-Za-z0-9_]/g, '');
      if (FORMAT_RE.test(sanitized)) onChange(sanitized);
      prefillApplied.current = true;
    }
  }, [prefillSuggestion, value, onChange]);

  // Debounced live check.
  useEffect(() => {
    onValidityChange?.(false);
    if (!value) {
      setStatus('idle');
      return;
    }
    if (!FORMAT_RE.test(value)) {
      setStatus('invalidFormat');
      return;
    }
    if (RESERVED.has(value.toLowerCase())) {
      setStatus('reserved');
      return;
    }

    setStatus('checking');
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await authApi.checkAccountNameAvailability(value);
        if (abortRef.current?.signal.aborted) return;
        if (result.available) {
          setStatus('available');
          onValidityChange?.(true);
        } else {
          setStatus((result.reason ?? 'taken') as Status);
        }
      } catch {
        setStatus('idle');
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [value, onValidityChange]);

  return (
    <div className="space-y-2">
      <div className={labelRowClass}>
        <Label htmlFor={id} className={labelClass}>
          {t('auth.accountName')} *
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('auth.accountNameInfo')}
              className={infoBtnClass}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-sm leading-relaxed">
            {t('auth.accountNameInfo')}
          </PopoverContent>
        </Popover>
      </div>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={t('auth.accountNamePlaceholder')}
        className={inputClass}
      />
      <p className={hintClass}>{t('auth.accountNameHint')}</p>
      <StatusRow status={status} t={t} variant={variant} />
    </div>
  );
}

function StatusRow({
  status,
  t,
  variant,
}: {
  status: Status;
  t: (k: string) => string;
  variant: Variant;
}) {
  if (status === 'idle') return null;
  const isHero = variant === 'hero';

  if (status === 'checking') {
    return (
      <p className={`text-xs flex items-center gap-1 ${isHero ? 'text-white/70' : 'text-muted-foreground'}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {t('auth.accountNameChecking')}
      </p>
    );
  }

  if (status === 'available') {
    return (
      <p className={`text-xs flex items-center gap-1 ${isHero ? 'text-green-300' : 'text-green-600'}`}>
        <Check className="w-3 h-3" />
        {t('auth.accountNameAvailable')}
      </p>
    );
  }

  const msgKey =
    status === 'invalidFormat'
      ? 'auth.accountNameInvalid'
      : status === 'reserved'
        ? 'auth.accountNameReserved'
        : 'auth.accountNameTaken';

  return (
    <p role="alert" className={`text-xs flex items-center gap-1 ${isHero ? 'text-red-300' : 'text-destructive'}`}>
      <X className="w-3 h-3" />
      {t(msgKey)}
    </p>
  );
}
