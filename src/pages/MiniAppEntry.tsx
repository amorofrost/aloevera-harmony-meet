import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi, apiClient } from '@/services/api';
import appIcon from '@/assets/app-icon.jpg';
import { toast } from '@/components/ui/sonner';
import { showApiError } from '@/lib/apiError';
import { navigateAfterAuth } from '@/lib/authNavigation';
import {
  telegramRegisterSchema,
  telegramRegisterSchemaWithInvite,
  telegramLinkLoginSchema,
  type TelegramRegisterSchema,
  type TelegramLinkLoginSchema,
} from '@/lib/validators';
import {
  getInitData,
  getTelegramUserHint,
  isTelegramMiniApp,
  ready,
  expand,
  applyTheme,
} from '@/lib/telegramWebApp';
import type { TelegramUserInfo } from '@/services/api/authApi';

type Phase = 'initializing' | 'choose' | 'link' | 'create' | 'error';

/**
 * Entry point for the Telegram Mini App (mounted at <c>/tg</c>). On mount it calls
 * <c>window.Telegram.WebApp.ready()</c>, reads the signed <c>initData</c>, and posts it to
 * <c>/auth/telegram-miniapp-login</c>. Known Telegram ids are signed in and redirected to
 * <c>/friends</c>; unknown ids render an inline profile wizard / link-account prompt so the
 * user never leaves the Telegram client.
 */
