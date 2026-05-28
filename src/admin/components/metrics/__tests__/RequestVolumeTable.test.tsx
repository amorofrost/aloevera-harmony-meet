import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestVolumeTable } from '../RequestVolumeTable';
import type { EndpointStatDto } from '@/services/api/adminApi';

const eps: EndpointStatDto[] = [
  { routeKey: 'GET|/api/v1/users', method: 'GET', route: '/api/v1/users', count: 100, p50: 10, p95: 20, p99: 30 },
  { routeKey: 'POST|/api/v1/matching/likes', method: 'POST', route: '/api/v1/matching/likes', count: 50, p50: 15, p95: 25, p99: 35 },
];

describe('RequestVolumeTable', () => {
  it('renders endpoint rows', () => {
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={() => {}} />);
    expect(screen.getByText('/api/v1/users')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/matching/likes')).toBeInTheDocument();
  });

  it('filters rows by search text', () => {
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByLabelText('Filter endpoints'), { target: { value: 'matching' } });
    expect(screen.queryByText('/api/v1/users')).not.toBeInTheDocument();
    expect(screen.getByText('/api/v1/matching/likes')).toBeInTheDocument();
  });

  it('filters rows by toggling a method pill off', () => {
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'GET' }));
    expect(screen.queryByText('/api/v1/users')).not.toBeInTheDocument();
    expect(screen.getByText('/api/v1/matching/likes')).toBeInTheDocument();
  });

  it('calls onSelect with the endpoint when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<RequestVolumeTable endpoints={eps} loading={false} selectedKey={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('/api/v1/users'));
    expect(onSelect).toHaveBeenCalledWith(eps[0]);
  });
});
