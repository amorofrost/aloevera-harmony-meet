import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApi,
  type MetricsOverviewDto,
  type ContainerStatusDto,
  type TimeseriesPointDto,
  type BiTimeseriesDto,
} from '@/services/api/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetricsOverviewTiles } from '@/admin/components/metrics/MetricsOverviewTiles';
import { ContainerStatusTable } from '@/admin/components/metrics/ContainerStatusTable';
import { UsersTimeChart } from '@/admin/components/metrics/UsersTimeChart';
import { RequestVolumeTable } from '@/admin/components/metrics/RequestVolumeTable';
import { LatencyChart } from '@/admin/components/metrics/LatencyChart';
import { BiEventsPanel } from '@/admin/components/metrics/BiEventsPanel';
import { MetricsToggleSheet } from '@/admin/components/metrics/MetricsToggleSheet';

type Range = '1h' | '24h' | '7d' | '30d';

function rangeMs(r: Range): number {
  switch (r) {
    case '1h':  return 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d':  return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
  }
}

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const ranges: Range[] = ['1h', '24h', '7d', '30d'];
  return (
    <div className="flex gap-1">
      {ranges.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            value === r
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export default function AdminMetricsPage() {
  const [overview, setOverview] = useState<MetricsOverviewDto | null>(null);
  const [containers, setContainers] = useState<ContainerStatusDto[]>([]);
  const [bi, setBi] = useState<BiTimeseriesDto | null>(null);
  const [reqTimeseries, setReqTimeseries] = useState<TimeseriesPointDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('24h');
  const [toggleOpen, setToggleOpen] = useState(false);

  // Keep range in a ref so the visibility handler always sees the latest value
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const fetchAll = useCallback(async (currentRange: Range) => {
    const biRange: '24h' | '7d' | '30d' = currentRange === '1h' ? '24h' : currentRange;
    const from = new Date(Date.now() - rangeMs(currentRange)).toISOString();
    const to = new Date().toISOString();
    const resolution: 'minute' | 'hour' =
      currentRange === '1h' || currentRange === '24h' ? 'minute' : 'hour';

    const [ov, ct, biData, ts] = await Promise.all([
      adminApi.metrics.getOverview(),
      adminApi.metrics.getContainers(),
      adminApi.metrics.getBi(biRange),
      adminApi.metrics.getTimeseries({ category: 'request_timing', from, to, resolution }),
    ]);

    if (ov.success && ov.data) setOverview(ov.data);
    if (ct.success && ct.data) setContainers(ct.data);
    if (biData.success && biData.data) setBi(biData.data);
    if (ts.success && ts.data) setReqTimeseries(ts.data);

    setLoading(false);
  }, []);

  // Fetch when range changes
  useEffect(() => {
    setLoading(true);
    void fetchAll(range);
  }, [range, fetchAll]);

  // Auto-refresh every 30s, paused when tab is hidden
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void fetchAll(rangeRef.current);
      }
    };
    const id = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Operational dashboard — refreshes every 30 s when visible.
          </p>
        </div>
        <Button variant="outline" onClick={() => setToggleOpen(true)}>Settings</Button>
        <MetricsToggleSheet open={toggleOpen} onOpenChange={setToggleOpen} />
      </div>

      {/* 1. Overview tiles */}
      <MetricsOverviewTiles data={overview} loading={loading} />

      {/* 2. Container status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Container status</CardTitle>
        </CardHeader>
        <CardContent>
          <ContainerStatusTable containers={containers} loading={loading} />
        </CardContent>
      </Card>

      {/* 3. Users time chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">User activity over time</CardTitle>
            <RangeSelector value={range} onChange={setRange} />
          </div>
        </CardHeader>
        <CardContent>
          <UsersTimeChart data={bi} />
        </CardContent>
      </Card>

      {/* 4. Request volume + latency side-by-side */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Request volume &amp; latency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Recent buckets (top 10)</p>
              <RequestVolumeTable points={reqTimeseries} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Latency percentiles</p>
              <LatencyChart points={reqTimeseries} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. BI events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">BI event counts</CardTitle>
        </CardHeader>
        <CardContent>
          <BiEventsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
