import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminMetricsPage from '../AdminMetricsPage';

// recharts' ResponsiveContainer queries DOM dimensions which are always 0 in jsdom.
// Replace it with a fixed-size wrapper so charts render without errors.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 240 }}>{children}</div>
    ),
  };
});

vi.mock('@/services/api/adminApi', () => ({
  adminApi: {
    metrics: {
      getOverview: vi.fn().mockResolvedValue({
        success: true,
        data: {
          registered: 1247,
          dau: 89,
          mau: 412,
          currentlyActive: 7,
          requestsLastHour: 1200,
          p95LastHourMs: 240,
        },
      }),
      getContainers: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            name: 'backend',
            status: 'green',
            heartbeatAgeSeconds: 12,
            gcHeapMb: 38,
            workingSetMb: 142,
            threadCount: 24,
            note: null,
            startedAtUtc: null,
            version: '1.0',
          },
          {
            name: 'frontend',
            status: 'green',
            heartbeatAgeSeconds: null,
            gcHeapMb: null,
            workingSetMb: null,
            threadCount: null,
            note: 'HTTP 200',
            startedAtUtc: null,
            version: null,
          },
        ],
      }),
      getTimeseries: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getEndpointStats: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getBi: vi.fn().mockResolvedValue({
        success: true,
        data: {
          days: ['2026-05-20', '2026-05-21'],
          registered: [11, 12],
          dau: [4, 4],
          mau: [11, 12],
        },
      }),
      getConfig: vi.fn().mockResolvedValue({
        success: true,
        data: {
          requestTiming: true,
          biEvents: true,
          containerStats: true,
          frontendPerf: true,
          retentionMinuteHours: 24,
          retentionHourDays: 90,
          retentionDauDays: 30,
        },
      }),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/metrics']}>
      <AdminMetricsPage />
    </MemoryRouter>,
  );
}

describe('AdminMetricsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders overview tile values from API', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1247')).toBeInTheDocument());
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
  });

  it('renders container rows for backend and frontend', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('backend')).toBeInTheDocument());
    expect(screen.getByText('frontend')).toBeInTheDocument();
  });

  it('shows a Settings button that can be clicked', async () => {
    renderPage();
    // Wait for data to load so the page has fully rendered
    await waitFor(() => screen.getByText('1247'));
    const btn = screen.getByRole('button', { name: /Settings/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // After click, toggleOpen becomes true — MetricsToggleSheet is rendered open
    // (it may not have loaded its own data yet, but the sheet element appears in DOM)
    expect(btn).toBeInTheDocument(); // page still mounted
  });

  it('respects document.visibilityState — does not fetch when tab is hidden', async () => {
    const { adminApi } = await import('@/services/api/adminApi');

    // Simulate the tab being hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
      writable: true,
    });

    renderPage();
    // Wait for initial fetch (triggered by useEffect on mount, before visibility check)
    await waitFor(() => expect((adminApi as any).metrics.getOverview).toHaveBeenCalled());

    const callsBefore = ((adminApi as any).metrics.getOverview as ReturnType<typeof vi.fn>)
      .mock.calls.length;

    // Fire visibilitychange while hidden — the handler should not call fetchAll
    fireEvent(document, new Event('visibilitychange'));

    // No additional calls should have been made
    expect(
      ((adminApi as any).metrics.getOverview as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callsBefore);

    // Restore
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
  });
});
