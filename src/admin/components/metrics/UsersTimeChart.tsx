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
import type { BiTimeseriesDto } from '@/services/api/adminApi';

interface Props {
  data: BiTimeseriesDto | null;
}

export function UsersTimeChart({ data }: Props) {
  if (!data || data.days.length === 0) {
    return <div className="text-sm text-muted-foreground">No data.</div>;
  }

  const chartData = data.days.map((d, i) => ({
    date: d,
    registered: data.registered[i] ?? 0,
    dau: data.dau[i] ?? 0,
    mau: data.mau[i] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="registered" stroke="#8884d8" dot={false} />
        <Line type="monotone" dataKey="dau" stroke="#82ca9d" dot={false} />
        <Line type="monotone" dataKey="mau" stroke="#ffc658" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
