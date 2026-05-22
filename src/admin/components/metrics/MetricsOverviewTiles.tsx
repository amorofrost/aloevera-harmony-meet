import { Card } from '@/components/ui/card';
import type { MetricsOverviewDto } from '@/services/api/adminApi';

interface Props {
  data: MetricsOverviewDto | null;
  loading: boolean;
}

function Tile({ label, value }: { label: string; value: string | number | null }) {
  return (
    <Card className="p-4 flex flex-col items-center text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">
        {value === null ? '—' : value}
      </div>
    </Card>
  );
}

export function MetricsOverviewTiles({ data, loading }: Props) {
  const v = (x: number | null | undefined) => (loading || x === undefined || x === null ? null : x);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Tile label="Registered" value={v(data?.registered)} />
      <Tile label="DAU" value={v(data?.dau)} />
      <Tile label="MAU" value={v(data?.mau)} />
      <Tile label="Online now" value={v(data?.currentlyActive)} />
      <Tile label="Req / hr" value={v(data?.requestsLastHour)} />
    </div>
  );
}
