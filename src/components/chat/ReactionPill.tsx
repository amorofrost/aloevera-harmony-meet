import { cn } from '@/lib/utils';

interface Props {
  emoji: string;
  /** If true, render with a subtle "this is your reaction" treatment. */
  isOwn?: boolean;
  /** Optional click handler — currently used to allow removal by tapping your own pill. */
  onClick?: () => void;
}

export function ReactionPill({ emoji, isOwn, onClick }: Props) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-sm shadow-sm',
        isOwn && 'border-primary',
        interactive && 'cursor-pointer hover:bg-muted',
        !interactive && 'cursor-default'
      )}
      aria-label={isOwn ? `Your reaction: ${emoji} (tap to remove)` : `Reaction: ${emoji}`}
    >
      {emoji}
    </button>
  );
}
