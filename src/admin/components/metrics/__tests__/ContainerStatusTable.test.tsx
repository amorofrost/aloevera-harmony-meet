import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContainerStatusTable } from '../ContainerStatusTable';
import type { ContainerStatusDto } from '@/services/api/adminApi';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    (<div style={{ width: 400, height: 160 }}>{children}</div>) };
});

const containers: ContainerStatusDto[] = [
  { name: 'backend', status: 'green', heartbeatAgeSeconds: 12, gcHeapMb: 38, workingSetMb: 142,
    threadCount: 24, cpuPercent: 5, note: null, startedAtUtc: null, version: '1.0' },
];

const emptySeries = { heapMb: [], workingSetMb: [], threadCount: [], cpuPercent: [] };

describe('ContainerStatusTable', () => {
  it('renders a CPU % column value', () => {
    render(<ContainerStatusTable containers={containers} loading={false}
      expandedContainer={null} onToggle={() => {}} series={null} seriesLoading={false} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onToggle with the container name when a row is clicked', () => {
    const onToggle = vi.fn();
    render(<ContainerStatusTable containers={containers} loading={false}
      expandedContainer={null} onToggle={onToggle} series={null} seriesLoading={false} />);
    fireEvent.click(screen.getByText('backend'));
    expect(onToggle).toHaveBeenCalledWith('backend');
  });

  it('renders the chart grid when the row is expanded', () => {
    render(<ContainerStatusTable containers={containers} loading={false}
      expandedContainer="backend" onToggle={() => {}} series={emptySeries} seriesLoading={false} />);
    expect(screen.getByText('Heap MB')).toBeInTheDocument();
    expect(screen.getByText('CPU %')).toBeInTheDocument();
  });
});
