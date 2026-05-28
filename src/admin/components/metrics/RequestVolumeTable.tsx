import { useMemo, useState } from 'react';
import type { EndpointStatDto } from '@/services/api/adminApi';

interface Props {
  endpoints: EndpointStatDto[];
  loading: boolean;
  selectedKey: string | null;
  onSelect: (ep: EndpointStatDto) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  POST:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PUT:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PATCH:  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_COLORS[method.toUpperCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-block text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {method.toUpperCase()}
    </span>
  );
}

function fmt(ms: number | null) {
  return ms !== null ? `${Math.round(ms)}` : '—';
}

export function RequestVolumeTable({ endpoints, loading, selectedKey, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [activeMethods, setActiveMethods] = useState<Set<string>>(new Set(METHODS));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return endpoints.filter((ep) => {
      if (!activeMethods.has(ep.method.toUpperCase())) return false;
      if (!q) return true;
      return `${ep.method} ${ep.route}`.toLowerCase().includes(q);
    });
  }, [endpoints, search, activeMethods]);

  function toggleMethod(m: string) {
    setActiveMethods((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by route or method…"
          aria-label="Filter endpoints"
          className="flex-1 min-w-[160px] text-sm px-2 py-1 rounded border border-border bg-background"
        />
        <div className="flex gap-1">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMethod(m)}
              aria-pressed={activeMethods.has(m)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                activeMethods.has(m)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No matching endpoints.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-2 text-left pr-2">Method</th>
                <th className="text-left pr-2">Route</th>
                <th className="text-right pr-2">Count</th>
                <th className="text-right pr-2">p50 ms</th>
                <th className="text-right">p95 ms</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ep) => (
                <tr
                  key={ep.routeKey}
                  onClick={() => onSelect(ep)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(ep);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={ep.routeKey === selectedKey}
                  className={`border-t border-border cursor-pointer hover:bg-muted/50 ${
                    ep.routeKey === selectedKey ? 'bg-muted' : ''
                  }`}
                >
                  <td className="py-1 pr-2"><MethodBadge method={ep.method} /></td>
                  <td className="pr-2 font-mono text-xs break-all">{ep.route}</td>
                  <td className="text-right pr-2 tabular-nums">{ep.count.toLocaleString()}</td>
                  <td className="text-right pr-2 tabular-nums text-muted-foreground">{fmt(ep.p50)}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{fmt(ep.p95)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
