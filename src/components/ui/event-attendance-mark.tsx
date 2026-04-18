import type { Event } from '@/types/user';
import EventPostmark from '@/components/ui/event-postmark';
import { cn } from '@/lib/utils';

type Props = {
  event: Pick<Event, 'id' | 'title' | 'location' | 'date' | 'category' | 'badgeImageUrl'>;
  className?: string;
  onClick?: () => void;
  showEventName?: boolean;
  /** Size for the postmark fallback; badge image uses matching visual weight */
  size?: 'sm' | 'md';
};

export function EventAttendanceMark({
  event,
  className,
  onClick,
  showEventName = false,
  size = 'md',
}: Props) {
  const badge = event.badgeImageUrl?.trim();
  const dim = size === 'sm' ? 'h-12 w-12' : 'w-16 h-16';

  if (badge) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex-shrink-0 overflow-hidden rounded-lg border-2 border-white/80 shadow-md transition-opacity hover:opacity-90',
          dim,
          className,
        )}
      >
        <img src={badge} alt="" className="h-full w-full object-cover" />
      </button>
    );
  }

  return (
    <EventPostmark
      location={event.location}
      date={event.date}
      title={event.title}
      category={event.category}
      className={className}
      onClick={onClick}
      showEventName={showEventName}
    />
  );
}
