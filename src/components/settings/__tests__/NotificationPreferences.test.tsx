import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPreferences } from '../NotificationPreferences';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import { toast } from '@/components/ui/sonner';

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

  it('renders only In-app and Telegram column headers (no webPush/email)', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={false} />);
    expect(await screen.findAllByText(/notifications.settings.channel.inApp/i)).toHaveLength(1);
    // Telegram label appears twice: once in the status row, once as a column header.
    expect(screen.getAllByText(/notifications.settings.channel.telegram/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/notifications.settings.channel.webPush/i)).toBeNull();
    expect(screen.queryByText(/notifications.settings.channel.email/i)).toBeNull();
  });

  it('greys out telegram column when not linked', async () => {
    const { container } = renderWithProviders(<NotificationPreferences telegramLinked={false} />);
    await screen.findAllByText(/notifications.settings.channel.telegram/i);
    // Status block + every telegram toggle cell carries data-channel="telegram" data-disabled="true".
    const disabledCells = container.querySelectorAll('[data-channel="telegram"][data-disabled="true"]');
    expect(disabledCells.length).toBeGreaterThanOrEqual(2);
  });

  it('telegram toggles are enabled when linked', async () => {
    const { container } = renderWithProviders(<NotificationPreferences telegramLinked={true} />);
    await screen.findAllByText(/notifications.settings.channel.telegram/i);
    const enabledCells = container.querySelectorAll('[data-channel="telegram"][data-disabled="false"]');
    expect(enabledCells.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT show daily digest hour picker by default (telegram=immediate)', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={true} />);
    await screen.findAllByText(/notifications.settings.channel.telegram/i);
    expect(screen.queryByText(/notifications.settings.dailyHour/i)).toBeNull();
  });

  it('save calls updatePreferences with current matrix', async () => {
    renderWithProviders(<NotificationPreferences telegramLinked={true} />);
    await screen.findAllByText(/notifications.settings.channel.telegram/i);
    const save = screen.getByRole('button', { name: /common.save/i });
    await userEvent.click(save);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('save shows error when API returns success=false', async () => {
    mockUpdate.mockResolvedValueOnce({
      success: false,
      error: { code: 'INVALID_PREFERENCES', message: 'bad hour' },
    });

    renderWithProviders(<NotificationPreferences telegramLinked={true} />);
    await screen.findAllByText(/notifications.settings.channel.telegram/i);
    const save = screen.getByRole('button', { name: /common.save/i });
    await userEvent.click(save);

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
