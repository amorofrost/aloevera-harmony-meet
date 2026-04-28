import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'mock', baseURL: '', timeout: 30000 },
  isApiMode: () => false,
  isMockMode: () => true,
}));

describe('chatsApi.getMessages (mock mode)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns a PagedResult shape', async () => {
    const { chatsApi } = await import('@/services/api/chatsApi');
    const result = await chatsApi.getMessages('chat-1');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('items');
    expect(result.data).toHaveProperty('hasMore');
    expect(result.data).toHaveProperty('pageSize');
  });

  it('accepts cursor parameter', async () => {
    const { chatsApi } = await import('@/services/api/chatsApi');
    const result = await chatsApi.getMessages('chat-1', 'some-cursor');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data?.items)).toBe(true);
  });
});
