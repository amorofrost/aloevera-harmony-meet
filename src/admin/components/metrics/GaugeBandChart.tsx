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

function GaugeTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const u = unit ? ` ${unit}` : '';
  const min = d.bandBase;
  const max = d.bandBase + d.bandSpan;
  return (
    <div className="rounded border border-border bg-background px-2 py-1 text-xs shadow">
      <div className="text-muted-foreground">{label}</div>
      <div>avg {Math.round(d.avg)}{u}</div>
      <div className="text-muted-foreground">min {Math.round(min)}{u} · max {Math.round(max)}{u}</div>
    </div>
  );
}

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
        <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit={unit} />
        <Tooltip content={(props) => <GaugeTooltip {...props} unit={unit} />} />
        <Area type="monotone" dataKey="bandBase" stackId="band" stroke="none" fill="none" />
        <Area type="monotone" dataKey="bandSpan" stackId="band" stroke="none" fill="#8884d8" fillOpacity={0.15} />
        <Line type="monotone" dataKey="avg" stroke="#8884d8" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
