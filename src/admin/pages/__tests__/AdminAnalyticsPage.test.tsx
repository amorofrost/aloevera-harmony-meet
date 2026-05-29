import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAnalyticsPage from '../AdminAnalyticsPage';

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
      getBiOverview: vi.fn().mockResolvedValue({
        success: true,
        data: { registered: 1247, dau: 89, mau: 412, currentlyActive: 7 },
      }),
      getBi: vi.fn().mockResolvedValue({
        success: true,
        data: { days: ['2026-05-27', '2026-05-28'], registered: [11, 12], dau: [4, 4], mau: [11, 12] },
      }),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/analytics']}>
      <AdminAnalyticsPage />
    </MemoryRouter>,
  );
}

describe('AdminAnalyticsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the BI overview tiles from API', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1247')).toBeInTheDocument());
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
  });

  it('renders the user-activity and BI-events sections', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1247')).toBeInTheDocument());
    expect(screen.getByText('User activity over time')).toBeInTheDocument();
    expect(screen.getByText('BI event counts')).toBeInTheDocument();
  });
});
