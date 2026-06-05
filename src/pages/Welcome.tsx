import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertCircle, Loader2 } from 'lucide-react';
import { authApi, apiClient } from '@/services/api';
import heroBg from '@/assets/hero-bg.jpg';
import appIcon from '@/assets/app-icon.jpg';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { loginSchema, registerSchema, registerSchemaWithInvite, type LoginSchema, type RegisterSchema } from '@/lib/validators';
import { DualLocationPicker } from '@/components/ui/dual-location-picker';
import { AccountNameInput } from '@/components/ui/account-name-input';
import { showApiError } from '@/lib/apiError';
import { navigateAfterAuth } from '@/lib/authNavigation';
import { safeRedirectFrom, inviteCodeFrom } from '@/lib/inviteRedirect';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';
import { TelegramLoginWidget } from '@/components/TelegramLoginWidget';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

const Welcome = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [searchParams] = useSearchParams();

  // Decode and validate the redirect URL set by ProtectedRoute.
  // Only accept internal paths (starts with /, no protocol) to prevent open redirect.
  const safeRedirect = safeRedirectFrom(searchParams.get('redirect') ?? '');

  // Extract the invite code from the redirect path to pre-fill the register form.
  const pendingInviteCode = inviteCodeFrom(safeRedirect);

  const loginForm = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });
  // Ref allows the resolver (captured once) to read the current requireEventInvite
  const requireEventInviteRef = useRef(false);
  const registerForm = useForm<RegisterSchema>({
    resolver: async (values, context, options) => {
      const schema = requireEventInviteRef.current ? registerSchemaWithInvite : registerSchema;
      return zodResolver(schema)(values, context, options);
    },
    mode: 'onBlur',
    defaultValues: { accountName: '', inviteCode: pendingInviteCode, country: '', region: '', secondaryCountry: '', secondaryRegion: '' },
  });
  const [showRegister, setShowRegister] = useState(false);
  const [accountNameValid, setAccountNameValid] = useState(false);
  const [requireEventInvite, setRequireEventInvite] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  useEffect(() => {
    if (!showRegister) return;
    setConfigLoading(true);
    authApi.getRegistrationConfig()
      .then((res) => {
        if (res.success && res.data) {
          requireEventInviteRef.current = res.data.requireEventInvite;
          setRequireEventInvite(res.data.requireEventInvite);
        }
      })
      .catch(() => {
        // Fail open — field hidden, registration remains usable
        console.error('Failed to fetch registration config');
      })
      .finally(() => setConfigLoading(false));
  }, [showRegister]);

  const handleLogin = loginForm.handleSubmit(async (data) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data as { email: string; password: string });
      if (!response.success) {
        const message = (response as any).error?.message || t('auth.loginFailed');
        loginForm.setError('root', { message });
        return;
      }
      if (response.data) {
        apiClient.setAccessToken(response.data.accessToken);
        if (response.data.refreshToken) {
          apiClient.setRefreshToken(response.data.refreshToken);
        }
        toast.success(t('auth.welcomeBack'));
        navigateAfterAuth(navigate, response.data.user, safeRedirect || undefined);
      }
    } catch (err) {
      showApiError(err, t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  });

  const handleRegister = registerForm.handleSubmit(async (data) => {
    setIsLoading(true);
    try {
      const response = await authApi.register({
        accountName: data.accountName,
        email: data.email,
        password: data.password,
        name: data.name,
        age: data.age,
        country: data.country,
        region: data.region,
        secondaryCountry: data.secondaryCountry,
        secondaryRegion: data.secondaryRegion,
        gender: data.gender,
        bio: data.bio,
        inviteCode: data.inviteCode?.trim() || undefined,
      });
      if (!response.success) {
        const apiErr = (response as any).error;
        if (apiErr?.code === 'ACCOUNT_NAME_TAKEN') {
          registerForm.setError('accountName', { message: apiErr.message || t('auth.accountNameTaken') });
          return;
        }
        if (apiErr?.code === 'INVALID_ACCOUNT_NAME') {
          registerForm.setError('accountName', { message: apiErr.message || t('auth.accountNameInvalid') });
          return;
        }
        if (apiErr?.code === 'EMAIL_TAKEN') {
          registerForm.setError('email', { message: apiErr.message || t('auth.emailTaken') });
          return;
        }
        if (apiErr?.code === 'INVALID_INVITE_CODE') {
          registerForm.setError('inviteCode', { message: apiErr.message || t('register.inviteCodeInvalid') });
          return;
        }
        showApiError(response, t('auth.registrationFailed'));
        return;
      }
      toast.success(t('auth.accountCreated'));
      setShowRegister(false);
    } catch (err) {
      showApiError(err, t('auth.registrationFailed'));
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 hero-gradient opacity-80"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* App Icon */}
        <div className="mb-8 floating">
          <img 
            src={appIcon} 
            alt="AloeVera Dating" 
            className="w-24 h-24 rounded-3xl shadow-2xl glow"
          />
        </div>

        {/* Hero Text */}
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            {t('welcome.title')}
          </h1>
          
          <p className="text-xl text-white/90 font-medium drop-shadow-md">
            {t('welcome.subtitle')}
          </p>
          
          {/*<p className="text-lg text-white/80 drop-shadow-md leading-relaxed">
            {t('welcome.description')}
          </p>*/}
        </div>

        {/* Login/Register Forms */}
        <div className="mt-12 w-full max-w-md">
          {pendingInviteCode && (
            <div className="mb-4 rounded-xl border border-white/30 bg-white/15 px-4 py-3 text-sm text-white backdrop-blur-sm">
              {t('invite.banner')}
            </div>
          )}
          {!showRegister ? (
            // Login Form
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">{t('auth.signIn')}</h2>

              {loginForm.formState.errors.root && (
                <div role="alert" className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
                  <div className="flex items-center gap-2 text-white">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{loginForm.formState.errors.root.message}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white font-medium">{t('auth.email')}</Label>
                  <Input id="email" type="email" placeholder={t('auth.enterEmail')}
                    {...loginForm.register('email')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading} />
                  {loginForm.formState.errors.email && (
                    <p role="alert" className="text-xs text-red-300">{t(loginForm.formState.errors.email.message)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white font-medium">{t('auth.password')}</Label>
                  <Input id="password" type="password" placeholder={t('auth.enterPassword')}
                    {...loginForm.register('password')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading} />
                  {loginForm.formState.errors.password && (
                    <p role="alert" className="text-xs text-red-300">{t(loginForm.formState.errors.password.message)}</p>
                  )}
                </div>

                <Button type="submit" size="lg"
                  className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                  disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t('auth.signingIn')}</>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>
              </form>

              <div className="space-y-3 pt-4 border-t border-white/20">
                <p className="text-white/60 text-sm text-center">{t('auth.orContinueWith')}</p>
                <div className="flex justify-center gap-3">
                  <GoogleSignInButton disabled={isLoading} useCase="signin" />
                </div>
                <p className="text-white/60 text-sm text-center">{t('auth.telegram')}</p>
                <TelegramLoginWidget disabled={isLoading} redirectTo={safeRedirect || undefined} />
              </div>

              <div className="text-center space-y-2">
                <button onClick={() => setShowRegister(true)}
                  className="text-white/80 hover:text-white underline text-sm block w-full">
                  {t('auth.noAccount')}
                </button>
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-white/60 hover:text-white/80 text-xs block w-full"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            </div>
          ) : (
            // Registration Form
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">{t('auth.createAccount')}</h2>

              {configLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              ) : null}
              <form onSubmit={handleRegister} className="space-y-4" style={configLoading ? { display: 'none' } : undefined}>
                <Controller
                  control={registerForm.control}
                  name="accountName"
                  render={({ field }) => (
                    <AccountNameInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onValidityChange={setAccountNameValid}
                      disabled={isLoading}
                    />
                  )}
                />
                {registerForm.formState.errors.accountName && (
                  <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.accountName.message)}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-white font-medium">
                    {t('auth.email')} *
                  </Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    {...registerForm.register('email')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-white/60">{t('register.emailIsLogin')}</p>
                  {registerForm.formState.errors.email && (
                    <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.email.message)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-white font-medium">
                    {t('register.displayName')} *
                  </Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder={t('register.displayNamePlaceholder')}
                    {...registerForm.register('name')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  {registerForm.formState.errors.name && (
                    <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.name.message)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-white font-medium">
                    {t('auth.password')} *
                  </Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder={t('auth.createPassword')}
                    {...registerForm.register('password')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  {(() => {
                    const pw = registerForm.watch('password') || '';
                    if (!pw) return null;
                    const rules = [
                      { test: pw.length >= 8, label: t('auth.passwordMin8') },
                      { test: /[A-Z]/.test(pw), label: t('auth.passwordUppercase') },
                      { test: /[a-z]/.test(pw), label: t('auth.passwordLowercase') },
                      { test: /[0-9]/.test(pw), label: t('auth.passwordNumber') },
                      { test: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pw), label: t('auth.passwordSpecial') },
                    ];
                    return (
                      <div className="text-xs text-white/70 space-y-1 mt-2">
                        {rules.map((r, i) =>
                          r.test ? null : (
                            <div key={i} className="flex items-center gap-1">
                              <span className="text-red-300">✗</span> {r.label}
                            </div>
                          )
                        )}
                        {rules.every(r => r.test) && (
                          <div className="flex items-center gap-1 text-green-300">
                            <span>✓</span> {t('auth.passwordValid')}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {registerForm.formState.errors.password && (
                    <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.password.message)}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age" className="text-white font-medium">
                      {t('auth.age')} <span className="font-normal opacity-70">({t('register.inviteCodeOptional')})</span>
                    </Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder={t('auth.age')}
                      {...registerForm.register('age', { valueAsNumber: true })}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                      disabled={isLoading}
                    />
                    {registerForm.formState.errors.age && (
                      <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.age.message)}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-white font-medium">
                      {t('auth.gender')}
                    </Label>
                    <Controller
                      name="gender"
                      control={registerForm.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                          <SelectTrigger className="bg-white/20 border-white/30 text-white">
                            <SelectValue placeholder={t('common.select')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">{t('auth.male')}</SelectItem>
                            <SelectItem value="female">{t('auth.female')}</SelectItem>
                            <SelectItem value="preferNotToSay">{t('auth.other')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {registerForm.formState.errors.gender && (
                      <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.gender.message)}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Controller
                    control={registerForm.control}
                    name="country"
                    render={({ field }) => (
                      <DualLocationPicker
                        country={field.value ?? ''}
                        region={registerForm.watch('region') ?? ''}
                        secondaryCountry={registerForm.watch('secondaryCountry') ?? ''}
                        secondaryRegion={registerForm.watch('secondaryRegion') ?? ''}
                        onChange={({ country, region, secondaryCountry, secondaryRegion }) => {
                          registerForm.setValue('country', country, { shouldValidate: true });
                          registerForm.setValue('region', region, { shouldValidate: true });
                          registerForm.setValue('secondaryCountry', secondaryCountry, { shouldValidate: true });
                          registerForm.setValue('secondaryRegion', secondaryRegion, { shouldValidate: true });
                        }}
                      />
                    )}
                  />
                  {registerForm.formState.errors.country && (
                    <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.country.message)}</p>
                  )}
                  {registerForm.formState.errors.region && (
                    <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.region.message)}</p>
                  )}
                  {registerForm.formState.errors.secondaryCountry && (
                    <p className="text-xs text-destructive mt-1">{t(registerForm.formState.errors.secondaryCountry.message)}</p>
                  )}
                  {registerForm.formState.errors.secondaryRegion && (
                    <p className="text-xs text-destructive mt-1">{t(registerForm.formState.errors.secondaryRegion.message)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="text-white font-medium">
                    {t('register.inviteCode')}
                    {requireEventInvite ? ' *' : ` (${t('register.inviteCodeOptional')})`}
                  </Label>
                  <p className="text-xs text-white/70 text-left">{t('register.inviteCodeHint')}</p>
                  <Input
                    id="inviteCode"
                    placeholder={t('register.inviteCodePlaceholder')}
                    autoComplete="off"
                    {...registerForm.register('inviteCode')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading || configLoading}
                  />
                  {registerForm.formState.errors.inviteCode && (
                    <p role="alert" className="text-xs text-red-300">{t(registerForm.formState.errors.inviteCode.message)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-white font-medium">
                    {t('auth.bio')}
                  </Label>
                  <Textarea
                    id="bio"
                    placeholder={t('auth.aboutYourself')}
                    {...registerForm.register('bio')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 min-h-[80px]"
                    disabled={isLoading}
                  />
                  {registerForm.formState.errors.bio && (
                    <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.bio.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                  disabled={isLoading || !accountNameValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t('auth.creatingAccount')}
                    </>
                  ) : (
                    t('auth.createAccount')
                  )}
                </Button>
              </form>

              <div className="space-y-3 pt-4 border-t border-white/20">
                <p className="text-white/60 text-sm text-center">{t('auth.orContinueWith')}</p>
                <div className="flex justify-center gap-3">
                  <GoogleSignInButton disabled={isLoading} useCase="signup" />
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-white/80 hover:text-white underline text-sm"
                  disabled={isLoading}
                >
                  {t('auth.hasAccount')}
                </button>
              </div>
            </div>
          )}
        </div>

        <ForgotPasswordModal
          open={forgotPasswordOpen}
          onOpenChange={setForgotPasswordOpen}
          email={forgotEmail}
          onEmailChange={setForgotEmail}
        />

        {/* Music Notes Animation */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 text-white/20 text-6xl floating animate-pulse">♪</div>
          <div className="absolute top-3/4 right-1/4 text-white/20 text-4xl floating animate-pulse delay-500">♫</div>
          <div className="absolute top-1/2 left-1/6 text-white/20 text-5xl floating animate-pulse delay-1000">♪</div>
          <div className="absolute bottom-1/4 left-1/2 text-white/20 text-3xl floating animate-pulse delay-1500">♫</div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;