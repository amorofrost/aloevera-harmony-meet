import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Notification, NotificationType } from '@/types/notification';

// --- Module mocks (must be set up before importing the page) -------------

vi.mock('@/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

// Use `vi.hoisted` so the mock fns can be referenced inside `vi.mock` factories
// (those factories are hoisted to the top of the file).
const {
  mockList,
  mockMarkAllRead,
  mockMarkRead,
  mockGetUserById,
  mockGetEventById,
  mockSendLike,
  mockGetFlags,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockMarkAllRead: vi.fn(() => Promise.resolve({ success: true })),
  mockMarkRead: vi.fn(() => Promise.resolve({ success: true })),
  mockGetUserById: vi.fn(),
  mockGetEventById: vi.fn(),
  mockSendLike: vi.fn(),
  mockGetFlags: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: { feedEnabled: true },
      timestamp: '',
    }),
  ),
}));

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    notificationsApi: {
      list: mockList,
      markAllRead: mockMarkAllRead,
      markRead: mockMarkRead,
      unreadCount: vi.fn(),
      dismiss: vi.fn(),
      getPreferences: vi.fn(),
      updatePreferences: vi.fn(),
      getAvailability: vi.fn(),
    },
    usersApi: { ...actual.usersApi, getUserById: mockGetUserById },
    eventsApi: { ...actual.eventsApi, getEventById: mockGetEventById },
    matchingApi: { ...actual.matchingApi, sendLike: mockSendLike },
    featuresApi: { getFlags: mockGetFlags },
  };
});

// Import after the mocks so the module picks up the mocked services.
import Feed from '@/pages/Feed';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { useNotificationStore } from '@/stores/notificationStore';
import { __clearFeedContextCache } from '@/components/feed/feedContextCache';

