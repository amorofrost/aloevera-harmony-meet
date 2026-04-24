import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi, apiClient } from '@/services/api';
import type { GoogleUserInfo } from '@/services/api/authApi';
import heroBg from '@/assets/hero-bg.jpg';
import appIcon from '@/assets/app-icon.jpg';
import { toast } from '@/components/ui/sonner';
import { showApiError } from '@/lib/apiError';
import { navigateAfterAuth } from '@/lib/authNavigation';
import {
  googleRegisterSchema,
  googleRegisterSchemaWithInvite,
  type GoogleRegisterSchema,
} from '@/lib/validators';

type NavState = { ticket: string; google: GoogleUserInfo };

const WelcomeGoogle: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const state = location.state as NavState | null;

  // All hooks must run unconditionally — the guard below renders null after hooks.
  const [isLoading, setIsLoading] = useState(false);
  const requireInviteRef = useRef(false);
  const [requireInvite, setRequireInvite] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  const registerForm = useForm<GoogleRegisterSchema>({
    resolver: async (values, ctx, opts) => {
      const schema = requireInviteRef.current ? googleRegisterSchemaWithInvite : googleRegisterSchema;
      return zodResolver(schema)(values, ctx, opts);
    },
    defaultValues: {
      name: state?.google?.name || '',
      bio: '',
      location: '',
      gender: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!state?.ticket) return;
    setConfigLoading(true);
    authApi
      .getRegistrationConfig()
      .then((res) => {
        if (res.success && res.data) {
          requireInviteRef.current = res.data.requireEventInvite;
          setRequireInvite(res.data.requireEventInvite);
        }
      })
      .catch(() => console.error('Failed to fetch registration config'))
      .finally(() => setConfigLoading(false));
  }, [state?.ticket]);

  if (!state?.ticket || !state?.google) {
    return <Navigate to="/" replace />;
  }

  const { ticket, google } = state;

  const handleCreate = registerForm.handleSubmit(async (data) => {
    setIsLoading(true);
    try {
      const res = await authApi.googleRegister({
        ticket,
        name: data.name,
        age: data.age,
        location: data.location,
        gender: data.gender,
        bio: data.bio,
        inviteCode: data.inviteCode?.trim() || undefined,
      });
      if (!res.success || !res.data) {
        const err = (res as { error?: { code?: string; message?: string } }).error;
        if (err?.code === 'INVALID_INVITE_CODE') {
          registerForm.setError('inviteCode', { message: err.message || 'Invalid invite code' });
          return;
        }
        if (err?.code === 'INVITE_REQUIRED') {
          registerForm.setError('inviteCode', { message: err.message || 'Invite code is required' });
          return;
        }
        showApiError(res, 'Could not create account');
        return;
      }
      apiClient.setAccessToken(res.data.accessToken);
      if (res.data.refreshToken) apiClient.setRefreshToken(res.data.refreshToken);
      toast.success('Account created!');
      navigateAfterAuth(navigate, res.data.user);
    } catch (err) {
      showApiError(err, 'Could not create account');
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
          <div className="space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-left">
            <div>
              <h2 className="text-2xl font-bold text-white">Almost there, {google.name || 'there'}!</h2>
              <p className="text-sm text-white/70 mt-2">
                <span className="text-white/90">{google.email}</span> — we need a few details to finish your profile.
                {google.emailVerified && (
                  <span className="block mt-1 text-xs text-emerald-300/90">Email verified by Google</span>
                )}
              </p>
            </div>

            {configLoading && (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4" style={configLoading ? { display: 'none' } : undefined}>
              <div className="space-y-2">
                <Label htmlFor="goo-reg-name" className="text-white font-medium">Display Name *</Label>
                <Input
                  id="goo-reg-name"
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
                  <Label htmlFor="goo-age" className="text-white font-medium">{t('auth.age')} *</Label>
                  <Input
                    id="goo-age"
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
                  <Label htmlFor="goo-gender" className="text-white font-medium">{t('auth.gender')} *</Label>
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
                <Label htmlFor="goo-location" className="text-white font-medium">{t('auth.location')} *</Label>
                <Input
                  id="goo-location"
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
                <Label htmlFor="goo-invite" className="text-white font-medium">
                  {t('register.inviteCode')}
                  {requireInvite ? ' *' : ` (${t('register.inviteCodeOptional')})`}
                </Label>
                <p className="text-xs text-white/70 text-left">{t('register.inviteCodeHint')}</p>
                <Input
                  id="goo-invite"
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
                <Label htmlFor="goo-bio" className="text-white font-medium">{t('auth.bio')}</Label>
                <Textarea
                  id="goo-bio"
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

              <Button
                type="submit"
                size="lg"
                className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 inline animate-spin" />
                    Creating account...
                  </>
                ) : (
                  t('auth.createAccount')
                )}
              </Button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-white/70 hover:text-white text-sm block w-full pt-2 text-center"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeGoogle;
