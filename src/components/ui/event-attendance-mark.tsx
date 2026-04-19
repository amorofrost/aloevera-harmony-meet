import type { Event } from '@/types/user';
import EventPostmark from '@/components/ui/event-postmark';
import { cn } from '@/lib/utils';

type Props = {
  event: Pick<Event, 'title' | 'location' | 'date' | 'category' | 'badgeImageUrl'>;
  className?: string;
  onClick?: () => void;
  showEventName?: boolean;
  /** Slightly smaller postmark in tight horizontal strips */
  size?: 'sm' | 'md';
};

/**
 * One postmark per event: generated art, or the same frame with an uploaded badge image.
 */
export function EventAttendanceMark({
  event,
  className,
  onClick,
  showEventName = false,
  size = 'md',
}: Props) {
  return (
    <EventPostmark
      location={event.location}
      date={event.date}
      title={event.title}
      category={event.category}
      badgeImageUrl={event.badgeImageUrl}
      className={cn(size === 'sm' && 'scale-[0.75] origin-bottom-left', className)}
      onClick={onClick}
      showEventName={showEventName}
    />
  );
}
