import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adminApi,
  type AdminEventWritePayload,
  type EventAttendeeAdminDto,
  type EventInviteAdminDto,
  type ForumTopicAdminDto,
} from "@/services/api/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { uploadImage } from "@/services/api/imagesApi";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(19, 0, 0, 0);
  return d.toISOString();
}

export default function AdminEventEditorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const isNew = eventId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<{ id: string; forumTopicId?: string | null } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [badgeImageUrl, setBadgeImageUrl] = useState("");
  const [uploadingBadgeImage, setUploadingBadgeImage] = useState(false);
  const badgeFileInputRef = useRef<HTMLInputElement>(null);
  const [dateLocal, setDateLocal] = useState(toLocalInput(defaultStart()));
  const [endLocal, setEndLocal] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [category, setCategory] = useState<AdminEventWritePayload["category"]>("concert");
  const [price, setPrice] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [visibility, setVisibility] = useState<AdminEventWritePayload["visibility"]>("public");
  const [archived, setArchived] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const [attendees, setAttendees] = useState<EventAttendeeAdminDto[]>([]);
  const [topics, setTopics] = useState<ForumTopicAdminDto[]>([]);
  const [eventInvites, setEventInvites] = useState<EventInviteAdminDto[]>([]);
  const [inviteExpiryLocal, setInviteExpiryLocal] = useState(() =>
    toLocalInput(new Date(Date.now() + 7 * 86400000).toISOString()),
  );
  const [invitePlainOverride, setInvitePlainOverride] = useState("");

  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicContent, setNewTopicContent] = useState("");
  const [editTopic, setEditTopic] = useState<ForumTopicAdminDto | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editTopicContent, setEditTopicContent] = useState("");

  const payload = useMemo((): AdminEventWritePayload => {
    const cap = capacity.trim() === "" ? null : parseInt(capacity, 10);
    const pr = price.trim() === "" ? null : parseFloat(price);
    return {
      title: title.trim(),
      description,
      imageUrl,
      badgeImageUrl,
      date: fromLocalInput(dateLocal),
      endDate: endLocal.trim() === "" ? null : fromLocalInput(endLocal),
      location,
      capacity: cap != null && !Number.isNaN(cap) ? cap : null,
      category,
      price: pr != null && !Number.isNaN(pr) ? pr : null,
      organizer,
      visibility,
      archived,
    };
  }, [
    title,
    description,
    imageUrl,
    badgeImageUrl,
    dateLocal,
    endLocal,
    location,
    capacity,
    category,
    price,
    organizer,
    visibility,
    archived,
  ]);

  const loadExtras = useCallback(async (id: string) => {
    const [a, t, inv] = await Promise.all([
      adminApi.getAttendees(id),
      adminApi.getForumTopics(id),
      adminApi.listInvitesForEvent(id),
    ]);
    if (a.success && a.data) setAttendees(a.data);
    if (t.success && t.data) setTopics(t.data);
    if (inv.success && inv.data) setEventInvites(inv.data);
  }, []);

  useEffect(() => {
    if (isNew || !eventId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await adminApi.getEvent(eventId);
      if (cancelled) return;
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Event not found");
        navigate("/events", { replace: true });
        return;
      }
      const e = res.data;
      setEvent({ id: e.id, forumTopicId: e.forumTopicId });
      setTitle(e.title);
      setDescription(e.description);
      setImageUrl(e.imageUrl);
      setBadgeImageUrl(e.badgeImageUrl ?? "");
      setDateLocal(toLocalInput(e.date));
      setEndLocal(e.endDate ? toLocalInput(e.endDate) : "");
      setLocation(e.location);
      setCapacity(e.capacity != null ? String(e.capacity) : "");
      setCategory(e.category);
      setPrice(e.price != null ? String(e.price) : "");
      setOrganizer(e.organizer);
      setVisibility(e.visibility);
      setArchived(e.archived);
      await loadExtras(e.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, isNew, navigate, loadExtras]);

  async function onSave() {
    if (!payload.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await adminApi.createEvent(payload);
        if (!res.success || !res.data) {
          toast.error(res.error?.message ?? "Create failed");
          return;
        }
        toast.success("Event created");
        navigate(`/events/${res.data.id}`, { replace: true });
        return;
      }
      if (!eventId) {
        toast.error("Missing event id — check the URL.");
        return;
      }
      const res = await adminApi.updateEvent(eventId, payload);
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Save failed");
        return;
      }
      setEvent({ id: res.data.id, forumTopicId: res.data.forumTopicId });
      toast.success("Saved");
      await loadExtras(eventId);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!eventId || isNew) return;
    const res = await adminApi.deleteEvent(eventId);
    if (res.success) {
      toast.success("Event deleted");
      navigate("/events", { replace: true });
    } else {
      toast.error(res.error?.message ?? "Delete failed");
    }
  }

  async function onBadgeImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingBadgeImage(true);
    try {
      const { url } = await uploadImage(file);
      setBadgeImageUrl(url);
      toast.success("Badge image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingBadgeImage(false);
    }
  }

  async function onEventImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    try {
      const { url } = await uploadImage(file);
      setImageUrl(url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function onCreateInvite() {
    if (!eventId || isNew) {
      toast.error("Save the event first");
      return;
    }
    const exp = fromLocalInput(inviteExpiryLocal);
    const res = await adminApi.createInvite(
      eventId,
      new Date(exp),
      invitePlainOverride.trim() || undefined,
    );
    if (res.success && res.data) {
      await navigator.clipboard.writeText(res.data.plainCode);
      toast.success(`Invite code copied: ${res.data.plainCode}`);
      setInvitePlainOverride("");
      if (eventId) await loadExtras(eventId);
    } else {
      toast.error(res.error?.message ?? "Invite failed");
    }
  }

  async function onRemoveAttendee(userId: string) {
    if (!eventId || isNew) return;
    const res = await adminApi.removeAttendee(eventId, userId);
    if (res.success) {
      toast.success("Attendee removed");
      await loadExtras(eventId);
    } else {
      toast.error(res.error?.message ?? "Remove failed");
    }
  }

  async function onAddTopic() {
    if (!eventId || isNew) {
      toast.error("Save the event first");
      return;
    }
    if (newTopicTitle.trim().length < 5 || newTopicContent.trim().length < 10) {
      toast.error("Topic title (≥5) and body (≥10) are required");
      return;
    }
    const res = await adminApi.createForumTopic(eventId, {
      title: newTopicTitle.trim(),
      content: newTopicContent.trim(),
    });
    if (res.success) {
      toast.success("Topic created");
      setNewTopicTitle("");
      setNewTopicContent("");
      await loadExtras(eventId);
    } else {
      toast.error(res.error?.message ?? "Failed to create topic");
    }
  }

  async function onDeleteTopic(topicId: string) {
    const res = await adminApi.deleteForumTopic(topicId);
    if (res.success && eventId) {
      toast.success("Topic deleted");
      await loadExtras(eventId);
    } else {
      toast.error(res.error?.message ?? "Delete failed");
    }
  }

  function openEditTopic(t: ForumTopicAdminDto) {
    setEditTopic(t);
    setEditTopicTitle(t.title);
    setEditTopicContent(t.content);
  }

  async function onSaveEditTopic() {
    if (!editTopic || !eventId) return;
    if (editTopicTitle.trim().length < 5 || editTopicContent.trim().length < 10) {
      toast.error("Title (≥5) and body (≥10) are required");
      return;
    }
    const res = await adminApi.updateForumTopic(editTopic.id, {
      title: editTopicTitle.trim(),
      content: editTopicContent.trim(),
    });
    if (res.success) {
      toast.success("Topic updated");
      setEditTopic(null);
      await loadExtras(eventId);
    } else {
      toast.error(res.error?.message ?? "Update failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading event…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isNew ? "New event" : "Edit event"}</h1>
          {!isNew && event && (
            <p className="text-sm text-muted-foreground">
              ID <code className="text-xs">{event.id}</code>
              {event.forumTopicId ? (
                <>
                  {" "}
                  · forum topic <code className="text-xs">{event.forumTopicId}</code>
                </>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/events">Back to list</Link>
          </Button>
          {!isNew && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button">
                  Delete event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the event, its attendee rows, invite codes, and all forum topics tied to
                    it. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void onDelete()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Name, schedule, location, and visibility.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Event image</Label>
            <p className="text-sm text-muted-foreground">
              Paste an external image URL, or upload a file (JPEG, PNG, GIF, or WebP; max 10 MB).
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="img" className="text-xs font-normal text-muted-foreground">
                  Image URL
                </Label>
                <Input
                  id="img"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  onChange={onEventImageFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingImage}
                  onClick={() => imageFileInputRef.current?.click()}
                >
                  {uploadingImage ? "Uploading…" : "Upload image"}
                </Button>
              </div>
            </div>
            {imageUrl.trim() ? (
              <div className="pt-1">
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-40 max-w-full rounded-md border object-contain"
                  onError={(ev) => {
                    ev.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Badge image</Label>
            <p className="text-sm text-muted-foreground">
              Small image for profiles and forum (e.g. stamp). Paste a URL or upload (same rules as main image).
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="badge-img" className="text-xs font-normal text-muted-foreground">
                  Badge image URL
                </Label>
                <Input
                  id="badge-img"
                  value={badgeImageUrl}
                  onChange={(e) => setBadgeImageUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  ref={badgeFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  onChange={onBadgeImageFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingBadgeImage}
                  onClick={() => badgeFileInputRef.current?.click()}
                >
                  {uploadingBadgeImage ? "Uploading…" : "Upload badge"}
                </Button>
              </div>
            </div>
            {badgeImageUrl.trim() ? (
              <div className="pt-1">
                <img
                  src={badgeImageUrl}
                  alt=""
                  className="h-16 w-16 rounded-md border object-cover"
                  onError={(ev) => {
                    ev.currentTarget.style.display = "none";
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="start">Start (local)</Label>
            <Input
              id="start"
              type="datetime-local"
              value={dateLocal}
              onChange={(e) => setDateLocal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End (local, optional)</Label>
            <Input
              id="end"
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc">Location</Label>
            <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cap">Capacity</Label>
            <Input
              id="cap"
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as AdminEventWritePayload["category"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concert">concert</SelectItem>
                <SelectItem value="meetup">meetup</SelectItem>
                <SelectItem value="party">party</SelectItem>
                <SelectItem value="festival">festival</SelectItem>
                <SelectItem value="yachting">yachting</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org">Organizer</Label>
            <Input id="org" value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as AdminEventWritePayload["visibility"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">public</SelectItem>
                <SelectItem value="secretHidden">secretHidden</SelectItem>
                <SelectItem value="secretTeaser">secretTeaser</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Archived</p>
              <p className="text-xs text-muted-foreground">Hidden from public event APIs when enabled.</p>
            </div>
            <Switch checked={archived} onCheckedChange={setArchived} />
          </div>
        </CardContent>
      </Card>

      {!isNew && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Invite codes</CardTitle>
              <CardDescription>
                Codes are stored as readable plaintext in Azure Table. Creating a new code revokes earlier
                codes for this event. New signups increment &quot;Registrations&quot;; existing users who join
                with a code in the app increment &quot;Attendance by code&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invExp">New code expiry (local)</Label>
                  <Input
                    id="invExp"
                    type="datetime-local"
                    value={inviteExpiryLocal}
                    onChange={(e) => setInviteExpiryLocal(e.target.value)}
                  />
                </div>
                <div className="space-y-2 min-w-[200px] flex-1 max-w-md">
                  <Label htmlFor="invPlain">Plain code (optional)</Label>
                  <Input
                    id="invPlain"
                    value={invitePlainOverride}
                    onChange={(e) => setInvitePlainOverride(e.target.value)}
                    placeholder="Auto-generate if empty"
                    autoComplete="off"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => void onCreateInvite()}>
                  Create / rotate invite
                </Button>
              </div>
              {eventInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invite rows for this event yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code (plaintext)</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Registrations</TableHead>
                      <TableHead>Attendance by code</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventInvites.map((inv) => (
                      <TableRow key={inv.plainCode}>
                        <TableCell>
                          <code className="text-sm">{inv.plainCode}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-7"
                            onClick={() => void navigator.clipboard.writeText(inv.plainCode)}
                          >
                            Copy
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
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

          <Card>
            <CardHeader>
              <CardTitle>Attendees</CardTitle>
              <CardDescription>Registered users for this event.</CardDescription>
            </CardHeader>
            <CardContent>
              {attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendees.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Id</TableHead>
                      <TableHead className="text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendees.map((a) => (
                      <TableRow key={a.userId}>
                        <TableCell>{a.displayName}</TableCell>
                        <TableCell>
                          <code className="text-xs">{a.userId}</code>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void onRemoveAttendee(a.userId)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Forum topics</CardTitle>
              <CardDescription>Discussion threads in the events area of Talks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No topics yet.</p>
              ) : (
                <ul className="space-y-3">
                  {topics.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.replyCount} replies · updated {new Date(t.updatedAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-sm line-clamp-2">{t.content}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => openEditTopic(t)}>
                          Edit
                        </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" type="button">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete topic?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Removes this topic and all replies. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void onDeleteTopic(t.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Dialog open={editTopic !== null} onOpenChange={(o) => !o && setEditTopic(null)}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit topic</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="et-title">Title</Label>
                      <Input
                        id="et-title"
                        value={editTopicTitle}
                        onChange={(e) => setEditTopicTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="et-body">Content</Label>
                      <Textarea
                        id="et-body"
                        rows={5}
                        value={editTopicContent}
                        onChange={(e) => setEditTopicContent(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditTopic(null)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={() => void onSaveEditTopic()}>
                      Save topic
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Add topic</p>
                <Input
                  placeholder="Title (min 5 characters)"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Body (min 10 characters)"
                  rows={3}
                  value={newTopicContent}
                  onChange={(e) => setNewTopicContent(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => void onAddTopic()}>
                  Add topic
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