const MiniAppEntry: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [phase, setPhase] = useState<Phase>('initializing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [telegram, setTelegram] = useState<TelegramUserInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initDataRef = useRef<string>('');

  const requireInviteRef = useRef(false);
  const [requireInvite, setRequireInvite] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

  const linkForm = useForm<TelegramLinkLoginSchema>({
    resolver: zodResolver(telegramLinkLoginSchema),
  });

  const hint = getTelegramUserHint();
  const registerForm = useForm<TelegramRegisterSchema>({
    resolver: async (values, ctx, opts) => {
      const schema = requireInviteRef.current ? telegramRegisterSchemaWithInvite : telegramRegisterSchema;
      return zodResolver(schema)(values, ctx, opts);
    },
    defaultValues: {
      name: [hint?.firstName, hint?.lastName].filter(Boolean).join(' ').trim(),
      bio: '',
      location: '',
      gender: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    ready();
    expand();
    applyTheme();

    if (!isTelegramMiniApp()) {
      setErrorMsg('This page only works inside the Telegram client. Open the Mini App from the bot to continue.');
      setPhase('error');
      return;
    }

    const initData = getInitData() || '';
    initDataRef.current = initData;

    (async () => {
      try {
        const res = await authApi.miniAppLogin(initData);
        if (!res.success || !res.data) {
          const err = (res as any).error;
          setErrorMsg(err?.message || 'Could not verify Telegram login.');
          setPhase('error');
          return;
        }
        if (res.data.status === 'signedIn' && res.data.auth) {
          apiClient.setAccessToken(res.data.auth.accessToken);
          if (res.data.auth.refreshToken) apiClient.setRefreshToken(res.data.auth.refreshToken);
          navigateAfterAuth(navigate, res.data.auth.user);
          return;
        }
        // needsRegistration
        setTelegram(res.data.telegram ?? null);
        if (res.data.telegram) {
          const prefill = [res.data.telegram.firstName, res.data.telegram.lastName].filter(Boolean).join(' ').trim();
          if (prefill && !registerForm.getValues('name')) registerForm.setValue('name', prefill);
        }
        setPhase('choose');
      } catch (err) {
        console.error(err);
        setErrorMsg('Mini app login failed.');
        setPhase('error');
      }
    })();
    // We only want to run this once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'create') return;
    setConfigLoading(true);
    authApi
      .getRegistrationConfig()
      .then((res) => {
        if (res.success && res.data) {
          requireInviteRef.current = res.data.requireEventInvite;
          setRequireInvite(res.data.requireEventInvite);
        }
      })
      .catch(() => {
        console.error('Failed to fetch registration config');
      })
      .finally(() => setConfigLoading(false));
  }, [phase]);

  const handleLink = linkForm.handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      const res = await authApi.miniAppLinkLogin({
        initData: initDataRef.current,
        email: data.email,
        password: data.password,
      });
      if (!res.success || !res.data) {
        const err = (res as any).error;
        linkForm.setError('root', { message: err?.message || 'Could not link Telegram to that account' });
        return;
      }
      apiClient.setAccessToken(res.data.accessToken);
      if (res.data.refreshToken) apiClient.setRefreshToken(res.data.refreshToken);
      toast.success('Telegram linked to your account');
      navigateAfterAuth(navigate, res.data.user);
    } catch (err) {
      showApiError(err, 'Could not link Telegram');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleCreate = registerForm.handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      const res = await authApi.miniAppRegister({
        initData: initDataRef.current,
        name: data.name,
        age: data.age,
        location: data.location,
        gender: data.gender,
        bio: data.bio,
        inviteCode: data.inviteCode?.trim() || undefined,
      });
      if (!res.success || !res.data) {
        const err = (res as any).error;
        if (err?.code === 'INVALID_INVITE_CODE') {
          registerForm.setError('inviteCode', { message: err.message || 'Invalid invite code' });
          return;
        }
        if (err?.code === 'INVITE_REQUIRED') {
          registerForm.setError('inviteCode', { message: err.message || 'Invite code is required' });
          return;
        }
        showApiError(res, 'Mini app registration failed');
        return;
      }
      apiClient.setAccessToken(res.data.accessToken);
      if (res.data.refreshToken) apiClient.setRefreshToken(res.data.refreshToken);
      toast.success('Account created!');
      navigateAfterAuth(navigate, res.data.user);
    } catch (err) {
      showApiError(err, 'Mini app registration failed');
    } finally {
      setIsSubmitting(false);
    }
  });

  if (phase === 'initializing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-sm w-full space-y-4 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const greeting = telegram?.firstName ? `Welcome, ${telegram.firstName}!` : 'Welcome!';

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-5 py-8 bg-background">
      <div className="mb-5">
        <img src={appIcon} alt="AloeVera" className="w-16 h-16 rounded-2xl shadow-lg" />
      </div>

      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-semibold">{greeting}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            We couldn't find an AloeVera account for your Telegram profile yet.
          </p>
        </div>

        {phase === 'choose' && (
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={() => setPhase('link')}>
              I already have an account
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => setPhase('create')}>
              Create a new account
            </Button>
          </div>
        )}

        {phase === 'link' && (
          <form onSubmit={handleLink} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Sign in with your email and password — Telegram will be linked to that account.
            </p>
            {linkForm.formState.errors.root && (
              <div role="alert" className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{linkForm.formState.errors.root.message}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="mini-link-email">{t('auth.email')}</Label>
              <Input
                id="mini-link-email"
                type="email"
                placeholder={t('auth.enterEmail')}
                {...linkForm.register('email')}
                disabled={isSubmitting}
              />
              {linkForm.formState.errors.email && (
                <p role="alert" className="text-xs text-destructive">
                  {linkForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mini-link-password">{t('auth.password')}</Label>
              <Input
                id="mini-link-password"
                type="password"
                placeholder={t('auth.enterPassword')}
                {...linkForm.register('password')}
                disabled={isSubmitting}
              />
              {linkForm.formState.errors.password && (
                <p role="alert" className="text-xs text-destructive">
                  {linkForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                'Sign in & link Telegram'
              )}
            </Button>
            <button
              type="button"
              onClick={() => setPhase('choose')}
              className="text-muted-foreground hover:text-foreground text-sm block w-full pt-2"
            >
              Back
            </button>
          </form>
        )}

        {phase === 'create' && (
          <>
            {configLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4" style={configLoading ? { display: 'none' } : undefined}>
              <div className="space-y-2">
                <Label htmlFor="mini-reg-name">Display Name *</Label>
                <Input
                  id="mini-reg-name"
                  type="text"
                  placeholder="Your name"
                  {...registerForm.register('name')}
                  disabled={isSubmitting}
                />
                {registerForm.formState.errors.name && (
                  <p role="alert" className="text-xs text-destructive">
                    {registerForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="mini-age">{t('auth.age')} *</Label>
                  <Input
                    id="mini-age"
                    type="number"
                    placeholder={t('auth.age')}
                    {...registerForm.register('age', { valueAsNumber: true })}
                    disabled={isSubmitting}
                  />
                  {registerForm.formState.errors.age && (
                    <p role="alert" className="text-xs text-destructive">
                      {registerForm.formState.errors.age.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mini-gender">{t('auth.gender')} *</Label>
                  <Controller
                    name="gender"
                    control={registerForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t('auth.male')}</SelectItem>
                          <SelectItem value="female">{t('auth.female')}</SelectItem>
                          <SelectItem value="other">{t('auth.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {registerForm.formState.errors.gender && (
                    <p role="alert" className="text-xs text-destructive">
                      {registerForm.formState.errors.gender.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mini-location">{t('auth.location')} *</Label>
                <Input
                  id="mini-location"
                  placeholder={t('auth.cityCountry')}
                  {...registerForm.register('location')}
                  disabled={isSubmitting}
                />
                {registerForm.formState.errors.location && (
                  <p role="alert" className="text-xs text-destructive">
                    {registerForm.formState.errors.location.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mini-invite">
                  {t('register.inviteCode')}
                  {requireInvite ? ' *' : ` (${t('register.inviteCodeOptional')})`}
                </Label>
                <p className="text-xs text-muted-foreground">{t('register.inviteCodeHint')}</p>
                <Input
                  id="mini-invite"
                  autoComplete="off"
                  placeholder={t('register.inviteCodePlaceholder')}
                  {...registerForm.register('inviteCode')}
                  disabled={isSubmitting || configLoading}
                />
                {registerForm.formState.errors.inviteCode && (
                  <p role="alert" className="text-xs text-destructive">
                    {registerForm.formState.errors.inviteCode.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mini-bio">{t('auth.bio')}</Label>
                <Textarea
                  id="mini-bio"
                  placeholder={t('auth.aboutYourself')}
                  {...registerForm.register('bio')}
                  className="min-h-[80px]"
                  disabled={isSubmitting}
                />
                {registerForm.formState.errors.bio && (
                  <p role="alert" className="text-xs text-destructive">
                    {registerForm.formState.errors.bio.message}
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                You can add an email and password later in Settings.
              </p>

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  t('auth.createAccount')
                )}
              </Button>
              <button
                type="button"
                onClick={() => setPhase('choose')}
                className="text-muted-foreground hover:text-foreground text-sm block w-full pt-2"
              >
                Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default MiniAppEntry;
