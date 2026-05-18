import { describe, it, expect } from 'vitest';
import { formatNotificationTitle, formatNotificationLink } from '../notificationFormatting';
import type { Notification } from '@/types/notification';

// Minimal translation lookup matching the English entries added to LanguageContext.
const translations: Record<string, string> = {
  'notifications.title.likeReceived': '{actor} liked you',
  'notifications.title.likeReceivedAnonymous': 'Someone liked you',
  'notifications.title.matchCreated': 'New match with {actor}',
  'notifications.title.messageReceived': '{actor}: {preview}',
  'notifications.title.forumReply': '{actor} replied in a thread',
  'notifications.title.communityBroadcast': '{title}',
  'notifications.title.eventPublished': 'New event: {title}',
  'notifications.title.eventReminder': 'Event tomorrow: {title}',
  'notifications.title.eventInvite': "You're invited: {title}",
  'notifications.title.rankUp': "You're now {rank}!",
};

const t = (key: string, params?: Record<string, string>) => {
  let s = translations[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v);
  return s;
};

const baseNotif = (overrides: Partial<Notification>): Notification => ({
  id: 'n', userId: 'me', type: 'likeReceived', payloadJson: '{}',
  createdAtUtc: new Date().toISOString(),
  ...overrides,
});

describe('formatNotificationTitle', () => {
  it('like received with actor name', () => {
    const title = formatNotificationTitle(baseNotif({
      type: 'likeReceived', actorName: 'Anna',
      payloadJson: JSON.stringify({ anonymous: false }),
    }), t);
    expect(title).toContain('Anna');
    expect(title).toContain('liked');
  });

  it('anonymous like omits name', () => {
    const title = formatNotificationTitle(baseNotif({
      type: 'likeReceived', actorName: null,
      payloadJson: JSON.stringify({ anonymous: true }),
    }), t);
    expect(title).toContain('Someone');
  });

  it('message with preview', () => {
    const title = formatNotificationTitle(baseNotif({
      type: 'messageReceived', actorName: 'Anna',
      payloadJson: JSON.stringify({ chatId: 'c1', messageId: 'm1', preview: 'hello' }),
    }), t);
    expect(title).toContain('Anna');
    expect(title).toContain('hello');
  });
});

describe('formatNotificationLink', () => {
  it('message links to /talks (for now — chats UI lives there)', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'messageReceived',
      payloadJson: JSON.stringify({ chatId: 'c1' }),
    }))).toBe('/talks?chat=c1');
  });

  it('like links to /friends with userId', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'likeReceived', actorId: 'u-actor',
      payloadJson: JSON.stringify({ anonymous: false }),
    }))).toBe('/friends?userId=u-actor');
  });

  it('anonymous like links to /friends (no userId)', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'likeReceived', actorId: null,
      payloadJson: JSON.stringify({ anonymous: true }),
    }))).toBe('/friends');
  });

  it('forum reply links to topic via /talks', () => {
    expect(formatNotificationLink(baseNotif({
      type: 'forumReplyToThread',
      payloadJson: JSON.stringify({ topicId: 't1', replyId: 'r1' }),
    }))).toBe('/talks?topic=t1');
  });
});
