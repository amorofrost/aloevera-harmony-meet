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
  /** When set, shows only this image on a light semi-transparent backing (no decorative frame). */
  badgeImageUrl?: string;
}

const frameClass =
  'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/20 transition-opacity group-hover:opacity-95';

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
              <div className={frameClass}>
                <img src={badgeSrc} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className={`${frameClass} flex items-center justify-center`}>
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
