import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPreferences } from '../NotificationPreferences';
import { renderWithProviders } from '@/test/utils';
import type { NotificationPreferences as Prefs } from '@/types/notification';

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import { toast } from '@/components/ui/sonner';

const defaultPrefs: Prefs = {
  matrix: {
    likeReceived: { inApp: true, telegram: false, webPush: false, email: false },
    matchCreated: { inApp: true, telegram: false, webPush: false, email: false },
    messageReceived: { inApp: true, telegram: false, webPush: false, email: false },
    forumReplyToThread: { inApp: true, telegram: false, webPush: false, email: false },
    communityBroadcast: { inApp: true, telegram: false, webPush: false, email: false },
    eventPublished: { inApp: true, telegram: false, webPush: false, email: false },
    eventReminder: { inApp: true, telegram: false, webPush: false, email: false },
    eventInviteReceived: { inApp: true, telegram: false, webPush: false, email: false },
    rankUp: { inApp: true, telegram: false, webPush: false, email: false },
  },
  frequency: { inApp: 'immediate', telegram: 'immediate', webPush: 'immediate', email: 'daily' },
  dailyDigestHourUtc: 9,
  mute: false,
  mutedUntilUtc: null,
};

const mockUpdate = vi.fn();
vi.mock('@/services/api', () => {
  const prefs = {
    matrix: {
      likeReceived: { inApp: true, telegram: false, webPush: false, email: false },
      matchCreated: { inApp: true, telegram: false, webPush: false, email: false },
      messageReceived: { inApp: true, telegram: false, webPush: false, email: false },
      forumReplyToThread: { inApp: true, telegram: false, webPush: false, email: false },
      communityBroadcast: { inApp: true, telegram: false, webPush: false, email: false },
      eventPublished: { inApp: true, telegram: false, webPush: false, email: false },
      eventReminder: { inApp: true, telegram: false, webPush: false, email: false },
      eventInviteReceived: { inApp: true, telegram: false, webPush: false, email: false },
      rankUp: { inApp: true, telegram: false, webPush: false, email: false },
    },
    frequency: { inApp: 'immediate', telegram: 'immediate', webPush: 'immediate', email: 'daily' },
    dailyDigestHourUtc: 9,
    mute: false,
    mutedUntilUtc: null,
  };
  return {
    notificationsApi: {
      getPreferences: vi.fn().mockResolvedValue({ success: true, data: prefs }),
      updatePreferences: (...args: unknown[]) => mockUpdate(...args),
    },
  };
});

describe('NotificationPreferences', () => {
  beforeEach(() => {
    mockUpdate.mockClear().mockResolvedValue({ success: true, data: {} });
    (toast.error as ReturnType<typeof vi.fn>).mockClear();
    (toast.success as ReturnType<typeof vi.fn>).mockClear();
  });

  it('renders four channel blocks', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={false} pushSubscribed={false} emailVerified={false} />);
    expect(await screen.findByText(/notifications.settings.channel.inApp/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications.settings.channel.telegram/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications.settings.channel.webPush/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications.settings.channel.email/i)).toBeInTheDocument();
  });

  it('greys out telegram when not linked', async () => {
    const { container } = renderWithProviders(<NotificationPreferences telegramLinked={false} pushSubscribed={true} emailVerified={true} />);
    await screen.findByText(/notifications.settings.channel.telegram/i);
    expect(container.querySelector('[data-channel="telegram"][data-disabled="true"]')).toBeInTheDocument();
  });

  it('shows daily digest hour picker when email frequency is daily', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={true} pushSubscribed={true} emailVerified={true} />);
    expect(await screen.findByText(/notifications.settings.dailyHour/i)).toBeInTheDocument();
  });

  it('save calls updatePreferences with current matrix', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={true} pushSubscribed={true} emailVerified={true} />);
    await screen.findByText(/notifications.settings.channel.inApp/i);
    const save = screen.getByRole('button', { name: /save/i });
    await userEvent.click(save);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('save shows error when API returns success=false', async () => {
    mockUpdate.mockResolvedValueOnce({
      success: false,
      error: { code: 'INVALID_PREFERENCES', message: 'bad hour' },
    });

    renderWithProviders(<NotificationPreferences telegramLinked={true} pushSubscribed={true} emailVerified={true} />);
    await screen.findByText(/notifications.settings.channel.inApp/i);
    const save = screen.getByRole('button', { name: /save/i });
    await userEvent.click(save);

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
