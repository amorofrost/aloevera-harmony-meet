import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi } from '@/services/api/authApi';
import { Check, HelpCircle, Loader2, X } from 'lucide-react';

type Status = 'idle' | 'checking' | 'available' | 'invalidFormat' | 'reserved' | 'taken';

interface AccountNameInputProps {
  value: string;
  onChange: (v: string) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  prefillSuggestion?: string;
  id?: string;
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
}: AccountNameInputProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>('idle');
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
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-white font-medium">
          {t('auth.accountName')} *
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('auth.accountNameInfo')}
              className="text-white/70 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full"
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
        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
      />
      <p className="text-xs text-white/60">{t('auth.accountNameHint')}</p>
      <StatusRow status={status} t={t} />
    </div>
  );
}

function StatusRow({ status, t }: { status: Status; t: (k: string) => string }) {
  if (status === 'idle') return null;

  if (status === 'checking') {
    return (
      <p className="text-xs text-white/70 flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        {t('auth.accountNameChecking')}
      </p>
    );
  }

  if (status === 'available') {
    return (
      <p className="text-xs text-green-300 flex items-center gap-1">
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
    <p role="alert" className="text-xs text-red-300 flex items-center gap-1">
      <X className="w-3 h-3" />
      {t(msgKey)}
    </p>
  );
}
