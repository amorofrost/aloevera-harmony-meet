import type { TimeseriesPointDto } from '@/services/api/adminApi';

interface Props {
  points: TimeseriesPointDto[];
}

export function RequestVolumeTable({ points }: Props) {
  if (points.length === 0) {
    return <div className="text-sm text-muted-foreground">No request data.</div>;
  }

  const top = points.slice(0, 10);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="py-2 text-left">Time</th>
          <th className="text-right">Count</th>
          <th className="text-right">p95 ms</th>
        </tr>
      </thead>
      <tbody>
        {top.map((p) => (
          <tr key={p.ts} className="border-t border-border">
            <td className="py-1">{p.ts}</td>
            <td className="text-right">{p.count}</td>
            <td className="text-right">{p.p95 !== null ? Math.round(p.p95) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
