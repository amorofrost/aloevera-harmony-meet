import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { Loader2, Mail, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient, authApi } from '@/services/api';
import { attachEmailSchema, type AttachEmailSchema } from '@/lib/validators';
import { showApiError } from '@/lib/apiError';
import { TelegramLoginWidget } from '@/components/TelegramLoginWidget';

/**
 * Lists the current account's authentication methods and lets a Telegram-only account attach
 * an email+password (via verification email) or link a Telegram identity to an email account.
 * Both actions are idempotent: attach is only finalized after the user clicks the verification
 * link, and link-Telegram surfaces the pending ticket via TelegramLoginWidget's <c>onPending</c>
 * override so the ticket is redeemed against the current user rather than starting signup.
 */
export const LinkedAccountsCard: React.FC = () => {
  const [methods, setMethods] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachSent, setAttachSent] = useState(false);
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);

  const form = useForm<AttachEmailSchema>({
    resolver: zodResolver(attachEmailSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authApi.getCurrentUser();
      if (res.success && res.data) {
        setMethods(res.data.authMethods ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasLocal = methods?.includes('local') ?? false;
  const hasTelegram = methods?.includes('telegram') ?? false;

  const handleAttach = form.handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      const res = await authApi.attachEmail(data.email, data.password);
      if (!res.success) {
        const err = (res as any).error;
        if (err?.code === 'EMAIL_TAKEN') {
          form.setError('email', { message: err.message || 'Email already in use' });
          return;
        }
        if (err?.code === 'ALREADY_HAS_LOCAL') {
          toast.error('Your account already has an email login');
          setAttachOpen(false);
          load();
          return;
        }
        if (err?.code === 'RESERVED_DOMAIN') {
          form.setError('email', { message: err.message || 'That email domain is reserved' });
          return;
        }
        if (err?.code === 'WEAK_PASSWORD') {
          form.setError('password', { message: err.message || 'Password does not meet requirements' });
          return;
        }
        showApiError(res, 'Could not send verification email');
        return;
      }
      setAttachSent(true);
    } catch (err) {
      showApiError(err, 'Could not send verification email');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleTelegramPending = useCallback(
    async ({ ticket }: { ticket: string }) => {
      setIsLinkingTelegram(true);
      try {
        const res = await authApi.telegramLink(ticket);
        if (!res.success || !res.data) {
          const err = (res as any).error;
          toast.error(err?.message || 'Could not link Telegram');
          return;
        }
        // Refresh tokens because authMethods on the access token changed.
        apiClient.setAccessToken(res.data.accessToken);
        if (res.data.refreshToken) apiClient.setRefreshToken(res.data.refreshToken);
        toast.success('Telegram linked to your account');
        load();
      } catch (err) {
        showApiError(err, 'Could not link Telegram');
      } finally {
        setIsLinkingTelegram(false);
      }
    },
    [load]
  );

  const closeAttachModal = () => {
    setAttachOpen(false);
    // Give the dialog close animation a moment before resetting state.
    setTimeout(() => {
      setAttachSent(false);
      form.reset();
    }, 150);
  };

  return (
    <Card className="profile-card">
      <CardHeader>
        <CardTitle>Linked accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !methods ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="text-sm">Email &amp; password</span>
              </div>
              {hasLocal ? (
                <span className="text-xs text-muted-foreground">Linked</span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
                  Add
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span className="text-sm">Telegram</span>
              </div>
              {hasTelegram ? (
                <span className="text-xs text-muted-foreground">Linked</span>
              ) : (
                <div className="w-48">
                  {isLinkingTelegram ? (
                    <div className="flex justify-end">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <TelegramLoginWidget onPending={handleTelegramPending} />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={attachOpen} onOpenChange={(open) => (open ? setAttachOpen(true) : closeAttachModal())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add email &amp; password</DialogTitle>
            <DialogDescription>
              {attachSent
                ? 'Check your inbox for a verification link. The email and password are applied to your account only after you click it.'
                : 'Enter the email and password you want to use as an additional way to sign in.'}
            </DialogDescription>
          </DialogHeader>

          {!attachSent ? (
            <form onSubmit={handleAttach} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="attach-email">Email</Label>
                <Input id="attach-email" type="email" {...form.register('email')} disabled={isSubmitting} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="attach-password">Password</Label>
                <Input id="attach-password" type="password" {...form.register('password')} disabled={isSubmitting} />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeAttachModal} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send verification email'
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <DialogFooter>
              <Button onClick={closeAttachModal}>Done</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LinkedAccountsCard;
