import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/sonner';
import { resetPasswordSchema, type ResetPasswordSchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const token = searchParams.get('token');

  // Redirect immediately if no token
  useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    // Check if passwords match before API call
    if (data.password !== data.confirmPassword) {
      form.setError('confirmPassword', {
        message: t('resetPassword.passwordMismatch'),
      });
      return;
    }

    try {
      const response = await authApi.resetPassword(token!, data.password);

      if (!response.success) {
        showApiError(response, t('resetPassword.errorFallback'));
        return;
      }

      toast.success(t('resetPassword.successToast'));
      navigate('/');
    } catch (err) {
      showApiError(err, t('resetPassword.errorFallback'));
    }
  });

  // If no token, don't render the form (will redirect)
  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-aloe-forest to-aloe-ocean">
      <div className="w-full max-w-md space-y-6 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            {t('resetPassword.title')}
          </h1>
          <p className="text-white/70 text-sm">
            {t('resetPassword.description') || 'Create a new password for your account'}
          </p>
        </div>

        {form.formState.errors.root && (
          <div role="alert" className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-white">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{form.formState.errors.root.message}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white font-medium">
              {t('resetPassword.passwordLabel')}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={t('resetPassword.passwordLabel')}
              {...form.register('password')}
              className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
              disabled={form.formState.isSubmitting}
            />
            {form.formState.errors.password && (
              <p role="alert" className="text-xs text-red-300">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-white font-medium">
              {t('resetPassword.confirmLabel')}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t('resetPassword.confirmLabel')}
              {...form.register('confirmPassword')}
              className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
              disabled={form.formState.isSubmitting}
            />
            {form.formState.errors.confirmPassword && (
              <p role="alert" className="text-xs text-red-300">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full btn-like text-lg py-4 rounded-2xl font-semibold shadow-2xl"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {t('common.loading') || 'Loading...'}
              </>
            ) : (
              t('resetPassword.submitButton')
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
