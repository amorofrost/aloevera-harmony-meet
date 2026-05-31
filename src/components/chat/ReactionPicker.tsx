import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { REACTION_EMOJIS } from '@/lib/reactions';
import { cn } from '@/lib/utils';

interface Props {
  /** The caller's current reaction on this message, if any. */
  currentReaction?: string;
  /** Called when the user picks an emoji that differs from currentReaction. */
  onSelect: (emoji: string) => void;
  /** Called when the user taps the emoji that matches currentReaction (toggle off). */
  onRemove: () => void;
  /** Trigger element (e.g. a smiley button). */
  children: React.ReactNode;
}

export function ReactionPicker({ currentReaction, onSelect, onRemove, children }: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = (emoji: string) => {
    if (emoji === currentReaction) {
      onRemove();
    } else {
      onSelect(emoji);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleClick(emoji)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-muted',
                emoji === currentReaction && 'bg-muted ring-2 ring-primary'
              )}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
