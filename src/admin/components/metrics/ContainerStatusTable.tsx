import type { ContainerStatusDto } from '@/services/api/adminApi';

interface Props {
  containers: ContainerStatusDto[];
  loading: boolean;
}

function dotColor(status: string) {
  if (status === 'green') return 'bg-green-500';
  if (status === 'amber') return 'bg-amber-500';
  return 'bg-red-500';
}

export function ContainerStatusTable({ containers, loading }: Props) {
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
          <th className="pr-4">Heap MB</th>
          <th className="pr-4">WS MB</th>
          <th>Threads</th>
        </tr>
      </thead>
      <tbody>
        {containers.map((c) => (
          <tr key={c.name} className="border-t border-border">
            <td className="py-2 pr-4 font-medium">{c.name}</td>
            <td className="pr-4">
              <span
                className={`inline-block w-2 h-2 rounded-full ${dotColor(c.status)} mr-2`}
              />
              {c.note ?? c.status}
            </td>
            <td className="pr-4">
              {c.heartbeatAgeSeconds !== null
                ? `${Math.round(c.heartbeatAgeSeconds)}s ago`
                : '—'}
            </td>
            <td className="pr-4">{c.gcHeapMb ?? '—'}</td>
            <td className="pr-4">{c.workingSetMb ?? '—'}</td>
            <td>{c.threadCount ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
