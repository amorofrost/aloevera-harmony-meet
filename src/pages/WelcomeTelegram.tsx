import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
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
import heroBg from '@/assets/hero-bg.jpg';
import appIcon from '@/assets/app-icon.jpg';
import { toast } from '@/components/ui/sonner';
import { showApiError } from '@/lib/apiError';
import {
  telegramRegisterSchema,
  telegramRegisterSchemaWithInvite,
  telegramLinkLoginSchema,
  type TelegramRegisterSchema,
  type TelegramLinkLoginSchema,
} from '@/lib/validators';
import type { TelegramUserInfo } from '@/services/api/authApi';

type NavState = { ticket: string; telegram: TelegramUserInfo };

type Mode = 'choose' | 'link' | 'create';

const WelcomeTelegram: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const state = location.state as NavState | null;
  if (!state?.ticket || !state?.telegram) {
    return <Navigate to="/" replace />;
  }

  const { ticket, telegram } = state;
  const [mode, setMode] = useState<Mode>('choose');
  const [isLoading, setIsLoading] = useState(false);

  // Register-form invite gate, same pattern as Welcome.tsx
  const requireInviteRef = useRef(false);
  const [requireInvite, setRequireInvite] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

  const linkForm = useForm<TelegramLinkLoginSchema>({
    resolver: zodResolver(telegramLinkLoginSchema),
  });

  const registerForm = useForm<TelegramRegisterSchema>({
    resolver: async (values, ctx, opts) => {
      const schema = requireInviteRef.current ? telegramRegisterSchemaWithInvite : telegramRegisterSchema;
      return zodResolver(schema)(values, ctx, opts);
    },
    defaultValues: {
      name: [telegram.firstName, telegram.lastName].filter(Boolean).join(' ').trim(),
      bio: '',
      location: '',
      gender: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (mode !== 'create') return;
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
        // fail open — field hidden, registration still usable
        console.error('Failed to fetch registration config');
      })
      .finally(() => setConfigLoading(false));
  }, [mode]);

  const handleLink = linkForm.handleSubmit(async (data) => {
    setIsLoading(true);
    try {
      const res = await authApi.telegramLinkLogin({
        email: data.email,
        password: data.password,
        ticket,
      });
      if (!res.success || !res.data) {
        const err = (res as any).error;
        const msg = err?.message || 'Could not link Telegram to that account';
        linkForm.setError('root', { message: msg });
        return;
      }
      apiClient.setAccessToken(res.data.accessToken);
      if (res.data.refreshToken) apiClient.setRefreshToken(res.data.refreshToken);
      toast.success('Telegram linked to your account');
      navigate('/friends');
    } catch (err) {
      showApiError(err, 'Could not link Telegram');
    } finally {
      setIsLoading(false);
    }
  });

  const handleCreate = registerForm.handleSubmit(async (data) => {
    setIsLoading(true);
    try {
      const res = await authApi.telegramRegister({
        ticket,
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
        showApiError(res, 'Telegram registration failed');
        return;
      }
      apiClient.setAccessToken(res.data.accessToken);
      if (res.data.refreshToken) apiClient.setRefreshToken(res.data.refreshToken);
      toast.success('Account created!');
      navigate('/friends');
    } catch (err) {
      showApiError(err, 'Telegram registration failed');
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 hero-gradient opacity-80"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-10 text-center">
        <div className="mb-6 floating">
          <img src={appIcon} alt="AloeVera Dating" className="w-20 h-20 rounded-3xl shadow-2xl glow" />
        </div>

        <div className="w-full max-w-md">
          <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div>
              <h2 className="text-2xl font-bold text-white">Welcome, {telegram.firstName}!</h2>
              <p className="text-sm text-white/70 mt-2">
                We couldn't find an AloeVera account for your Telegram profile yet.
              </p>
            </div>

            {mode === 'choose' && (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                  onClick={() => setMode('link')}
                >
                  I already have an account
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white text-lg py-4 rounded-2xl font-semibold"
                  onClick={() => setMode('create')}
                >
                  Create a new account
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-white/60 hover:text-white/80 text-xs block w-full pt-2"
                >
                  Cancel
                </button>
              </div>
            )}

            {mode === 'link' && (
              <form onSubmit={handleLink} className="space-y-4 text-left">
                <p className="text-sm text-white/80 text-center">
                  Sign in with your email and password — Telegram will be linked to that account.
                </p>
                {linkForm.formState.errors.root && (
                  <div role="alert" className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
                    <div className="flex items-center gap-2 text-white">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">{linkForm.formState.errors.root.message}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="tg-link-email" className="text-white font-medium">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="tg-link-email"
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    {...linkForm.register('email')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  {linkForm.formState.errors.email && (
                    <p role="alert" className="text-xs text-red-300">
                      {linkForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tg-link-password" className="text-white font-medium">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="tg-link-password"
                    type="password"
                    placeholder={t('auth.enterPassword')}
                    {...linkForm.register('password')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  {linkForm.formState.errors.password && (
                    <p role="alert" className="text-xs text-red-300">
                      {linkForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    'Sign in & link Telegram'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="text-white/70 hover:text-white text-sm block w-full pt-2"
                >
                  Back
                </button>
              </form>
            )}

            {mode === 'create' && (
              <>
                {configLoading && (
                  <div className="flex justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
                <form
                  onSubmit={handleCreate}
                  className="space-y-4 text-left"
                  style={configLoading ? { display: 'none' } : undefined}
                >
                  <div className="space-y-2">
                    <Label htmlFor="tg-reg-name" className="text-white font-medium">Display Name *</Label>
                    <Input
                      id="tg-reg-name"
                      type="text"
                      placeholder="Your name"
                      {...registerForm.register('name')}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                      disabled={isLoading}
                    />
                    {registerForm.formState.errors.name && (
                      <p role="alert" className="text-xs text-red-300">
                        {registerForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tg-age" className="text-white font-medium">{t('auth.age')} *</Label>
                      <Input
                        id="tg-age"
                        type="number"
                        placeholder={t('auth.age')}
                        {...registerForm.register('age', { valueAsNumber: true })}
                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                        disabled={isLoading}
                      />
                      {registerForm.formState.errors.age && (
                        <p role="alert" className="text-xs text-red-300">
                          {registerForm.formState.errors.age.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tg-gender" className="text-white font-medium">{t('auth.gender')} *</Label>
                      <Controller
                        name="gender"
                        control={registerForm.control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                            <SelectTrigger className="bg-white/20 border-white/30 text-white">
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
                        <p role="alert" className="text-xs text-red-300">
                          {registerForm.formState.errors.gender.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-location" className="text-white font-medium">{t('auth.location')} *</Label>
                    <Input
                      id="tg-location"
                      placeholder={t('auth.cityCountry')}
                      {...registerForm.register('location')}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                      disabled={isLoading}
                    />
                    {registerForm.formState.errors.location && (
                      <p role="alert" className="text-xs text-red-300">
                        {registerForm.formState.errors.location.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-invite" className="text-white font-medium">
                      {t('register.inviteCode')}
                      {requireInvite ? ' *' : ` (${t('register.inviteCodeOptional')})`}
                    </Label>
                    <p className="text-xs text-white/70 text-left">{t('register.inviteCodeHint')}</p>
                    <Input
                      id="tg-invite"
                      autoComplete="off"
                      placeholder={t('register.inviteCodePlaceholder')}
                      {...registerForm.register('inviteCode')}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                      disabled={isLoading || configLoading}
                    />
                    {registerForm.formState.errors.inviteCode && (
                      <p role="alert" className="text-xs text-red-300">
                        {registerForm.formState.errors.inviteCode.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-bio" className="text-white font-medium">{t('auth.bio')}</Label>
                    <Textarea
                      id="tg-bio"
                      placeholder={t('auth.aboutYourself')}
                      {...registerForm.register('bio')}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 min-h-[80px]"
                      disabled={isLoading}
                    />
                    {registerForm.formState.errors.bio && (
                      <p role="alert" className="text-xs text-red-300">
                        {registerForm.formState.errors.bio.message}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-white/60">
                    You can add an email and password later in Settings.
                  </p>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      t('auth.createAccount')
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode('choose')}
                    className="text-white/70 hover:text-white text-sm block w-full pt-2"
                  >
                    Back
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeTelegram;
