import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Resolved display name for the original sender (e.g. "You" or partner's name). */
  senderLabel: string;
  /** Truncated preview of the original content. */
  contentPreview: string;
  /** Show a small image icon when the original message had attachments. */
  hasImages?: boolean;
  /** Tap to scroll to the original message. */
  onClick?: () => void;
  /** "own" = quote is shown inside one of MY message bubbles; affects accent colors. */
  variant?: 'own' | 'opponent';
}

export function QuotedMessage({
  senderLabel,
  contentPreview,
  hasImages,
  onClick,
  variant = 'opponent',
}: Props) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'w-full text-left rounded-md border-l-2 pl-2 pr-2 py-1 mb-1 text-xs',
        variant === 'own'
          ? 'border-primary-foreground/70 bg-primary-foreground/10'
          : 'border-primary bg-background/60',
        interactive && 'cursor-pointer hover:bg-background/80',
        !interactive && 'cursor-default'
      )}
    >
      <div className={cn(
        'font-semibold truncate',
        variant === 'own' ? 'text-primary-foreground' : 'text-primary'
      )}>
        {senderLabel}
      </div>
      <div className={cn(
        'flex items-center gap-1 truncate',
        variant === 'own' ? 'text-primary-foreground/90' : 'text-muted-foreground'
      )}>
        {hasImages && <ImageIcon className="w-3 h-3 shrink-0" />}
        <span className="truncate">{contentPreview}</span>
      </div>
    </button>
  );
}
