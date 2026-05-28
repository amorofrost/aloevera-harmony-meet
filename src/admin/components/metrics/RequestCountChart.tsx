import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TimeseriesPointDto } from '@/services/api/adminApi';

interface Props {
  points: TimeseriesPointDto[];
}

export function RequestCountChart({ points }: Props) {
  if (points.length === 0) {
    return <div className="text-sm text-muted-foreground">No request data.</div>;
  }

  const data = points.map((p) => ({ ts: p.ts, count: p.count }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip formatter={(v: number) => `${v} calls`} />
        <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
