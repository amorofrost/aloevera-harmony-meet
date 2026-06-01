import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EventPostmark from '@/components/ui/event-postmark';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatEventDate } from '@/lib/eventDates';
import type { Notification } from '@/types/notification';
import { FeedCard, parsePayload } from './FeedCard';
import { useEvent } from './feedContextCache';

interface EventFeedCardProps {
  notification: Notification;
}

export function EventFeedCard({ notification }: EventFeedCardProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const payload = parsePayload(notification.payloadJson);
  const eventId = typeof payload.eventId === 'string' ? payload.eventId : '';
  const inviteCode =
    typeof payload.inviteCode === 'string' ? payload.inviteCode : null;
  const { data: event, loading } = useEvent(eventId || null);

  // Fall back to payload-provided title if event fetch is still in flight or failed.
  const fallbackTitle =
    typeof payload.eventTitle === 'string' ? payload.eventTitle : '';
  const title = event?.title ?? fallbackTitle;
  const dateLocale = language === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <FeedCard
      notification={notification}
      footer={
        <Button
          size="sm"
          onClick={() =>
            navigate(eventId ? `/aloevera/events/${eventId}` : '/aloevera')
          }
        >
          {t('feed.viewEvent')}
        </Button>
      }
    >
      <div className="space-y-2">
        {loading && !event ? (
          <Skeleton className="w-full aspect-video max-h-52 rounded-md" />
        ) : event?.imageUrl ? (
          // aspect-video keeps the mobile look; max-h-52 (~208px) caps the height
          // on wider viewports so the image stays a compact letterboxed strip
          // instead of dominating the desktop card.
          <div className="relative w-full aspect-video max-h-52 overflow-hidden rounded-md">
            <img
              src={event.imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {event && (
              <div className="absolute bottom-2 right-2">
                <EventPostmark
                  location={event.location}
                  date={event.date}
                  title={event.title}
                  category={event.category}
                  badgeImageUrl={event.badgeImageUrl}
                />
              </div>
            )}
          </div>
        ) : null}

        {title && <p className="text-base font-semibold leading-tight">{title}</p>}

        {event?.date && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatEventDate(event.date, dateLocale)}
          </p>
        )}

        {event?.location && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {event.location}
          </p>
        )}

        {inviteCode && (
          <div>
            <p className="text-xs text-muted-foreground">{t('feed.inviteCode')}</p>
            <code className="inline-block mt-1 px-2 py-1 bg-muted rounded text-sm font-mono">
              {inviteCode}
            </code>
          </div>
        )}
      </div>
    </FeedCard>
  );
}
