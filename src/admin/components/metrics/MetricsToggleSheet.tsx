import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { adminApi, type MetricsAdminConfigDto } from '@/services/api/adminApi';
import { showApiError } from '@/lib/apiError';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function MetricsToggleSheet({ open, onOpenChange }: Props) {
  const [cfg, setCfg] = useState<MetricsAdminConfigDto | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    adminApi.metrics.getConfig().then(r => { if (r.success && r.data) setCfg(r.data); });
  }, [open]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await adminApi.metrics.putConfig(cfg);
      if (!r.success) throw r;
      toast.success('Settings saved');
      onOpenChange(false);
    } catch (e) {
      showApiError(e, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return null;

  const Toggle = ({ field, label }: { field: keyof MetricsAdminConfigDto; label: string }) => (
    <div className="flex items-center justify-between py-2">
      <Label htmlFor={field}>{label}</Label>
      <Switch id={field} checked={cfg[field] as boolean}
              onCheckedChange={v => setCfg({ ...cfg, [field]: v })} />
    </div>
  );

  const NumInput = ({ field, label }: { field: keyof MetricsAdminConfigDto; label: string }) => (
    <div className="space-y-1 py-2">
      <Label htmlFor={field}>{label}</Label>
      <Input id={field} type="number" min={1}
             value={cfg[field] as number}
             onChange={e => setCfg({ ...cfg, [field]: parseInt(e.target.value) || 1 })} />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Metrics collection settings</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1 divide-y">
          <div className="pb-2">
            <h3 className="text-sm font-semibold mb-1">Categories</h3>
            <Toggle field="requestTiming" label="Request timing (backend)" />
            <Toggle field="biEvents" label="BI events" />
            <Toggle field="containerStats" label="Container stats" />
            <Toggle field="frontendPerf" label="Request timing (frontend)" />
          </div>
          <div className="pt-2">
            <h3 className="text-sm font-semibold mb-1">Retention</h3>
            <NumInput field="retentionMinuteHours" label="Minute tier (hours)" />
            <NumInput field="retentionHourDays" label="Hour tier (days)" />
            <NumInput field="retentionDauDays" label="DAU (days)" />
          </div>
          <div className="pt-4">
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
