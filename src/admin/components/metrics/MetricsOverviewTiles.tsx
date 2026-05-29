import type { TechnicalOverviewDto } from '@/services/api/adminApi';
import { MetricTile } from './MetricTile';

interface Props {
  data: TechnicalOverviewDto | null;
  loading: boolean;
}

export function MetricsOverviewTiles({ data, loading }: Props) {
  const v = (x: number | null | undefined) => (loading || x === undefined || x === null ? null : x);
  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricTile label="Req / hr" value={v(data?.requestsLastHour)} />
      <MetricTile label="p95 ms" value={v(data?.p95LastHourMs)} />
    </div>
  );
}
