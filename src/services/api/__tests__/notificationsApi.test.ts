import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationsApi } from '../notificationsApi';

vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'mock', baseURL: '', timeout: 30000 },
  isApiMode: () => false,
  isMockMode: () => true,
}));

describe('notificationsApi (mock mode)', () => {
  it('list returns empty by default', async () => {
    const result = await notificationsApi.list();
    expect(result.success).toBe(true);
    expect(result.data?.items).toEqual([]);
    expect(result.data?.nextCursor).toBeNull();
  });

  it('unreadCount returns zero by default', async () => {
    const result = await notificationsApi.unreadCount();
    expect(result.data?.count).toBe(0);
  });

  it('getPreferences returns default matrix with inApp=true for every type', async () => {
    const result = await notificationsApi.getPreferences();
    expect(result.success).toBe(true);
    const prefs = result.data!;
    expect(prefs.matrix.likeReceived.inApp).toBe(true);
    expect(prefs.matrix.likeReceived.telegram).toBe(false);
    expect(prefs.dailyDigestHourUtc).toBe(9);
    expect(prefs.frequency.email).toBe('daily');
    expect(prefs.frequency.inApp).toBe('immediate');
  });

  it('updatePreferences round-trips', async () => {
    const result = await notificationsApi.getPreferences();
    const prefs = result.data!;
    prefs.matrix.likeReceived.telegram = true;
    prefs.dailyDigestHourUtc = 18;
    await notificationsApi.updatePreferences(prefs);
    const result2 = await notificationsApi.getPreferences();
    expect(result2.data?.matrix.likeReceived.telegram).toBe(true);
    expect(result2.data?.dailyDigestHourUtc).toBe(18);
  });
});
