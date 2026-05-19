import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isWebPushSupported, enableWebPush, disableWebPush } from '../webPush';

// Mock browser APIs
const mockPushManagerSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

const mockSubscription = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({
    endpoint: 'https://push.example/abc',
    keys: { p256dh: 'p256dh-val', auth: 'auth-val' },
  }),
  unsubscribe: mockUnsubscribe,
};

// A real 65-byte uncompressed EC public key in URL-safe base64 (no padding) — valid for atob().
// Must be inlined inside vi.mock() because the factory is hoisted above variable declarations.
vi.mock('@/services/api', () => ({
  pushApi: {
    getVapidPublicKey: vi.fn().mockResolvedValue({
      success: true,
      data: { publicKey: 'BLqoziPslieSqTaBgNfmWISXsA8JujkJtX8uvp4ARULvNC0a-3U6BGaYKYKBvcEU2rAsrrfMPeVw7LaHjNSZQeY' },
    }),
    subscribe: vi.fn().mockResolvedValue({ success: true, data: { deviceId: 'dev-1' } }),
    unsubscribe: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('webPush helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPushManagerSubscribe.mockReset().mockResolvedValue(mockSubscription);
    mockUnsubscribe.mockReset().mockResolvedValue(true);

    Object.defineProperty(global, 'navigator', {
      value: {
        serviceWorker: {
          register: vi.fn().mockResolvedValue({
            pushManager: {
              subscribe: mockPushManagerSubscribe,
              getSubscription: vi.fn().mockResolvedValue(mockSubscription),
            },
          }),
          ready: Promise.resolve({
            pushManager: {
              subscribe: mockPushManagerSubscribe,
              getSubscription: vi.fn().mockResolvedValue(mockSubscription),
            },
          }),
        },
        userAgent: 'test',
      },
      writable: true,
    });

    Object.defineProperty(global, 'window', {
      value: { PushManager: {} },
      writable: true,
    });

    Object.defineProperty(global, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
      writable: true,
    });

    // localStorage shim
    let store: Record<string, string> = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
      writable: true,
    });
  });

  it('isWebPushSupported returns true when APIs present', () => {
    expect(isWebPushSupported()).toBe(true);
  });

  it('isWebPushSupported returns false without service worker', () => {
    // @ts-expect-error — testing browser feature detection
    delete global.navigator.serviceWorker;
    expect(isWebPushSupported()).toBe(false);
  });

  it('enableWebPush registers sw, subscribes, and posts to API', async () => {
    const result = await enableWebPush();
    expect(result.deviceId).toBe('dev-1');
    expect(global.navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(mockPushManagerSubscribe).toHaveBeenCalled();
  });

  it('disableWebPush calls unsubscribe and API delete', async () => {
    // Pretend we have a stored deviceId
    localStorage.setItem('webPushDeviceId', 'dev-1');
    await disableWebPush();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