function makeNotification(
  type: NotificationType,
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: `n-${type}-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'me',
    type,
    actorId: 'actor-1',
    actorName: 'Alice',
    actorAvatar: null,
    payloadJson: '{}',
    createdAtUtc: new Date().toISOString(),
    readAtUtc: null,
    dismissedAtUtc: null,
    digestGroupId: null,
    ...overrides,
  };
}

function renderFeed() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <FeatureFlagsProvider>
          <Feed />
        </FeatureFlagsProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('Feed page', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockMarkAllRead.mockClear();
    mockMarkRead.mockClear();
    mockGetUserById.mockReset();
    mockGetEventById.mockReset();
    mockSendLike.mockReset();
    __clearFeedContextCache();
    useNotificationStore.setState({ items: [], unreadCount: 0 });

    // Default: actor/event lookups return a minimal placeholder.
    mockGetUserById.mockResolvedValue({
      success: true,
      data: {
        id: 'actor-1',
        name: 'Alice',
        age: 28,
        bio: '',
        location: 'Moscow, Russia',
        country: 'RU',
        region: 'Moscow',
        gender: 'female',
        profileImage: '',
        images: [],
        lastSeen: new Date(),
        isOnline: false,
        preferences: { ageRange: [18, 65], maxDistance: 50, showMe: 'everyone' },
        settings: {
          profileVisibility: 'public',
          anonymousLikes: false,
          language: 'ru',
          notifications: true,
        },
        rank: 'novice',
        staffRole: 'none',
      },
      timestamp: '',
    });
    mockGetEventById.mockResolvedValue({
      success: true,
      data: {
        id: 'evt-1',
        title: 'Summer Show',
        description: '',
        imageUrl: 'https://example.com/cover.jpg',
        date: new Date('2026-07-01T18:00:00Z'),
        location: 'Park',
        attendees: [],
        category: 'concert',
        organizer: 'AloeVera',
      },
      timestamp: '',
    });
  });

  it('renders header title, filter chips, mark-all-read, and bottom nav', async () => {
    mockList.mockResolvedValueOnce({
      success: true,
      data: { items: [], nextCursor: null },
      timestamp: '',
    });
    renderFeed();
    // Header title — `notifications.feedTitle` resolves to "Лента" (ru) by default.
    await screen.findByRole('heading', { level: 1 });
    // Filter chips
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    // Bottom nav renders links — the friends link is always present.
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Друзья|Friends/i })).toBeInTheDocument();
    });
  });

  it('shows empty state when there are no notifications', async () => {
    mockList.mockResolvedValueOnce({
      success: true,
      data: { items: [], nextCursor: null },
      timestamp: '',
    });
    renderFeed();
    await screen.findByText(/Уведомлений пока нет|No notifications yet/i);
  });

  it('renders a rich card for each notification type', async () => {
    const notifications: Notification[] = [
      makeNotification('likeReceived'),
      makeNotification('matchCreated'),
      makeNotification('messageReceived', {
        payloadJson: JSON.stringify({ preview: 'Hi there', chatId: 'chat-1' }),
      }),
      makeNotification('forumReplyToThread', {
        payloadJson: JSON.stringify({ topicId: 't-1', topicTitle: 'Welcome' }),
      }),
      makeNotification('eventPublished', {
        payloadJson: JSON.stringify({ eventId: 'evt-1', eventTitle: 'Summer Show' }),
      }),
      makeNotification('eventReminder', {
        payloadJson: JSON.stringify({ eventId: 'evt-1', eventTitle: 'Summer Show' }),
      }),
      makeNotification('eventInviteReceived', {
        payloadJson: JSON.stringify({
          eventId: 'evt-1',
          eventTitle: 'Summer Show',
          inviteCode: 'SUMMER-2026',
        }),
      }),
      makeNotification('communityBroadcast', {
        payloadJson: JSON.stringify({
          title: 'Hello',
          body: 'Big news for everyone',
          link: '/aloevera',
        }),
      }),
      makeNotification('rankUp', {
        payloadJson: JSON.stringify({
          previousRank: 'novice',
          newRank: 'activeMember',
        }),
      }),
    ];
    mockList.mockResolvedValueOnce({
      success: true,
      data: { items: notifications, nextCursor: null },
      timestamp: '',
    });

    renderFeed();

    // Each card renders as a role=button (the FeedCard shell). Wait for
    // notifications to render, then assert the number of button-cards matches.
    await waitFor(() => {
      // role=button matches both header buttons (back, mark-all-read, filters)
      // AND the card shells. We instead look for distinguishing per-card text.
      expect(screen.getByText(/Big news for everyone/)).toBeInTheDocument();
    });

    // Like / Match / Message — actor name appears
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    // Message preview — appears both in the auto-formatted title and the
    // italicised body, so use getAllByText.
    expect(screen.getAllByText(/Hi there/).length).toBeGreaterThan(0);
    // Forum topic title
    expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    // Event card title appears (at least once from the EventFeedCard body)
    expect(screen.getAllByText(/Summer Show/).length).toBeGreaterThan(0);
    // Invite code
    expect(screen.getByText(/SUMMER-2026/)).toBeInTheDocument();
    // Rank up — the new rank label appears
    expect(
      screen.getAllByText(/Active Member|Активный участник/).length,
    ).toBeGreaterThan(0);
  });

  it('marks all as read when the button is clicked', async () => {
    const user = userEvent.setup();
    const unread = makeNotification('likeReceived');
    mockList.mockResolvedValueOnce({
      success: true,
      data: { items: [unread], nextCursor: null },
      timestamp: '',
    });
    renderFeed();
    // Wait for load to settle so the button is reachable.
    await screen.findAllByText(/Alice/);

    const markAll = screen.getByRole('button', {
      name: /Отметить все прочитанными|Mark all as read/i,
    });
    await user.click(markAll);
    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it('switches between All and Unread filter chips', async () => {
    const user = userEvent.setup();
    const read = makeNotification('likeReceived', {
      id: 'read-1',
      readAtUtc: new Date().toISOString(),
    });
    const unread = makeNotification('matchCreated', { id: 'unread-1' });
    mockList.mockResolvedValueOnce({
      success: true,
      data: { items: [read, unread], nextCursor: null },
      timestamp: '',
    });
    renderFeed();
    // Both notifications mention Alice — wait for both cards to render.
    await waitFor(() => {
      expect(screen.getAllByText(/Alice/).length).toBeGreaterThanOrEqual(2);
    });

    const unreadChip = screen.getByRole('button', {
      name: /^(Непрочитанные|Unread)$/i,
    });
    await user.click(unreadChip);

    // After switching filters the empty state isn't reached because at least
    // one unread item remains. Verify the chip is now visually "default"
    // (selected) by checking that pressing "All" returns full set.
    const allChip = screen.getByRole('button', { name: /^(Все|All)$/i });
    await user.click(allChip);
    await waitFor(() => {
      expect(screen.getAllByText(/Alice/).length).toBeGreaterThanOrEqual(2);
    });
  });
});
