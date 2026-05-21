import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Notification } from '@/types/notification';
import { FeedCard, parsePayload } from './FeedCard';

interface ForumReplyFeedCardProps {
  notification: Notification;
}

export function ForumReplyFeedCard({ notification }: ForumReplyFeedCardProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const payload = parsePayload(notification.payloadJson);
  const topicId = typeof payload.topicId === 'string' ? payload.topicId : '';
  const topicTitle =
    typeof payload.topicTitle === 'string' && payload.topicTitle
      ? payload.topicTitle
      : null;
  const actorName = notification.actorName ?? '';

  return (
    <FeedCard
      notification={notification}
      footer={
        <Button
          size="sm"
          onClick={() => navigate(topicId ? `/talks?topic=${topicId}` : '/talks')}
        >
          {t('feed.openThread')}
        </Button>
      }
    >
      <p className="text-sm">
        <span className="font-medium">{actorName}</span>{' '}
        <span className="text-muted-foreground">{t('feed.repliedIn')}</span>{' '}
        {topicTitle ? (
          <span className="font-medium">{topicTitle}</span>
        ) : (
          <span className="text-muted-foreground">…</span>
        )}
      </p>
    </FeedCard>
  );
}
