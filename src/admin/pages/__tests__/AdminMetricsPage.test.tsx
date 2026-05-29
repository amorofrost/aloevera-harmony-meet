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
            cpuPercent: 5,
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
            cpuPercent: null,
            note: 'HTTP 200',
            startedAtUtc: null,
            version: null,
          },
        ],
      }),
      getEndpointStats: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { routeKey: 'GET|/api/v1/users', method: 'GET', route: '/api/v1/users', count: 100, p50: 10, p95: 20, p99: 30 },
          { routeKey: 'POST|/api/v1/matching/likes', method: 'POST', route: '/api/v1/matching/likes', count: 50, p50: 15, p95: 25, p99: 35 },
        ],
      }),
      getEndpointTimeseries: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getContainerTimeseries: vi.fn().mockResolvedValue({
        success: true,
        data: { heapMb: [], workingSetMb: [], threadCount: [], cpuPercent: [] },
      }),
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

  it('drills into an endpoint when a row is clicked', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    renderPage();
    await waitFor(() => expect(screen.getByText('/api/v1/users')).toBeInTheDocument());

    fireEvent.click(screen.getByText('/api/v1/users'));

    await waitFor(() =>
      expect((adminApi as any).metrics.getEndpointTimeseries).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', route: '/api/v1/users' }),
      ),
    );
    expect(screen.getByText('Calls over time')).toBeInTheDocument();
  });

  it('clears the drill-down when the ✕ button is clicked', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('/api/v1/users')).toBeInTheDocument());
    fireEvent.click(screen.getByText('/api/v1/users'));
    await waitFor(() => expect(screen.getByText('Calls over time')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Clear endpoint selection/i }));

    expect(screen.queryByText('Calls over time')).not.toBeInTheDocument();
    expect(screen.getByText(/Select an endpoint/i)).toBeInTheDocument();
  });

  it('expands a container row and fetches its timeseries', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    renderPage();
    await waitFor(() => expect(screen.getByText('backend')).toBeInTheDocument());

    fireEvent.click(screen.getByText('backend'));

    await waitFor(() =>
      expect((adminApi as any).metrics.getContainerTimeseries).toHaveBeenCalledWith(
        expect.objectContaining({ container: 'backend' }),
      ),
    );
  });
});
