import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adminApi } from '../adminApi';
import { apiClient } from '../apiClient';
import * as apiConfig from '@/config/api.config';

describe('adminApi.preRegisterAttendees', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('returns ADMIN_REQUIRES_API in mock mode', async () => {
    vi.spyOn(apiConfig, 'isApiMode').mockReturnValue(false);

    const res = await adminApi.preRegisterAttendees('1', [
      { telegramUsername: 'anna_p', name: 'Anna' },
    ]);

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('ADMIN_REQUIRES_API');
  });

  it('posts to the preregister endpoint in api mode', async () => {
    vi.spyOn(apiConfig, 'isApiMode').mockReturnValue(true);
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { summary: { created: 1, skippedExists: 0, invalidUsername: 0, invalidName: 0, error: 0 }, results: [] },
      timestamp: new Date().toISOString(),
    } as never);

    const res = await adminApi.preRegisterAttendees('42', [
      { telegramUsername: 'anna_p', name: 'Anna', gender: 'female' },
    ]);

    expect(post).toHaveBeenCalledWith('/api/v1/admin/events/42/preregister', {
      attendees: [{ telegramUsername: 'anna_p', name: 'Anna', gender: 'female' }],
    });
    expect(res.success).toBe(true);
    expect(res.data?.summary.created).toBe(1);
  });
});
