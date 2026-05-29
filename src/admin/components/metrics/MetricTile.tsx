import { Card } from '@/components/ui/card';

export function MetricTile({ label, value }: { label: string; value: string | number | null }) {
  return (
    <Card className="p-4 flex flex-col items-center text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value === null ? '—' : value}</div>
    </Card>
  );
}
