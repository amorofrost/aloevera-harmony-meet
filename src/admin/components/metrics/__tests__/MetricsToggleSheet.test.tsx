import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MetricsToggleSheet } from '@/admin/components/metrics/MetricsToggleSheet';

vi.mock('@/services/api/adminApi', () => ({
  adminApi: {
    metrics: {
      getConfig: vi.fn().mockResolvedValue({
        success: true,
        data: {
          requestTiming: true, biEvents: true, containerStats: true, frontendPerf: true,
          retentionMinuteHours: 24, retentionHourDays: 90, retentionDauDays: 30,
        },
      }),
      putConfig: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}));

vi.mock('@/components/ui/sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/apiError', () => ({ showApiError: vi.fn() }));

describe('MetricsToggleSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls putConfig with the current config when Save is clicked', async () => {
    const { adminApi } = await import('@/services/api/adminApi');
    render(<MetricsToggleSheet open onOpenChange={() => {}} />);
    await waitFor(() => screen.getByText('Save'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect((adminApi as any).metrics.putConfig).toHaveBeenCalled());
  });

  it('renders all 4 toggle switches when open', async () => {
    render(<MetricsToggleSheet open onOpenChange={() => {}} />);
    await waitFor(() => screen.getByText('Request timing (backend)'));
    expect(screen.getByText('BI events')).toBeInTheDocument();
    expect(screen.getByText('Container stats')).toBeInTheDocument();
    expect(screen.getByText('Request timing (frontend)')).toBeInTheDocument();
  });

  it('renders all 3 retention number inputs when open', async () => {
    render(<MetricsToggleSheet open onOpenChange={() => {}} />);
    await waitFor(() => screen.getByText('Minute tier (hours)'));
    expect(screen.getByText('Hour tier (days)')).toBeInTheDocument();
    expect(screen.getByText('DAU (days)')).toBeInTheDocument();
  });

  it('does not render when closed (cfg not loaded)', () => {
    render(<MetricsToggleSheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });
});
