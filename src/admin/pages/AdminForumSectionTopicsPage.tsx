import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminApi,
  type AdminForumSectionDto,
  type AdminStandardForumTopicDto,
} from "@/services/api/adminApi";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { showApiError } from "@/lib/apiError";
import { Checkbox } from "@/components/ui/checkbox";

export default function AdminForumSectionTopicsPage() {
  const { sectionId: sectionIdParam } = useParams<{ sectionId: string }>();
  const sectionId = sectionIdParam ? decodeURIComponent(sectionIdParam) : "";

  const [section, setSection] = useState<AdminForumSectionDto | null>(null);
  const [topics, setTopics] = useState<AdminStandardForumTopicDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTopic, setEditTopic] = useState<AdminStandardForumTopicDto | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noviceVisible, setNoviceVisible] = useState(true);
  const [noviceCanReply, setNoviceCanReply] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const secRes = await adminApi.listForumSections();
      if (!secRes.success || !secRes.data) {
        toast.error(secRes.error?.message ?? "Failed to load sections");
        return;
      }
      const s = secRes.data.find((x) => x.id === sectionId) ?? null;
      setSection(s);

      const topRes = await adminApi.listForumSectionTopics(sectionId);
      if (!topRes.success || !topRes.data) {
        toast.error(topRes.error?.message ?? "Failed to load topics");
        return;
      }
      setTopics(topRes.data);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setTitle("");
    setContent("");
    setNoviceVisible(true);
    setNoviceCanReply(true);
    setIsPinned(false);
    setIsLocked(false);
    setCreateOpen(true);
  }

  function openEdit(t: AdminStandardForumTopicDto) {
    setTitle(t.title);
    setContent(t.content);
    setNoviceVisible(t.noviceVisible);
    setNoviceCanReply(t.noviceCanReply);
    setIsPinned(t.isPinned);
    setIsLocked(t.isLocked);
    setEditTopic(t);
  }

  async function submitCreate() {
    if (title.trim().length < 5 || content.trim().length < 10) {
      toast.error("Title (5+) and body (10+) are required.");
      return;
    }
    try {
      const res = await adminApi.createForumSectionTopic(sectionId, {
        title: title.trim(),
        content: content.trim(),
        noviceVisible,
        noviceCanReply,
      });
      if (!res.success) throw res;
      toast.success("Topic created");
      setCreateOpen(false);
      void load();
    } catch (err) {
      showApiError(err, "Could not create topic");
    }
  }

  async function submitEdit() {
    if (!editTopic) return;
    if (title.trim().length < 5 || content.trim().length < 10) {
      toast.error("Title (5+) and body (10+) are required.");
      return;
    }
    try {
      const res = await adminApi.updateForumTopic(editTopic.id, {
        title: title.trim(),
        content: content.trim(),
        noviceVisible,
        noviceCanReply,
        isPinned,
        isLocked,
      });
      if (!res.success) throw res;
      toast.success("Topic saved");
      setEditTopic(null);
      void load();
    } catch (err) {
      showApiError(err, "Could not save topic");
    }
  }

  async function removeTopic(t: AdminStandardForumTopicDto) {
    if (!window.confirm(`Delete topic “${t.title}” and all replies?`)) return;
    try {
      const res = await adminApi.deleteForumTopic(t.id);
      if (!res.success) throw res;
      toast.success("Topic deleted");
      void load();
    } catch (err) {
      showApiError(err, "Could not delete topic");
    }
  }

  async function toggleLock(t: AdminStandardForumTopicDto) {
    try {
      const res = await adminApi.updateForumTopic(t.id, { isLocked: !t.isLocked });
      if (!res.success) throw res;
      toast.success(t.isLocked ? "Topic reopened" : "Topic closed");
      void load();
    } catch (err) {
      showApiError(err, "Could not update topic");
    }
  }

  if (!sectionId) {
    return <p className="text-sm text-muted-foreground">Missing section.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/forum" className="text-primary hover:underline">
              Forum
            </Link>
            <span className="mx-1">/</span>
            <span className="text-foreground">{section?.name ?? sectionId}</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
          <p className="text-sm text-muted-foreground">
            Standard threads only. Event discussions are managed per event.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          New topic
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Threads in this section</CardTitle>
          <CardDescription>
            Close locks replies; pin keeps the thread at the top in the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No topics yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Replies</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium line-clamp-2">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.id}</div>
                    </TableCell>
                    <TableCell>{t.replyCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.isPinned && <Badge variant="secondary">Pinned</Badge>}
                        {t.isLocked && <Badge variant="destructive">Closed</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void toggleLock(t)}>
                        {t.isLocked ? "Reopen" : "Close"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void removeTopic(t)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New topic</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ct-title">Title</Label>
              <Input
                id="ct-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct-body">Body</Label>
              <Textarea
                id="ct-body"
                className="min-h-[160px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ct-nov-vis"
                checked={noviceVisible}
                onCheckedChange={(v) => setNoviceVisible(v === true)}
              />
              <Label htmlFor="ct-nov-vis" className="font-normal">
                Visible to Novice rank
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ct-nov-rep"
                checked={noviceCanReply}
                onCheckedChange={(v) => setNoviceCanReply(v === true)}
              />
              <Label htmlFor="ct-nov-rep" className="font-normal">
                Novices can reply
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCreate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTopic} onOpenChange={(o) => !o && setEditTopic(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit topic</DialogTitle>
          </DialogHeader>
          {editTopic && (
            <>
              <div className="grid gap-3 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="et-title">Title</Label>
                  <Input
                    id="et-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="et-body">Body</Label>
                  <Textarea
                    id="et-body"
                    className="min-h-[160px]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="et-pin"
                    checked={isPinned}
                    onCheckedChange={(v) => setIsPinned(v === true)}
                  />
                  <Label htmlFor="et-pin" className="font-normal">
                    Pinned
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="et-lock"
                    checked={isLocked}
                    onCheckedChange={(v) => setIsLocked(v === true)}
                  />
                  <Label htmlFor="et-lock" className="font-normal">
                    Closed (no new replies)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="et-nov-vis"
                    checked={noviceVisible}
                    onCheckedChange={(v) => setNoviceVisible(v === true)}
                  />
                  <Label htmlFor="et-nov-vis" className="font-normal">
                    Visible to Novice rank
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="et-nov-rep"
                    checked={noviceCanReply}
                    onCheckedChange={(v) => setNoviceCanReply(v === true)}
                  />
                  <Label htmlFor="et-nov-rep" className="font-normal">
                    Novices can reply
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTopic(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void submitEdit()}>
                  Save
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
