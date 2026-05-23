import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  type DimensionRowDto,
  type TimeseriesPointDto,
} from '@/services/api/adminApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LatencyChart } from './LatencyChart';

interface Props {
  category: string;
  from: string;
  to: string;
  resolution: 'minute' | 'hour';
}

type SortKey = 'count' | 'p50' | 'p95' | 'p99';

function formatMs(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)}`;
}

// Backend stores routes with `/` replaced by `~` to satisfy Azure Table key rules
// (see docs/MONITORING.md §"Critical Azure Table constraint"). Render the original
// form so the table reads naturally.
function humanizeDimensionKey(k: string): string {
  return k.replace(/~/g, '/');
}

export function PerEndpointMetricsPanel({ category, from, to, resolution }: Props) {
  const [dimensions, setDimensions] = useState<DimensionRowDto[]>([]);
  const [dimensionsAvailable, setDimensionsAvailable] = useState(true);
  const [loadingDimensions, setLoadingDimensions] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState('');
  const [series, setSeries] = useState<TimeseriesPointDto[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  // Refetch the endpoint list whenever the time window or category changes.
  useEffect(() => {
    let cancelled = false;
    setLoadingDimensions(true);
    void adminApi.metrics
      .getDimensions({ category, from, to, limit: 50 })
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) {
          setDimensions(r.data);
          setDimensionsAvailable(r.data.length > 0);
        } else {
          setDimensions([]);
          setDimensionsAvailable(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDimensions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, from, to]);

  const sortedDimensions = useMemo(() => {
    const copy = [...dimensions];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (bv as number) - (av as number);
    });
    return copy;
  }, [dimensions, sortKey]);

  const fetchSeries = useCallback(
    async (key: string) => {
      setSeriesLoading(true);
      setSeriesError(null);
      try {
        const r = await adminApi.metrics.getTimeseries({
          category,
          dimensionKey: key,
          from,
          to,
          resolution,
        });
        if (r.success && r.data) {
          setSeries(r.data);
        } else {
          setSeries([]);
          setSeriesError(r.error?.message ?? 'Failed to load series.');
        }
      } finally {
        setSeriesLoading(false);
      }
    },
    [category, from, to, resolution],
  );

  // Auto-pick the busiest endpoint once dimensions load.
  useEffect(() => {
    if (selectedKey || sortedDimensions.length === 0) return;
    const first = sortedDimensions[0];
    setSelectedKey(first.dimensionKey);
    void fetchSeries(first.dimensionKey);
  }, [sortedDimensions, selectedKey, fetchSeries]);

  // Refetch series for the selected key when the time window changes.
  useEffect(() => {
    if (selectedKey) void fetchSeries(selectedKey);
  }, [from, to, resolution, selectedKey, fetchSeries]);

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualKey.trim();
    if (!trimmed) return;
    setSelectedKey(trimmed);
    void fetchSeries(trimmed);
  };

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => setSortKey(k)}
      className={`text-right w-full ${sortKey === k ? 'font-semibold text-foreground' : ''}`}
    >
      {label}
      {sortKey === k ? ' ▼' : ''}
    </button>
  );

  return (
    <div className="space-y-4">
      {dimensionsAvailable ? (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Per-endpoint breakdown (click a row to see its latency chart)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2 text-left">Endpoint</th>
                  <th className="text-right w-20"><SortButton k="count" label="Count" /></th>
                  <th className="text-right w-20"><SortButton k="p50" label="p50 ms" /></th>
                  <th className="text-right w-20"><SortButton k="p95" label="p95 ms" /></th>
                  <th className="text-right w-20"><SortButton k="p99" label="p99 ms" /></th>
                </tr>
              </thead>
              <tbody>
                {loadingDimensions && dimensions.length === 0 ? (
                  <tr><td colSpan={5} className="py-3 text-muted-foreground">Loading…</td></tr>
                ) : (
                  sortedDimensions.map((d) => {
                    const active = d.dimensionKey === selectedKey;
                    return (
                      <tr
                        key={d.dimensionKey}
                        onClick={() => {
                          setSelectedKey(d.dimensionKey);
                          void fetchSeries(d.dimensionKey);
                        }}
                        className={`border-t border-border cursor-pointer hover:bg-muted/40 ${
                          active ? 'bg-muted/60' : ''
                        }`}
                      >
                        <td className="py-1 font-mono text-xs">
                          {humanizeDimensionKey(d.dimensionKey)}
                        </td>
                        <td className="text-right">{d.count}</td>
                        <td className="text-right">{formatMs(d.p50)}</td>
                        <td className="text-right">{formatMs(d.p95)}</td>
                        <td className="text-right">{formatMs(d.p99)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Endpoint list unavailable (backend{' '}
            <code className="font-mono">/admin/metrics/dimensions</code> endpoint not deployed
            yet). Enter a dimension key manually to see its chart.
          </p>
          <form onSubmit={onManualSubmit} className="flex gap-2">
            <Input
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              placeholder="backend|GET|~api~v1~users~me|200"
              className="font-mono text-xs"
              aria-label="Dimension key"
            />
            <Button type="submit" variant="outline" size="sm">Load</Button>
          </form>
        </div>
      )}

      {selectedKey && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Latency for <span className="font-mono">{humanizeDimensionKey(selectedKey)}</span>
          </p>
          {seriesError ? (
            <div className="text-sm text-destructive">{seriesError}</div>
          ) : seriesLoading && series.length === 0 ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <LatencyChart points={series} />
          )}
        </div>
      )}
    </div>
  );
}
