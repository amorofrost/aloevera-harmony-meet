import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../notificationStore';
import type { Notification } from '@/types/notification';

const makeNotif = (id: string, read = false): Notification => ({
  id, userId: 'me', type: 'likeReceived', payloadJson: '{}',
  createdAtUtc: new Date().toISOString(),
  readAtUtc: read ? new Date().toISOString() : null,
});

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [], unreadCount: 0 });
  });

  it('addNotification prepends and bumps unread count when unread', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().addNotification(makeNotif('n2'));
    const s = useNotificationStore.getState();
    expect(s.items.length).toBe(2);
    expect(s.items[0].id).toBe('n2');          // newest first
    expect(s.unreadCount).toBe(2);
  });

  it('addNotification dedupes by id', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    expect(useNotificationStore.getState().items.length).toBe(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('markRead sets readAtUtc and decrements unreadCount', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().markRead('n1');
    const s = useNotificationStore.getState();
    expect(s.items[0].readAtUtc).toBeTruthy();
    expect(s.unreadCount).toBe(0);
  });

  it('markRead is idempotent', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1', true));
    useNotificationStore.getState().markRead('n1');
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('markAllRead zeroes unreadCount', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().addNotification(makeNotif('n2'));
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('dismiss removes from items', () => {
    useNotificationStore.getState().addNotification(makeNotif('n1'));
    useNotificationStore.getState().dismiss('n1');
    expect(useNotificationStore.getState().items.length).toBe(0);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('setUnreadCount overrides count from server', () => {
    useNotificationStore.getState().setUnreadCount(7);
    expect(useNotificationStore.getState().unreadCount).toBe(7);
  });

  it('setItems replaces list', () => {
    useNotificationStore.getState().setItems([makeNotif('a'), makeNotif('b', true)]);
    const s = useNotificationStore.getState();
    expect(s.items.length).toBe(2);
    expect(s.unreadCount).toBe(1);
  });
});
