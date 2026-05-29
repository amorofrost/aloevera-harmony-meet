import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { GaugeTimeseriesPointDto } from '@/services/api/adminApi';

interface Props {
  points: GaugeTimeseriesPointDto[];
  unit?: string;
}

export function GaugeBandChart({ points, unit }: Props) {
  if (points.length === 0) {
    return <div className="text-sm text-muted-foreground">No data.</div>;
  }

  // Recharts stacks Areas: render min as a transparent base, then (max - min) as the visible band.
  const data = points.map((p) => ({
    ts: p.ts,
    avg: p.avg ?? 0,
    bandBase: p.min ?? 0,
    bandSpan: (p.max ?? 0) - (p.min ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="ts" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} unit={unit} />
        <Tooltip formatter={(v: number | string) => (unit ? `${Math.round(Number(v))} ${unit}` : `${Math.round(Number(v))}`)} />
        <Area type="monotone" dataKey="bandBase" stackId="band" stroke="none" fill="none" />
        <Area type="monotone" dataKey="bandSpan" stackId="band" stroke="none" fill="#8884d8" fillOpacity={0.15} />
        <Line type="monotone" dataKey="avg" stroke="#8884d8" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
