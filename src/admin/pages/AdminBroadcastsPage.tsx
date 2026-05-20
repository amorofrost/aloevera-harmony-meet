import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  type BroadcastAudienceType,
  type BroadcastDto,
} from "@/services/api/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { showApiError } from "@/lib/apiError";

const AUDIENCE_OPTIONS: { value: BroadcastAudienceType; label: string; valuePlaceholder?: string }[] = [
  { value: "all", label: "All users" },
  { value: "attendingEvent", label: "Attending event", valuePlaceholder: "event id" },
  { value: "minRank", label: "Minimum rank", valuePlaceholder: "novice / regular / dedicated / loyal / inner_circle" },
  { value: "staffRole", label: "Staff role", valuePlaceholder: "moderator / admin" },
];

function audienceLabel(a: BroadcastDto["audience"]): string {
  switch (a.type) {
    case "all":
      return "All users";
    case "attendingEvent":
      return `Attending event ${a.value ?? ""}`.trim();
    case "minRank":
      return `Rank ≥ ${a.value ?? "?"}`;
    case "staffRole":
      return `Staff: ${a.value ?? "?"}`;
    default:
      return a.type;
  }
}

function formatIso(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminBroadcastsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audienceType, setAudienceType] = useState<BroadcastAudienceType>("all");
  const [audienceValue, setAudienceValue] = useState("");
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState<BroadcastDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.broadcasts.list(50);
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Failed to load broadcasts");
        return;
      }
      setHistory(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const audienceNeedsValue = audienceType !== "all";
  const audienceValueValid = !audienceNeedsValue || audienceValue.trim().length > 0;
  const canSend = trimmedTitle.length > 0 && trimmedBody.length > 0 && audienceValueValid && !sending;

  async function submit() {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await adminApi.broadcasts.create({
        title: trimmedTitle,
        body: trimmedBody,
        link: link.trim() ? link.trim() : undefined,
        audience: {
          type: audienceType,
          value: audienceNeedsValue ? audienceValue.trim() : null,
        },
      });
      if (!res.success) throw res;
      toast.success("Broadcast queued");
      setTitle("");
      setBody("");
      setLink("");
      setAudienceType("all");
      setAudienceValue("");
      void load();
    } catch (err) {
      showApiError(err, "Could not send broadcast");
    } finally {
      setSending(false);
    }
  }

  const selectedAudience = AUDIENCE_OPTIONS.find((o) => o.value === audienceType);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community broadcasts</h1>
        <p className="text-sm text-muted-foreground">
          Send a one-off notification to a slice of the community. Recipients are computed when you
          click <em>Send</em>, then dispatched asynchronously via the notification pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>
            Title up to 100 chars, body up to 1000 chars. Link is optional and shown alongside the
            message in supported channels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bc-title">Title</Label>
              <Input
                id="bc-title"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Show this Saturday — new venue"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bc-body">Body</Label>
              <Textarea
                id="bc-body"
                maxLength={1000}
                className="min-h-[120px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="The full message text…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bc-link">Link (optional)</Label>
              <Input
                id="bc-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bc-aud-type">Audience</Label>
                <Select
                  value={audienceType}
                  onValueChange={(v) => {
                    setAudienceType(v as BroadcastAudienceType);
                    setAudienceValue("");
                  }}
                >
                  <SelectTrigger id="bc-aud-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {audienceNeedsValue && (
                <div className="grid gap-2">
                  <Label htmlFor="bc-aud-value">Audience value</Label>
                  <Input
                    id="bc-aud-value"
                    value={audienceValue}
                    onChange={(e) => setAudienceValue(e.target.value)}
                    placeholder={selectedAudience?.valuePlaceholder ?? ""}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!canSend}
                onClick={() => void submit()}
              >
                {sending ? "Sending…" : "Send broadcast"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Most recent first. Status flips to <em>completed</em> once the background fan-out
            finishes; dispatched count reflects successful producer calls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium max-w-[260px]">
                      <div className="line-clamp-2">{b.title}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                      <div className="line-clamp-2">{audienceLabel(b.audience)}</div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatIso(b.issuedAtUtc)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === "completed" ? "default" : "secondary"}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {b.dispatchedCount} / {b.estimatedRecipients}
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
