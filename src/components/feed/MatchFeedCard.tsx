import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Notification } from '@/types/notification';
import { FeedCard } from './FeedCard';
import { useActor } from './feedContextCache';

interface MatchFeedCardProps {
  notification: Notification;
}

export function MatchFeedCard({ notification }: MatchFeedCardProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: actor, loading } = useActor(notification.actorId ?? null);

  const initial = (actor?.name ?? notification.actorName ?? '?')
    .charAt(0)
    .toUpperCase();

  return (
    <FeedCard
      notification={notification}
      className="border-aloe-flame/40"
      footer={
        <Button
          size="sm"
          onClick={() =>
            navigate(
              notification.actorId
                ? `/friends?userId=${notification.actorId}`
                : '/friends',
            )
          }
        >
          {t('feed.startChatting')}
        </Button>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {actor?.profileImage && (
            <AvatarImage src={actor.profileImage} alt={actor.name} />
          )}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--aloe-flame)' }}
          >
            <Heart className="w-3 h-3 fill-current" />
            {t('feed.itsAMatch')}
          </div>
          <p className="text-sm font-medium truncate">
            {actor?.name ?? notification.actorName ?? (loading ? '...' : '')}
          </p>
        </div>
      </div>
    </FeedCard>
  );
}
