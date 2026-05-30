import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authApi } from '@/services/api';

interface TelegramInviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plainCode: string;
}

/**
 * Sibling to <c>InviteLinkDialog</c> that renders a Telegram Mini App deep link instead
 * of the web URL. The Mini App reads <c>?startapp=inv-{code}</c> on entry and either
 * pre-fills the invite code on the registration form (for new users) or navigates a
 * signed-in user to the matching event detail page with the code applied — mirroring
 * the web behaviour of <c>/aloevera/events/{eventId}?code={code}</c>.
 *
 * Bot username comes from <c>GET /api/v1/auth/telegram-login-config</c> (reused from
 * the Telegram Login Widget). If Telegram auth isn't configured server-side, the dialog
 * shows a clear inline error rather than rendering a broken link.
 */
export default function TelegramInviteLinkDialog({
  open,
  onOpenChange,
  plainCode,
}: TelegramInviteLinkDialogProps) {
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    authApi
      .getTelegramLoginConfig()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.botUsername?.trim()) {
          setBotUsername(res.data.botUsername.trim());
        } else {
          setError('Telegram bot is not configured on the server.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Telegram bot configuration.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const url = botUsername
    ? `https://t.me/${encodeURIComponent(botUsername)}?startapp=inv-${encodeURIComponent(plainCode)}`
    : '';

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success('Telegram link copied');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Telegram invite link & QR</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Opens the Telegram Mini App. New users land on registration with the invite
                pre-filled; signed-in users go straight to the event page with the code
                applied.
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 text-xs leading-relaxed">
                  {url}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void handleCopy()}
                >
                  Copy
                </Button>
              </div>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCode value={url} size={180} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
