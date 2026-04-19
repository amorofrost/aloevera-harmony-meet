import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EventPostmarkProps {
  location: string;
  date: Date;
  title: string;
  category: string;
  className?: string;
  onClick?: () => void;
  showEventName?: boolean;
  /** When set, shows this image on a light frosted backing (bg-white/20 ≈ 80% transparent). */
  badgeImageUrl?: string;
}

/** Year chip when there is no uploaded badge — same backing as badge images */
const fallbackFrameClass =
  'relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-white/20 ring-1 ring-black/10 transition-opacity group-hover:opacity-95';

/** Uploaded badge image on a light semi-transparent white backing */
const badgeFrameClass =
  'relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-white/20 ring-1 ring-black/10 transition-opacity group-hover:opacity-95';

const EventPostmark: React.FC<EventPostmarkProps> = ({
  location,
  date,
  title,
  category,
  className = '',
  onClick,
  showEventName = false,
  badgeImageUrl,
}) => {
  const year = date.getFullYear();
  const city = location.split(',')[1]?.trim() || location.split(',')[0].trim();
  const badgeSrc = badgeImageUrl?.trim();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`relative inline-block ${className} group cursor-pointer`}
            onClick={onClick}
          >
            {badgeSrc ? (
              <div className={badgeFrameClass}>
                <img src={badgeSrc} alt="" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className={`${fallbackFrameClass} flex items-center justify-center`}>
                <span className="text-sm font-semibold tabular-nums text-foreground/90">{year}</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-center">
            {showEventName && <p className="text-sm font-medium">{title}</p>}
            <p className="text-sm">{city}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EventPostmark;
