import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerEndpointMetricsPanel } from '@/admin/components/metrics/PerEndpointMetricsPanel';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 240 }}>{children}</div>
    ),
  };
});

const getDimensions = vi.fn();
const getTimeseries = vi.fn();

vi.mock('@/services/api/adminApi', () => ({
  adminApi: {
    metrics: {
      getDimensions: (...args: unknown[]) => getDimensions(...args),
      getTimeseries: (...args: unknown[]) => getTimeseries(...args),
    },
  },
}));

const window = {
  category: 'request_timing',
  from: '2026-05-22T00:00:00Z',
  to: '2026-05-23T00:00:00Z',
  resolution: 'minute' as const,
};

describe('PerEndpointMetricsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTimeseries.mockResolvedValue({ success: true, data: [] });
  });

  it('renders endpoint rows when dimensions are returned', async () => {
    getDimensions.mockResolvedValue({
      success: true,
      data: [
        { dimensionKey: 'backend|GET|~api~v1~users~me|200', count: 412, p50: 38, p95: 142, p99: 410 },
        { dimensionKey: 'backend|POST|~api~v1~messages|200', count: 187, p50: 64, p95: 220, p99: 612 },
      ],
    });

    render(<PerEndpointMetricsPanel {...window} />);

    // The selected-key label echoes the busiest endpoint, so this string appears
    // twice (table row + label). Assert both endpoint keys are present at least
    // once, and the count column rendered.
    await waitFor(() =>
      expect(screen.getAllByText(/backend\|GET\|\/api\/v1\/users\/me\|200/).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/backend\|POST\|\/api\/v1\/messages\|200/).length).toBeGreaterThan(0);
    expect(screen.getByText('412')).toBeInTheDocument();
  });

  it('shows manual key input when dimensions list is empty', async () => {
    getDimensions.mockResolvedValue({ success: true, data: [] });

    render(<PerEndpointMetricsPanel {...window} />);

    await waitFor(() =>
      expect(screen.getByLabelText('Dimension key')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Endpoint list unavailable/)).toBeInTheDocument();
  });

  it('fetches series for manually-entered key', async () => {
    getDimensions.mockResolvedValue({ success: true, data: [] });

    render(<PerEndpointMetricsPanel {...window} />);

    const input = await screen.findByLabelText('Dimension key');
    fireEvent.change(input, { target: { value: 'backend|GET|~api~v1~ping|200' } });
    fireEvent.click(screen.getByRole('button', { name: /Load/ }));

    await waitFor(() =>
      expect(getTimeseries).toHaveBeenCalledWith(
        expect.objectContaining({ dimensionKey: 'backend|GET|~api~v1~ping|200' }),
      ),
    );
  });

  it('auto-selects the busiest endpoint and fetches its series', async () => {
    getDimensions.mockResolvedValue({
      success: true,
      data: [
        { dimensionKey: 'backend|GET|~a|200', count: 10, p50: 1, p95: 2, p99: 3 },
        { dimensionKey: 'backend|GET|~b|200', count: 99, p50: 4, p95: 5, p99: 6 },
      ],
    });

    render(<PerEndpointMetricsPanel {...window} />);

    await waitFor(() =>
      expect(getTimeseries).toHaveBeenCalledWith(
        expect.objectContaining({ dimensionKey: 'backend|GET|~b|200' }),
      ),
    );
  });
});
