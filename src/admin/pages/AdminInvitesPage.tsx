import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type EventInviteAdminDto } from "@/services/api/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function isCampaign(eventId: string) {
  return eventId.startsWith("-") && /^-[0-9]+$/.test(eventId);
}

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<EventInviteAdminDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [campaignId, setCampaignId] = useState("-1");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [campaignExpiryLocal, setCampaignExpiryLocal] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [campaignPlainOverride, setCampaignPlainOverride] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listInvites();
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Failed to load invites");
        return;
      }
      setInvites(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreateCampaign() {
    const id = campaignId.trim();
    if (!/^-[0-9]+$/.test(id)) {
      toast.error("Campaign id must be a negative integer string (e.g. -1, -2)");
      return;
    }
    const n = parseInt(id, 10);
    if (n >= 0) {
      toast.error("Campaign id must be negative (e.g. -1)");
      return;
    }
    const exp = new Date(campaignExpiryLocal);
    if (Number.isNaN(exp.getTime())) {
      toast.error("Invalid expiry");
      return;
    }
    const res = await adminApi.createCampaignInvite({
      campaignId: id,
      campaignLabel: campaignLabel.trim() || null,
      expiresAtUtc: exp.toISOString(),
      plainCode: campaignPlainOverride.trim() || null,
    });
    if (res.success && res.data) {
      await navigator.clipboard.writeText(res.data.plainCode);
      toast.success(`Campaign invite created: ${res.data.plainCode} (copied)`);
      setCampaignPlainOverride("");
      void load();
    } else {
      toast.error(res.error?.message ?? "Failed to create campaign invite");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invite codes</h1>
        <p className="text-sm text-muted-foreground">
          All event and campaign invites. Plaintext codes are stored in Azure Table. Counters: registrations at
          signup; attendance when an existing member joins an event and passes the matching code.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Non-event (campaign) invite</CardTitle>
          <CardDescription>
            Uses a negative <code className="text-xs">campaignId</code> (e.g. <code className="text-xs">-1</code>
            ). Valid for registration only — does not add the user to any event. You can create multiple codes
            per campaign.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="cid">Campaign id</Label>
            <Input id="cid" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="-1" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="clab">Label (optional)</Label>
            <Input
              id="clab"
              value={campaignLabel}
              onChange={(e) => setCampaignLabel(e.target.value)}
              placeholder="Summer 2026 ads"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cexp">Expires (local)</Label>
            <Input
              id="cexp"
              type="datetime-local"
              value={campaignExpiryLocal}
              onChange={(e) => setCampaignExpiryLocal(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cplain">Plain code (optional)</Label>
            <Input
              id="cplain"
              value={campaignPlainOverride}
              onChange={(e) => setCampaignPlainOverride(e.target.value)}
              placeholder="Auto-generate if empty"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void onCreateCampaign()}>
              Create campaign invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All invites</CardTitle>
          <CardDescription>
            Event rows link to the event editor. Campaign rows show negative ids and optional labels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Reg.</TableHead>
                  <TableHead>Attend.</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.plainCode}>
                    <TableCell>
                      <code className="text-xs">{inv.plainCode}</code>
                    </TableCell>
                    <TableCell>
                      {isCampaign(inv.eventId) ? (
                        <span className="space-x-2">
                          <Badge variant="outline">Campaign {inv.eventId}</Badge>
                          {inv.campaignLabel ? (
                            <span className="text-muted-foreground text-sm">{inv.campaignLabel}</span>
                          ) : null}
                        </span>
                      ) : (
                        <Link className="text-primary text-sm hover:underline" to={`/events/${inv.eventId}`}>
                          Event {inv.eventId}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.expiresAtUtc).toLocaleString()}
                    </TableCell>
                    <TableCell>{inv.registrationCount}</TableCell>
                    <TableCell>{inv.eventAttendanceClaimCount}</TableCell>
                    <TableCell>
                      {inv.revoked ? <Badge variant="secondary">Revoked</Badge> : <Badge>Active</Badge>}
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
