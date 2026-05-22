import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TimeseriesPointDto } from '@/services/api/adminApi';

interface Props {
  points: TimeseriesPointDto[];
}

export function LatencyChart({ points }: Props) {
  if (points.length === 0) {
    return <div className="text-sm text-muted-foreground">No latency data.</div>;
  }

  const data = points.map((p) => ({
    ts: p.ts,
    p50: p.p50 ?? 0,
    p95: p.p95 ?? 0,
    p99: p.p99 ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="ms" />
        <Tooltip formatter={(v: number) => `${Math.round(v)} ms`} />
        <Legend />
        <Line type="monotone" dataKey="p50" stroke="#82ca9d" dot={false} />
        <Line type="monotone" dataKey="p95" stroke="#8884d8" dot={false} />
        <Line type="monotone" dataKey="p99" stroke="#ff7f50" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
