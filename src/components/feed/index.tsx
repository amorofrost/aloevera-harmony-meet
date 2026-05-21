import type { Notification } from '@/types/notification';
import { LikeFeedCard } from './LikeFeedCard';
import { MatchFeedCard } from './MatchFeedCard';
import { MessageFeedCard } from './MessageFeedCard';
import { ForumReplyFeedCard } from './ForumReplyFeedCard';
import { EventFeedCard } from './EventFeedCard';
import { BroadcastFeedCard } from './BroadcastFeedCard';
import { RankUpFeedCard } from './RankUpFeedCard';

export { FeedCard } from './FeedCard';
export { LikeFeedCard } from './LikeFeedCard';
export { MatchFeedCard } from './MatchFeedCard';
export { MessageFeedCard } from './MessageFeedCard';
export { ForumReplyFeedCard } from './ForumReplyFeedCard';
export { EventFeedCard } from './EventFeedCard';
export { BroadcastFeedCard } from './BroadcastFeedCard';
export { RankUpFeedCard } from './RankUpFeedCard';
export { useActor, useEvent, fetchActor, fetchEvent } from './feedContextCache';

/**
 * Dispatches a notification to its rich card component. Returns `null` for
 * notification types we don't render rich cards for — callers should treat
 * `null` as a signal to skip rendering (or fall back to the thin
 * `NotificationItem` row if desired).
 */
export function FeedCardForNotification({
  notification,
}: {
  notification: Notification;
}) {
  switch (notification.type) {
    case 'likeReceived':
      return <LikeFeedCard notification={notification} />;
    case 'matchCreated':
      return <MatchFeedCard notification={notification} />;
    case 'messageReceived':
      return <MessageFeedCard notification={notification} />;
    case 'forumReplyToThread':
      return <ForumReplyFeedCard notification={notification} />;
    case 'eventPublished':
    case 'eventReminder':
    case 'eventInviteReceived':
      return <EventFeedCard notification={notification} />;
    case 'communityBroadcast':
      return <BroadcastFeedCard notification={notification} />;
    case 'rankUp':
      return <RankUpFeedCard notification={notification} />;
    default:
      return null;
  }
}
