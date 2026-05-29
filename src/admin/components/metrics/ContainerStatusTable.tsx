import type { ContainerStatusDto, ContainerTimeseriesDto } from '@/services/api/adminApi';
import { GaugeBandChart } from './GaugeBandChart';

interface Props {
  containers: ContainerStatusDto[];
  loading: boolean;
  expandedContainer: string | null;
  onToggle: (name: string) => void;
  series: ContainerTimeseriesDto | null;
  seriesLoading: boolean;
}

function dotColor(status: string) {
  if (status === 'green') return 'bg-green-500';
  if (status === 'amber') return 'bg-amber-500';
  return 'bg-red-500';
}

export function ContainerStatusTable({
  containers, loading, expandedContainer, onToggle, series, seriesLoading,
}: Props) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (containers.length === 0) {
    return <div className="text-sm text-muted-foreground">No container data.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-2 pr-4">Name</th>
          <th className="pr-4">Status</th>
          <th className="pr-4">Last seen</th>
          <th className="pr-4">Heap</th>
          <th className="pr-4">WS</th>
          <th className="pr-4">Threads</th>
          <th>CPU</th>
        </tr>
      </thead>
      <tbody>
        {containers.map((c) => {
          const expanded = c.name === expandedContainer;
          return [
            <tr
              key={c.name}
              onClick={() => onToggle(c.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(c.name); }
              }}
              tabIndex={0}
              aria-expanded={expanded}
              className={`border-t border-border cursor-pointer hover:bg-muted/50 ${expanded ? 'bg-muted' : ''}`}
            >
              <td className="py-2 pr-4 font-medium">
                <span className="inline-block mr-1 text-muted-foreground">{expanded ? '▾' : '▸'}</span>
                {c.name}
              </td>
              <td className="pr-4">
                <span className={`inline-block w-2 h-2 rounded-full ${dotColor(c.status)} mr-2`} />
                {c.note ?? c.status}
              </td>
              <td className="pr-4">
                {c.heartbeatAgeSeconds !== null ? `${Math.round(c.heartbeatAgeSeconds)}s ago` : '—'}
              </td>
              <td className="pr-4">{c.gcHeapMb ?? '—'}</td>
              <td className="pr-4">{c.workingSetMb ?? '—'}</td>
              <td className="pr-4">{c.threadCount ?? '—'}</td>
              <td>{c.cpuPercent != null ? Math.round(c.cpuPercent) : '—'}</td>
            </tr>,
            expanded ? (
              <tr key={`${c.name}-detail`} className="border-t border-border bg-muted/30">
                <td colSpan={7} className="p-3">
                  {seriesLoading && !series ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Heap MB</p>
                        <GaugeBandChart points={series?.heapMb ?? []} unit="MB" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Working set MB</p>
                        <GaugeBandChart points={series?.workingSetMb ?? []} unit="MB" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Threads</p>
                        <GaugeBandChart points={series?.threadCount ?? []} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">CPU %</p>
                        <GaugeBandChart points={series?.cpuPercent ?? []} unit="%" />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ) : null,
          ];
        })}
      </tbody>
    </table>
  );
}
