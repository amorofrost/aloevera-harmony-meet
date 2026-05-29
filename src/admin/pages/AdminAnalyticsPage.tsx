import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApi,
  type BiOverviewDto,
  type BiTimeseriesDto,
} from '@/services/api/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BiOverviewTiles } from '@/admin/components/metrics/BiOverviewTiles';
import { UsersTimeChart } from '@/admin/components/metrics/UsersTimeChart';
import { BiEventsPanel } from '@/admin/components/metrics/BiEventsPanel';

type BiRange = '24h' | '7d' | '30d';

function RangeSelector({ value, onChange }: { value: BiRange; onChange: (r: BiRange) => void }) {
  const ranges: BiRange[] = ['24h', '7d', '30d'];
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

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<BiOverviewDto | null>(null);
  const [bi, setBi] = useState<BiTimeseriesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<BiRange>('7d');

  const rangeRef = useRef(range);
  rangeRef.current = range;

  const fetchAll = useCallback(async (currentRange: BiRange) => {
    try {
      const [ov, biData] = await Promise.all([
        adminApi.metrics.getBiOverview(),
        adminApi.metrics.getBi(currentRange),
      ]);
      if (ov.success && ov.data) setOverview(ov.data);
      if (biData.success && biData.data) setBi(biData.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchAll(range);
  }, [range, fetchAll]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void fetchAll(rangeRef.current);
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          User &amp; business metrics — refreshes every 30 s when visible.
        </p>
      </div>

      <BiOverviewTiles data={overview} loading={loading} />

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">BI event counts</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Unwired: BiEventsPanel renders default zeros until a backend feed is wired. */}
          <BiEventsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
