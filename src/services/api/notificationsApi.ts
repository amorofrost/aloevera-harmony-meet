import { apiClient } from './apiClient';
import { isApiMode } from '@/config/api.config';
import type {
  Notification, NotificationListResponse, UnreadCountResponse,
  NotificationPreferences,
} from '@/types/notification';

const mockNotifications: Notification[] = [];          // mock mode: empty by default

function buildDefaultPrefs(): NotificationPreferences {
  const types: Notification['type'][] = [
    'likeReceived', 'matchCreated', 'messageReceived', 'forumReplyToThread',
    'communityBroadcast', 'eventPublished', 'eventReminder', 'eventInviteReceived', 'rankUp',
  ];
  const matrix = Object.fromEntries(types.map(t => [t, {
    inApp: true, telegram: false, webPush: false, email: false,
  }])) as NotificationPreferences['matrix'];
  return {
    matrix,
    frequency: { inApp: 'immediate', telegram: 'immediate', webPush: 'immediate', email: 'daily' },
    dailyDigestHourUtc: 9,
    mute: false,
    mutedUntilUtc: null,
  };
}

let mockPrefs: NotificationPreferences = buildDefaultPrefs();

export const notificationsApi = {
  async list(cursor?: string, limit = 20) {
    if (!isApiMode()) {
      return { success: true, data: { items: mockNotifications.slice(0, limit), nextCursor: null } as NotificationListResponse };
    }
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    qs.set('limit', String(limit));
    return apiClient.get<NotificationListResponse>(`/api/v1/notifications?${qs}`);
  },

  async unreadCount() {
    if (!isApiMode()) return { success: true, data: { count: 0 } as UnreadCountResponse };
    return apiClient.get<UnreadCountResponse>('/api/v1/notifications/unread-count');
  },

  async markRead(id: string) {
    if (!isApiMode()) {
      const n = mockNotifications.find(x => x.id === id);
      if (n) n.readAtUtc = new Date().toISOString();
      return { success: true };
    }
    return apiClient.post(`/api/v1/notifications/${id}/read`);
  },

  async markAllRead() {
    if (!isApiMode()) {
      const now = new Date().toISOString();
      mockNotifications.forEach(n => { if (!n.readAtUtc) n.readAtUtc = now; });
      return { success: true, data: { updated: mockNotifications.length } };
    }
    return apiClient.post('/api/v1/notifications/mark-all-read');
  },

  async dismiss(id: string) {
    if (!isApiMode()) {
      const n = mockNotifications.find(x => x.id === id);
      if (n) n.dismissedAtUtc = new Date().toISOString();
      return { success: true };
    }
    return apiClient.delete(`/api/v1/notifications/${id}`);
  },

  async getPreferences() {
    if (!isApiMode()) return { success: true, data: { ...mockPrefs } };
    return apiClient.get<NotificationPreferences>('/api/v1/notifications/preferences');
  },

  async updatePreferences(prefs: NotificationPreferences) {
    if (!isApiMode()) { mockPrefs = { ...prefs }; return { success: true, data: { ...mockPrefs } }; }
    return apiClient.put<NotificationPreferences>('/api/v1/notifications/preferences', prefs);
  },
};
