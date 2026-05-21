import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { matchingApi } from '@/services/api';
import { showApiError } from '@/lib/apiError';
import type { Notification } from '@/types/notification';
import { FeedCard, parsePayload } from './FeedCard';
import { useActor } from './feedContextCache';

interface LikeFeedCardProps {
  notification: Notification;
}

export function LikeFeedCard({ notification }: LikeFeedCardProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const payload = parsePayload(notification.payloadJson);
  const isAnonymous = payload.anonymous === true;
  const actorId = isAnonymous ? null : notification.actorId ?? null;
  const { data: actor, loading } = useActor(actorId);

  if (isAnonymous) {
    // Anonymous like — no actor fetch, no actionable buttons.
    return (
      <FeedCard notification={notification}>
        <p className="text-sm text-muted-foreground italic">
          {t('notifications.title.likeReceivedAnonymous')}
        </p>
      </FeedCard>
    );
  }

  const city = (actor?.location ?? '').split(',')[0]?.trim();
  const initial = (actor?.name ?? notification.actorName ?? '?').charAt(0).toUpperCase();

  const handleLikeBack = async () => {
    if (!actorId) return;
    try {
      const res = await matchingApi.sendLike(actorId);
      if (res.success && res.data?.isMatch) {
        toast.success(t('feed.itsAMatch'));
      } else if (res.success) {
        toast.success(t('feed.likeBack'));
      } else {
        showApiError(res.error, t('common.error'));
      }
    } catch (err) {
      showApiError(err, t('common.error'));
    }
  };

  return (
    <FeedCard
      notification={notification}
      footer={
        <>
          <Button
            variant="default"
            size="sm"
            onClick={() => actorId && navigate(`/friends?userId=${actorId}`)}
          >
            {t('feed.viewProfile')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleLikeBack}>
            {t('feed.likeBack')}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-7 w-7">
          {actor?.profileImage && <AvatarImage src={actor.profileImage} alt={actor.name} />}
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {actor?.name ?? notification.actorName ?? (loading ? '...' : '')}
            {actor?.age ? `, ${actor.age}` : ''}
          </p>
          {city && <p className="text-xs text-muted-foreground truncate">{city}</p>}
        </div>
      </div>
    </FeedCard>
  );
}
