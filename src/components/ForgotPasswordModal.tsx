import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { forgotPasswordSchema, type ForgotPasswordSchema } from '@/lib/validators';
import { authApi } from '@/services/api';
import { showApiError } from '@/lib/apiError';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailChange: (email: string) => void;
}

const ForgotPasswordModal = ({ open, onOpenChange, email, onEmailChange }: ForgotPasswordModalProps) => {
  const { t } = useLanguage();
  // showSuccess is local: shadcn Dialog unmounts its children on close, so this state
  // is automatically destroyed when the modal closes. On reopen the component remounts
  // fresh with showSuccess=false — which is the spec's required reset behavior.
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowSuccess(false);
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await authApi.forgotPassword(data.email);
      setShowSuccess(true);
    } catch (err) {
      showApiError(err, 'Failed to send reset link');
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('forgotPassword.title')}</DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('forgotPassword.successMessage')}</p>
            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              {t('forgotPassword.closeButton')}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{t('forgotPassword.emailLabel')}</Label>
              <Input
                id="forgot-email"
                type="email"
                {...form.register('email', {
                  onChange: (e) => onEmailChange(e.target.value),
                })}
                defaultValue={email}
              />
              {form.formState.errors.email && (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('forgotPassword.submitButton')}</>
              ) : (
                t('forgotPassword.submitButton')
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordModal;
