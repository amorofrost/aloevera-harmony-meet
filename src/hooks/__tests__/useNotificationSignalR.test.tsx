import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotificationSignalR } from '../useNotificationSignalR';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/types/notification';

// ── Mock chatConnection ─────────────────────────────────────────────────────
vi.mock('@/services/signalr/chatConnection', () => {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    chatConnection: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      }),
      off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (handlers[event]) {
          handlers[event] = handlers[event].filter((h) => h !== handler);
        }
      }),
      // Expose for test assertions
      _handlers: handlers,
    },
  };
});

// ── Helpers ─────────────────────────────────────────────────────────────────
const makeNotif = (id: string): Notification => ({
  id,
  userId: 'user-1',
  type: 'likeReceived',
  payloadJson: '{}',
  createdAtUtc: new Date().toISOString(),
  readAtUtc: null,
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('useNotificationSignalR', () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [], unreadCount: 0 });
    vi.clearAllMocks();
  });

  it('incoming NotificationReceived event adds notification to store', async () => {
    const { chatConnection } = await import('@/services/signalr/chatConnection');
    const conn = chatConnection as unknown as {
      on: ReturnType<typeof vi.fn>;
      _handlers: Record<string, ((...args: unknown[]) => void)[]>;
    };

    renderHook(() => useNotificationSignalR());

    // Retrieve the registered handler and fire it with a mock notification
    const [handler] = conn._handlers['NotificationReceived'] ?? [];
    expect(handler).toBeDefined();

    const notif = makeNotif('n-signalr-1');
    handler(notif);

    const state = useNotificationStore.getState();
    expect(state.items.length).toBe(1);
    expect(state.items[0].id).toBe('n-signalr-1');
    expect(state.unreadCount).toBe(1);
  });

  it('cleanup unsubscribes the handler via chatConnection.off', async () => {
    const { chatConnection } = await import('@/services/signalr/chatConnection');
    const conn = chatConnection as unknown as {
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
      _handlers: Record<string, ((...args: unknown[]) => void)[]>;
    };

    const { unmount } = renderHook(() => useNotificationSignalR());

    // Handler should be registered
    expect(conn.on).toHaveBeenCalledWith('NotificationReceived', expect.any(Function));

    unmount();

    // off should have been called with the same event and handler
    expect(conn.off).toHaveBeenCalledWith('NotificationReceived', expect.any(Function));
    // Verify the handler reference passed to off matches what was passed to on
    const onHandler = conn.on.mock.calls[0][1];
    const offHandler = conn.off.mock.calls[0][1];
    expect(onHandler).toBe(offHandler);
  });
});
