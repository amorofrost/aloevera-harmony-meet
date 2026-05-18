export type NotificationType =
  | 'likeReceived'
  | 'matchCreated'
  | 'messageReceived'
  | 'forumReplyToThread'
  | 'communityBroadcast'
  | 'eventPublished'
  | 'eventReminder'
  | 'eventInviteReceived'
  | 'rankUp';

export type NotificationChannel = 'inApp' | 'telegram' | 'webPush' | 'email';

export type NotificationFrequency = 'immediate' | 'hourly' | 'daily';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  actorName?: string | null;
  actorAvatar?: string | null;
  payloadJson: string;
  createdAtUtc: string;          // ISO 8601
  readAtUtc?: string | null;
  dismissedAtUtc?: string | null;
  digestGroupId?: string | null;
}

export interface NotificationListResponse {
  items: Notification[];
  nextCursor?: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export type NotificationMatrix = Record<NotificationType, Record<NotificationChannel, boolean>>;
export type NotificationFrequencyMap = Record<NotificationChannel, NotificationFrequency>;

export interface NotificationPreferences {
  matrix: NotificationMatrix;
  frequency: NotificationFrequencyMap;
  dailyDigestHourUtc: number;
  mute: boolean;
  mutedUntilUtc?: string | null;
}

export interface WebPushSubscription {
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  createdAtUtc: string;
  lastSeenAtUtc: string;
}

export interface WebPushSubscriptionRequest {
  deviceId?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}
