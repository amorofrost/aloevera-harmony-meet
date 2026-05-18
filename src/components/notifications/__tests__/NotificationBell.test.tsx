import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationBell } from '../NotificationBell';
import { useNotificationStore } from '@/stores/notificationStore';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/services/api', () => ({
  notificationsApi: {
    list: vi.fn().mockResolvedValue({ success: true, data: { items: [], nextCursor: null } }),
    unreadCount: vi.fn().mockResolvedValue({ success: true, data: { count: 0 } }),
    markAllRead: vi.fn().mockResolvedValue({ success: true }),
    markRead: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

describe('NotificationBell', () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [], unreadCount: 0 });
  });

  it('renders bell with no badge when unread=0', () => {
    renderWithProviders(<NotificationBell />);
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.queryByText(/^[0-9+]+$/)).not.toBeInTheDocument();
  });

  it('renders badge with count', () => {
    useNotificationStore.setState({ unreadCount: 3 });
    renderWithProviders(<NotificationBell />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('caps badge at 9+', () => {
    useNotificationStore.setState({ unreadCount: 42 });
    renderWithProviders(<NotificationBell />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('clicking opens dropdown showing empty state', async () => {
    renderWithProviders(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    expect(screen.getByText(/notifications.empty/i)).toBeInTheDocument();
  });
});
