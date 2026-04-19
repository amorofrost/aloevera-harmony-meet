import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface AttendedEventBadgesProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Up to 3 preview URLs from the API */
  imageUrls: string[];
  /** Total events-with-badge count (for + overflow) */
  totalCount: number;
}

/**
 * Compact row of event badge images next to a name (e.g. forum replies). Shows at most 3 images;
 * if totalCount &gt; 3, shows a “+” indicating more on the user profile.
 */
export function AttendedEventBadges({
  imageUrls,
  totalCount,
  className,
  ...props
}: AttendedEventBadgesProps) {
  if (totalCount <= 0 || imageUrls.length === 0) return null;

  const extra = totalCount > 3 ? totalCount - 3 : 0;

  return (
    <TooltipProvider>
      <div
        className={cn('inline-flex items-center gap-0.5', className)}
        {...props}
      >
        {imageUrls.slice(0, 3).map((url, i) => (
          <span
            key={`${url}-${i}`}
            className="inline-flex h-6 w-6 shrink-0 overflow-hidden rounded bg-white/50 ring-1 ring-black/10"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
          </span>
        ))}
        {extra > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded border border-dashed border-muted-foreground/50 px-1 text-[10px] font-semibold text-muted-foreground"
                aria-label={`More event badges: ${extra}`}
              >
                +
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Ещё {extra} — откройте профиль, чтобы увидеть все значки посещённых событий.
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
