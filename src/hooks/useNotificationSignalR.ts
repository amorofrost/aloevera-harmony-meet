import { useEffect } from 'react';
import { chatConnection } from '@/services/signalr/chatConnection';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/types/notification';

/**
 * Subscribes to the `NotificationReceived` SignalR event emitted by ChatHub
 * and pipes each incoming notification into the in-memory notification store.
 *
 * `chatConnection.on()` returns void, so cleanup uses `chatConnection.off()`
 * with the same handler reference (captured in the effect closure).
 */
export function useNotificationSignalR(): void {
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    const handler = (notification: Notification) => {
      addNotification(notification);
    };

    chatConnection.on('NotificationReceived', handler as (...args: unknown[]) => void);

    return () => {
      chatConnection.off('NotificationReceived', handler as (...args: unknown[]) => void);
    };
  }, [addNotification]);
}
