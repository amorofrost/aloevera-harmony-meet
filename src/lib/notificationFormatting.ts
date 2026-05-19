import type { Notification } from '@/types/notification';

type TFunc = (key: string, params?: Record<string, string>) => string;

export function formatNotificationTitle(n: Notification, t: TFunc): string {
  const actor = n.actorName ?? '';
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(n.payloadJson); } catch { /* keep empty */ }

  switch (n.type) {
    case 'likeReceived':
      return payload.anonymous
        ? t('notifications.title.likeReceivedAnonymous')
        : t('notifications.title.likeReceived', { actor });
    case 'matchCreated':
      return t('notifications.title.matchCreated', { actor });
    case 'messageReceived':
      return t('notifications.title.messageReceived', {
        actor,
        preview: String(payload.preview ?? ''),
      });
    case 'forumReplyToThread':
      return t('notifications.title.forumReply', { actor });
    case 'communityBroadcast':
      return t('notifications.title.communityBroadcast', { title: String(payload.title ?? '') });
    case 'eventPublished':
      return t('notifications.title.eventPublished', { title: String(payload.eventTitle ?? '') });
    case 'eventReminder':
      return t('notifications.title.eventReminder', { title: String(payload.eventTitle ?? '') });
    case 'eventInviteReceived':
      return t('notifications.title.eventInvite', { title: String(payload.eventTitle ?? '') });
    case 'rankUp':
      return t('notifications.title.rankUp', { rank: String(payload.newRank ?? '') });
    default:
      return n.type;
  }
}

export function formatNotificationLink(n: Notification): string {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(n.payloadJson); } catch { /* keep empty */ }

  switch (n.type) {
    case 'likeReceived':
    case 'matchCreated':
      return n.actorId ? `/friends?userId=${n.actorId}` : '/friends';
    case 'messageReceived':
      return `/talks?chat=${payload.chatId ?? ''}`;
    case 'forumReplyToThread':
      return `/talks?topic=${payload.topicId ?? ''}`;
    case 'eventPublished':
    case 'eventReminder':
    case 'eventInviteReceived':
      return payload.eventId ? `/aloevera/events/${payload.eventId}` : '/aloevera';
    case 'communityBroadcast':
      return typeof payload.link === 'string' ? payload.link : '/aloevera';
    case 'rankUp':
      return '/settings';
    default:
      return '/friends';
  }
}
