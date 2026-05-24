import type { EndpointStatDto } from '@/services/api/adminApi';

interface Props {
  endpoints: EndpointStatDto[];
  loading: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  POST:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PUT:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PATCH:  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_COLORS[method.toUpperCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-block text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {method.toUpperCase()}
    </span>
  );
}

function statusColor(code: number | null) {
  if (code === null) return '';
  if (code < 300) return 'text-green-600 dark:text-green-400';
  if (code < 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function fmt(ms: number | null) {
  return ms !== null ? `${Math.round(ms)}` : '—';
}

export function RequestVolumeTable({ endpoints, loading }: Props) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (endpoints.length === 0) {
    return <div className="text-sm text-muted-foreground">No request data.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-2 text-left pr-2">Method</th>
            <th className="text-left pr-2">Route</th>
            <th className="text-right pr-2">Status</th>
            <th className="text-right pr-2">Count</th>
            <th className="text-right pr-2">p50 ms</th>
            <th className="text-right">p95 ms</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((ep) => (
            <tr key={ep.dimensionKey} className="border-t border-border">
              <td className="py-1 pr-2">
                <MethodBadge method={ep.method} />
              </td>
              <td className="pr-2 font-mono text-xs break-all">{ep.route}</td>
              <td className={`text-right pr-2 font-mono tabular-nums ${statusColor(ep.statusCode)}`}>
                {ep.statusCode ?? '—'}
              </td>
              <td className="text-right pr-2 tabular-nums">{ep.count.toLocaleString()}</td>
              <td className="text-right pr-2 tabular-nums text-muted-foreground">{fmt(ep.p50)}</td>
              <td className="text-right tabular-nums text-muted-foreground">{fmt(ep.p95)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
