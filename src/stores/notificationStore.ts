import { create } from 'zustand';
import type { Notification } from '@/types/notification';

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  setUnreadCount: (count: number) => void;
  setItems: (items: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  addNotification: (n) => set((state) => {
    if (state.items.some(x => x.id === n.id)) return state;
    const isUnread = !n.readAtUtc;
    return {
      items: [n, ...state.items].slice(0, 50),               // cap at 50 for memory
      unreadCount: state.unreadCount + (isUnread ? 1 : 0),
    };
  }),
  markRead: (id) => set((state) => {
    const target = state.items.find(n => n.id === id);
    if (!target || target.readAtUtc) return state;
    return {
      items: state.items.map(n => n.id === id ? { ...n, readAtUtc: new Date().toISOString() } : n),
      unreadCount: Math.max(0, state.unreadCount - 1),
    };
  }),
  markAllRead: () => set((state) => ({
    items: state.items.map(n => n.readAtUtc ? n : { ...n, readAtUtc: new Date().toISOString() }),
    unreadCount: 0,
  })),
  dismiss: (id) => set((state) => {
    const target = state.items.find(n => n.id === id);
    const wasUnread = target && !target.readAtUtc;
    return {
      items: state.items.filter(n => n.id !== id),
      unreadCount: Math.max(0, state.unreadCount - (wasUnread ? 1 : 0)),
    };
  }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setItems: (items) => set({
    items,
    unreadCount: items.filter(n => !n.readAtUtc && !n.dismissedAtUtc).length,
  }),
}));
