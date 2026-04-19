import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminApi,
  type AdminContainerInfrastructureDto,
  type AdminInfrastructureStatusDto,
} from "@/services/api/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { showApiError } from "@/lib/apiError";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function byName(a: AdminContainerInfrastructureDto, b: AdminContainerInfrastructureDto) {
  return a.name.localeCompare(b.name);
}

export default function AdminInfrastructurePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminInfrastructureStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getInfrastructure();
      if (!res.success || !res.data) {
        const msg = res.error?.message ?? "Failed to load infrastructure";
        setError(msg);
        toast.error(msg);
        return;
      }
      setData(res.data);
    } catch (err) {
      setError("Failed to load infrastructure");
      showApiError(err, "Failed to load infrastructure");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const containers = useMemo(() => {
    const list = data?.containers ?? [];
    return [...list].sort(byName);
  }, [data]);

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Infrastructure</h1>
          <p className="text-sm text-muted-foreground">
            Live container health snapshot (uptime, CPU, memory). Only visible to admin.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            {data?.generatedAtUtc ? `Generated: ${formatDate(data.generatedAtUtc)}` : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : containers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No container data returned.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {containers.map((c) => {
                const memPct =
                  c.memoryLimitBytes > 0 ? (c.memoryUsageBytes / c.memoryLimitBytes) * 100 : null;
                return (
                  <Card key={c.name}>
                    <CardHeader>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <CardDescription>
                        Started: {c.startedAtUtc ? formatDate(c.startedAtUtc) : "—"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Uptime</span>
                        <span className="font-medium">{formatUptime(c.uptimeSeconds)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">CPU</span>
                        <span className="font-medium">{Number(c.cpuPercent ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Memory</span>
                        <span className="font-medium">
                          {formatBytes(c.memoryUsageBytes)} / {formatBytes(c.memoryLimitBytes)}
                          {memPct != null && Number.isFinite(memPct) ? ` (${memPct.toFixed(1)}%)` : ""}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

