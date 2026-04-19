import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminApi,
  type AdminForumSectionDto,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { showApiError } from "@/lib/apiError";
import { ChevronDown, ChevronUp } from "lucide-react";

const RANKS = ["novice", "activeMember", "friendOfAloe", "aloeCrew"] as const;

export default function AdminForumPage() {
  const [sections, setSections] = useState<AdminForumSectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSection, setEditSection] = useState<AdminForumSectionDto | null>(null);

  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMinRank, setFormMinRank] = useState<string>("novice");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listForumSections();
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Failed to load forum sections");
        return;
      }
      setSections(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormId("");
    setFormName("");
    setFormDescription("");
    setFormMinRank("novice");
    setCreateOpen(true);
  }

  function openEdit(s: AdminForumSectionDto) {
    setFormName(s.name);
    setFormDescription(s.description);
    setFormMinRank(s.minRank || "novice");
    setEditSection(s);
  }

  async function submitCreate() {
    const id = formId.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,62}$/.test(id)) {
      toast.error("Id must be a lowercase slug (a–z, digits, hyphen).");
      return;
    }
    try {
      const res = await adminApi.createForumSection({
        id,
        name: formName.trim(),
        description: formDescription.trim(),
        minRank: formMinRank,
      });
      if (!res.success) throw res;
      toast.success("Section created");
      setCreateOpen(false);
      void load();
    } catch (err) {
      showApiError(err, "Could not create section");
    }
  }

  async function submitEdit() {
    if (!editSection) return;
    try {
      const res = await adminApi.updateForumSection(editSection.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        minRank: formMinRank,
      });
      if (!res.success) throw res;
      toast.success("Section updated");
      setEditSection(null);
      void load();
    } catch (err) {
      showApiError(err, "Could not update section");
    }
  }

  async function remove(s: AdminForumSectionDto) {
    if (
      !window.confirm(
        `Delete section “${s.name}” and all its topics? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await adminApi.deleteForumSection(s.id);
      if (!res.success) throw res;
      toast.success("Section deleted");
      void load();
    } catch (err) {
      showApiError(err, "Could not delete section");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    const ids = next.map((s) => s.id);
    try {
      const res = await adminApi.reorderForumSections(ids);
      if (!res.success) throw res;
      setSections(next);
      toast.success("Order saved");
    } catch (err) {
      showApiError(err, "Could not reorder sections");
      void load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forum</h1>
          <p className="text-sm text-muted-foreground">
            Manage non-event forum sections (order, access rank), then open a section to edit
            threads. Event-linked threads stay under Events.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Add section
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>
            Use arrows to reorder. Members need at least the section min rank to see the section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Id</TableHead>
                  <TableHead>Min rank</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === 0}
                          onClick={() => void move(i, -1)}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === sections.length - 1}
                          onClick={() => void move(i, 1)}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        className="text-primary hover:underline"
                        to={`/forum/${encodeURIComponent(s.id)}`}
                      >
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.id}</TableCell>
                    <TableCell>
                      <span className="text-xs uppercase">{s.minRank}</span>
                    </TableCell>
                    <TableCell>{s.topicCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        asChild
                      >
                        <Link to={`/forum/${encodeURIComponent(s.id)}`}>Topics</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => openEdit(s)}
                      >
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void remove(s)}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New forum section</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-id">Section id (slug)</Label>
              <Input
                id="new-id"
                placeholder="e.g. gear"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-desc">Description</Label>
              <Textarea
                id="new-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Minimum rank</Label>
              <Select value={formMinRank} onValueChange={setFormMinRank}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANKS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <Dialog open={!!editSection} onOpenChange={(o) => !o && setEditSection(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit section</DialogTitle>
          </DialogHeader>
          {editSection && (
            <>
              <p className="text-sm text-muted-foreground">Id: {editSection.id}</p>
              <div className="grid gap-3 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea
                    id="edit-desc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Minimum rank</Label>
                  <Select value={formMinRank} onValueChange={setFormMinRank}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RANKS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditSection(null)}>
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
