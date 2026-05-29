import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BiOverviewTiles } from '../BiOverviewTiles';

describe('BiOverviewTiles', () => {
  it('renders the four BI KPI values', () => {
    render(<BiOverviewTiles data={{ registered: 1247, dau: 89, mau: 412, currentlyActive: 7 }} loading={false} />);
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByText('1247')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
    expect(screen.getByText('Online now')).toBeInTheDocument();
  });

  it('shows em-dash when loading', () => {
    render(<BiOverviewTiles data={null} loading={true} />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});
