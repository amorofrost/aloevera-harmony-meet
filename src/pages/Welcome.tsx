import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { loginSchema, registerSchema, registerSchemaWithInvite, type LoginSchema, type RegisterSchemaWithInvite } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';

const Welcome = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const loginForm = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });
  // Ref allows the resolver (captured once) to read the current inviteCodeRequired
  const inviteCodeRequiredRef = useRef(false);
  const registerForm = useForm<RegisterSchemaWithInvite>({
    resolver: async (values, context, options) => {
      const schema = inviteCodeRequiredRef.current ? registerSchemaWithInvite : registerSchema;
      return zodResolver(schema)(values, context, options);
    },
    mode: 'onBlur',
  });
  const [showRegister, setShowRegister] = useState(false);
  const [inviteCodeRequired, setInviteCodeRequired] = useState(false);
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
          inviteCodeRequiredRef.current = res.data.inviteCodeRequired;
          setInviteCodeRequired(res.data.inviteCodeRequired);
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
        const message = (response as any).error?.message || 'Login failed';
        loginForm.setError('root', { message });
        return;
      }
      if (response.data) {
        apiClient.setAccessToken(response.data.accessToken);
        if (response.data.refreshToken) {
          apiClient.setRefreshToken(response.data.refreshToken);
        }
        toast.success('Welcome back!');
        navigate('/friends');
      }
    } catch (err) {
      showApiError(err, 'Login failed');
    } finally {
      setIsLoading(false);
    }
  });

  const handleRegister = registerForm.handleSubmit(async (data) => {
    setIsLoading(true);
    try {
      const response = await authApi.register({
        email: data.email,
        password: data.password,
        name: data.name,
        age: data.age,
        location: data.location,
        gender: data.gender,
        bio: data.bio,
        inviteCode: data.inviteCode,
      });
      if (!response.success) {
        const apiErr = (response as any).error;
        if (apiErr?.code === 'EMAIL_TAKEN') {
          registerForm.setError('email', { message: apiErr.message || 'Email is already taken' });
          return;
        }
        if (apiErr?.code === 'INVALID_INVITE_CODE') {
          registerForm.setError('inviteCode', { message: apiErr.message || 'Invalid invite code' });
          return;
        }
        showApiError(response, 'Registration failed');
        return;
      }
      toast.success('Account created! Check your email to verify.');
      setShowRegister(false);
    } catch (err) {
      showApiError(err, 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  });

  const handleOAuthLogin = (provider: 'google' | 'facebook' | 'vk') => {
    // TODO: Redirect to OAuth endpoint when integrated
    // window.location.href = `${API_CONFIG.baseURL}/api/v1/auth/oauth/${provider}/login`;
    toast.error(`${provider} login will be available soon`);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
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
          
          <p className="text-lg text-white/80 drop-shadow-md leading-relaxed">
            {t('welcome.description')}
          </p>
        </div>

        {/* Login/Register Forms */}
        <div className="mt-12 w-full max-w-md">
          {!showRegister ? (
            // Login Form
            <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-4">Sign In</h2>

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
                    <p role="alert" className="text-xs text-red-300">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white font-medium">{t('auth.password')}</Label>
                  <Input id="password" type="password" placeholder={t('auth.enterPassword')}
                    {...loginForm.register('password')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading} />
                  {loginForm.formState.errors.password && (
                    <p role="alert" className="text-xs text-red-300">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" size="lg"
                  className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                  disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Signing in...</>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>
              </form>

              <div className="space-y-3 pt-4 border-t border-white/20">
                <p className="text-white/60 text-sm">Or continue with</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button onClick={() => handleOAuthLogin('google')} variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>Google</Button>
                  <Button onClick={() => handleOAuthLogin('facebook')} variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>Facebook</Button>
                  <Button onClick={() => handleOAuthLogin('vk')} variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>VK</Button>
                </div>
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
              <h2 className="text-2xl font-bold text-white mb-4">Create Account</h2>

              {configLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              ) : null}
              <form onSubmit={handleRegister} className="space-y-4" style={configLoading ? { display: 'none' } : undefined}>
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
                  <p className="text-xs text-white/60">Your email will be used as your login</p>
                  {registerForm.formState.errors.email && (
                    <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-white font-medium">
                    Display Name *
                  </Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="Your name"
                    {...registerForm.register('name')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  {registerForm.formState.errors.name && (
                    <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.name.message}</p>
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
                      { test: pw.length >= 8, label: 'At least 8 characters' },
                      { test: /[A-Z]/.test(pw), label: 'One uppercase letter' },
                      { test: /[a-z]/.test(pw), label: 'One lowercase letter' },
                      { test: /[0-9]/.test(pw), label: 'One number' },
                      { test: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pw), label: 'One special character' },
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
                            <span>✓</span> Password meets requirements
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {registerForm.formState.errors.password && (
                    <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age" className="text-white font-medium">
                      {t('auth.age')}
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
                      <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.age.message}</p>
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
                      <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.gender.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-white font-medium">
                    {t('auth.location')}
                  </Label>
                  <Input
                    id="location"
                    placeholder={t('auth.cityCountry')}
                    {...registerForm.register('location')}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    disabled={isLoading}
                  />
                  {registerForm.formState.errors.location && (
                    <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.location.message}</p>
                  )}
                </div>

                {inviteCodeRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="inviteCode" className="text-white font-medium">
                      {t('register.inviteCode')} *
                    </Label>
                    <Input
                      id="inviteCode"
                      placeholder={t('register.inviteCodePlaceholder')}
                      {...registerForm.register('inviteCode')}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                      disabled={isLoading}
                    />
                    {registerForm.formState.errors.inviteCode && (
                      <p role="alert" className="text-xs text-red-300">{registerForm.formState.errors.inviteCode.message}</p>
                    )}
                  </div>
                )}

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
              </form>

              <div className="space-y-3 pt-4 border-t border-white/20">
                <p className="text-white/60 text-sm">Or sign up with</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button onClick={() => handleOAuthLogin('google')} variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>Google</Button>
                  <Button onClick={() => handleOAuthLogin('facebook')} variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>Facebook</Button>
                  <Button onClick={() => handleOAuthLogin('vk')} variant="outline"
                    className="bg-white/10 hover:bg-white/20 border-white/30 text-white" disabled={isLoading}>VK</Button>
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