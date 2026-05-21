import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Notification } from '@/types/notification';
import { FeedCard, parsePayload } from './FeedCard';
import { useActor } from './feedContextCache';

interface MessageFeedCardProps {
  notification: Notification;
}

export function MessageFeedCard({ notification }: MessageFeedCardProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const payload = parsePayload(notification.payloadJson);
  const preview = String(payload.preview ?? '');
  const chatId = typeof payload.chatId === 'string' ? payload.chatId : '';
  const { data: actor, loading } = useActor(notification.actorId ?? null);

  const initial = (actor?.name ?? notification.actorName ?? '?')
    .charAt(0)
    .toUpperCase();

  return (
    <FeedCard
      notification={notification}
      footer={
        <Button
          size="sm"
          onClick={() =>
            navigate(chatId ? `/friends?tab=chats&chat=${chatId}` : '/friends?tab=chats')
          }
        >
          {t('feed.openChat')}
        </Button>
      }
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-7 w-7">
          {actor?.profileImage && (
            <AvatarImage src={actor.profileImage} alt={actor.name} />
          )}
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {actor?.name ?? notification.actorName ?? (loading ? '...' : '')}
          </p>
          {preview && (
            <p className="text-sm italic text-muted-foreground line-clamp-2">
              {preview}
            </p>
          )}
        </div>
      </div>
    </FeedCard>
  );
}
