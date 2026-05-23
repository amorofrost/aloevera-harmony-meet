import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'api', baseURL: '', timeout: 30000 },
  isApiMode: () => true,
  isMockMode: () => false,
}));

const apiClientGet = vi.fn();
vi.mock('@/services/api/apiClient', () => ({
  isApiMode: () => true,
  apiClient: {
    get: (...args: unknown[]) => apiClientGet(...args),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe('adminApi.metrics.getDimensions', () => {
  beforeEach(() => {
    apiClientGet.mockReset();
  });

  it('returns the row list on success', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    apiClientGet.mockResolvedValueOnce({
      success: true,
      data: [{ dimensionKey: 'backend|GET|~api~v1~x|200', count: 5, p50: 1, p95: 2, p99: 3 }],
      timestamp: 'now',
    });

    const r = await adminApi.metrics.getDimensions({
      category: 'request_timing',
      from: '2026-05-22T00:00:00Z',
      to: '2026-05-23T00:00:00Z',
    });

    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(apiClientGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/admin\/metrics\/dimensions\?/),
    );
  });

  it('gracefully returns empty data when backend endpoint 404s', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    apiClientGet.mockResolvedValueOnce({
      success: false,
      error: { code: 'HTTP_404', message: 'Not found' },
      timestamp: 'now',
    });

    const r = await adminApi.metrics.getDimensions({
      category: 'request_timing',
      from: '2026-05-22T00:00:00Z',
      to: '2026-05-23T00:00:00Z',
    });

    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });

  it('forwards other errors unchanged', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    apiClientGet.mockResolvedValueOnce({
      success: false,
      error: { code: 'HTTP_500', message: 'Server exploded' },
      timestamp: 'now',
    });

    const r = await adminApi.metrics.getDimensions({
      category: 'request_timing',
      from: '2026-05-22T00:00:00Z',
      to: '2026-05-23T00:00:00Z',
    });

    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('HTTP_500');
  });

  it('includes limit query param when provided', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    apiClientGet.mockResolvedValueOnce({ success: true, data: [], timestamp: 'now' });

    await adminApi.metrics.getDimensions({
      category: 'request_timing',
      from: '2026-05-22T00:00:00Z',
      to: '2026-05-23T00:00:00Z',
      limit: 25,
    });

    expect(apiClientGet).toHaveBeenCalledWith(
      expect.stringMatching(/limit=25/),
    );
  });
});
