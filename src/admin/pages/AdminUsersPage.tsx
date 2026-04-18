import { useCallback, useEffect, useState } from "react";
import { usersApi } from "@/services/api/usersApi";
import type { User, UserRank, StaffRole } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PAGE = 25;

const STAFF_OPTIONS: StaffRole[] = ["none", "moderator", "admin"];
const RANK_OVERRIDE_OPTIONS: { value: string; label: string }[] = [
  { value: "__computed", label: "Computed (no override)" },
  { value: "novice", label: "novice" },
  { value: "activeMember", label: "activeMember" },
  { value: "friendOfAloe", label: "friendOfAloe" },
  { value: "aloeCrew", label: "aloeCrew" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (from: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await usersApi.getUsers(from, PAGE);
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Failed to load users");
        return;
      }
      const batch = res.data;
      setHasMore(batch.length === PAGE);
      setSkip(from + batch.length);
      setUsers((prev) => (append ? [...prev, ...batch] : batch));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(0, false);
  }, [load]);

  async function onStaffChange(user: User, role: StaffRole) {
    const res = await usersApi.setStaffRole(user.id, role);
    if (res.success) {
      toast.success(`Staff role updated for ${user.name}`);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, staffRole: role } : u)));
    } else {
      toast.error(res.error?.message ?? "Update failed");
    }
  }

  async function onRankOverrideChange(user: User, value: string) {
    const rank: UserRank | null = value === "__computed" ? null : (value as UserRank);
    const res = await usersApi.setRankOverride(user.id, rank);
    if (res.success) {
      toast.success(rank ? `Rank override set for ${user.name}` : `Rank override cleared for ${user.name}`);
      load(0, false);
    } else {
      toast.error(res.error?.message ?? "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Paginated list from <code className="text-xs">GET /api/v1/users</code>. Staff role and rank override
          require admin; changes apply on next profile fetch.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? "s" : ""} loaded
            {hasMore ? " (more available)" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="font-mono text-xs">ID</TableHead>
                    <TableHead>Rank (computed)</TableHead>
                    <TableHead className="min-w-[180px]">Staff role</TableHead>
                    <TableHead className="min-w-[220px]">Rank override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
                      <TableCell className="text-sm">{u.rank}</TableCell>
                      <TableCell>
                        <Select
                          value={u.staffRole}
                          onValueChange={(v) => onStaffChange(u, v as StaffRole)}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAFF_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select onValueChange={(v) => onRankOverrideChange(u, v)}>
                          <SelectTrigger className="h-8 w-[220px]">
                            <SelectValue placeholder="Set rank override…" />
                          </SelectTrigger>
                          <SelectContent>
                            {RANK_OVERRIDE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasMore && (
            <Button
              type="button"
              variant="secondary"
              disabled={loadingMore}
              onClick={() => load(skip, true)}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
