import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type AdminEventDto } from "@/services/api/adminApi";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEventDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listEvents();
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Failed to load events");
        return;
      }
      setEvents(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleArchive(e: AdminEventDto) {
    const res = await adminApi.setArchived(e.id, !e.archived);
    if (res.success) {
      toast.success(e.archived ? "Event restored" : "Event archived");
      void load();
    } else {
      toast.error(res.error?.message ?? "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage concerts, meetups, and other events. Archived events stay out of public
            listings.
          </p>
        </div>
        <Button asChild>
          <Link to="/events/new">New event</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All events</CardTitle>
          <CardDescription>Including archived; public API hides archived entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" to={`/events/${e.id}`}>
                        {e.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(e.date)}</TableCell>
                    <TableCell>
                      <span className="text-xs uppercase">{e.visibility}</span>
                    </TableCell>
                    <TableCell>
                      {e.archived ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : (
                        <Badge variant="outline">Live</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="mr-2" asChild>
                        <Link to={`/events/${e.id}`}>Edit</Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void toggleArchive(e)}>
                        {e.archived ? "Restore" : "Archive"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
