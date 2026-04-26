import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  plainCode: string;
}

export default function InviteLinkDialog({ open, onOpenChange, eventId, plainCode }: InviteLinkDialogProps) {
  const url = `${window.location.origin}/aloevera/events/${eventId}?code=${encodeURIComponent(plainCode)}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite link & QR code</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
