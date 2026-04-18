import { useEffect, useState } from "react";
import { adminApi, type AppConfigDto } from "@/services/api/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminConfigPage() {
  const [data, setData] = useState<AppConfigDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await adminApi.getConfig();
      if (cancelled) return;
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setData(null);
        setError(res.error?.message ?? "Failed to load config");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading configuration…</p>;
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error ?? "No data"}
      </p>
    );
  }

  const rankEntries = Object.entries(data.rankThresholds).sort(([a], [b]) => a.localeCompare(b));
  const permEntries = Object.entries(data.permissions).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">App configuration</h1>
        <p className="text-sm text-muted-foreground">
          Read-only view of rank thresholds and permission gates from Azure Table Storage (
          <code className="text-xs">appconfig</code>). Values refresh on the server cache (up to 1 hour).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rank thresholds</CardTitle>
          <CardDescription>Activity counters used by RankCalculator (OR logic per tier).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">Key</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankEntries.map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="font-mono text-xs">{k}</TableCell>
                  <TableCell>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>Minimum rank / role name required for each action (EffectiveLevel).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">Key</TableHead>
                <TableHead>Required level (string)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permEntries.map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="font-mono text-xs">{k}</TableCell>
                  <TableCell>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
