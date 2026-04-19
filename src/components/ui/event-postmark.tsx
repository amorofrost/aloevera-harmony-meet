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
  /** When set, shows this image only — no extra chrome (transparency preserved when served as PNG). */
  badgeImageUrl?: string;
}

/** Plain year chip when there is no uploaded badge */
const fallbackFrameClass =
  'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/35 ring-1 ring-white/20 transition-opacity group-hover:opacity-95';

/** Uploaded badge: no fill behind the image so transparent PNGs look correct on the page */
const badgeFrameClass =
  'relative h-16 w-16 shrink-0 overflow-hidden rounded-md transition-opacity group-hover:opacity-95';

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
                <span className="text-sm font-semibold tabular-nums text-white/95">{year}</span>
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
