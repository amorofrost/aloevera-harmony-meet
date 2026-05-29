import type { BiOverviewDto } from '@/services/api/adminApi';
import { MetricTile } from './MetricTile';

interface Props {
  data: BiOverviewDto | null;
  loading: boolean;
}

export function BiOverviewTiles({ data, loading }: Props) {
  const v = (x: number | null | undefined) => (loading || x === undefined || x === null ? null : x);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricTile label="Registered" value={v(data?.registered)} />
      <MetricTile label="DAU" value={v(data?.dau)} />
      <MetricTile label="MAU" value={v(data?.mau)} />
      <MetricTile label="Online now" value={v(data?.currentlyActive)} />
    </div>
  );
}
