import { apiClient } from './apiClient';
import { isApiMode } from '@/config/api.config';
import type { WebPushSubscription, WebPushSubscriptionRequest } from '@/types/notification';

export const pushApi = {
  async getVapidPublicKey() {
    if (!isApiMode()) return { success: true, data: { publicKey: '' } };
    return apiClient.get<{ publicKey: string }>('/api/v1/push/vapid-public-key');
  },

  async subscribe(req: WebPushSubscriptionRequest) {
    if (!isApiMode()) return { success: true, data: { ...req, deviceId: req.deviceId ?? crypto.randomUUID(), createdAtUtc: new Date().toISOString(), lastSeenAtUtc: new Date().toISOString() } as WebPushSubscription };
    return apiClient.post<WebPushSubscription>('/api/v1/push/subscribe', req);
  },

  async unsubscribe(deviceId: string) {
    if (!isApiMode()) return { success: true };
    return apiClient.delete(`/api/v1/push/subscribe/${deviceId}`);
  },
};
