import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { adminApi, type AdminBlogPostDto } from "@/services/api/adminApi";
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
import { toast } from "sonner";
import { showApiError } from "@/lib/apiError";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Value for `<input type="datetime-local" />` in local time. */
function toDatetimeLocalValue(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseTagsField(s: string): string[] {
  return s
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

type BlogForm = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  author: string;
  tagsField: string;
  dateLocal: string;
};

function emptyForm(): BlogForm {
  return {
    id: "",
    title: "",
    excerpt: "",
    content: "",
    imageUrl: "",
    author: "AloeVera Team",
    tagsField: "",
    dateLocal: toDatetimeLocalValue(new Date()),
  };
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<AdminBlogPostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPost, setEditPost] = useState<AdminBlogPostDto | null>(null);
  const [form, setForm] = useState<BlogForm>(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listBlogPosts();
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Failed to load blog posts");
        return;
      }
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setPosts(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm());
    setCreateOpen(true);
  }

  function openEdit(p: AdminBlogPostDto) {
    setForm({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      imageUrl: p.imageUrl,
      author: p.author,
      tagsField: p.tags.join(", "),
      dateLocal: toDatetimeLocalValue(p.date),
    });
    setEditPost(p);
  }

  async function submitCreate() {
    const id = form.id.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(id)) {
      toast.error("Id must be a lowercase slug (a–z, digits, hyphen, underscore).");
      return;
    }
    if (!form.title.trim() || !form.imageUrl.trim() || !form.author.trim()) {
      toast.error("Title, image URL, and author are required.");
      return;
    }
    if (!form.dateLocal) {
      toast.error("Please set a publication date.");
      return;
    }
    const dateIso = new Date(form.dateLocal).toISOString();
    try {
      const res = await adminApi.createBlogPost({
        id,
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        imageUrl: form.imageUrl.trim(),
        author: form.author.trim(),
        tags: parseTagsField(form.tagsField),
        date: dateIso,
      });
      if (!res.success) throw res;
      toast.success("Post created");
      setCreateOpen(false);
      void load();
    } catch (err) {
      showApiError(err, "Could not create post");
    }
  }

  async function submitEdit() {
    if (!editPost) return;
    if (!form.title.trim() || !form.imageUrl.trim() || !form.author.trim()) {
      toast.error("Title, image URL, and author are required.");
      return;
    }
    if (!form.dateLocal) {
      toast.error("Please set a publication date.");
      return;
    }
    const dateIso = new Date(form.dateLocal).toISOString();
    try {
      const res = await adminApi.updateBlogPost(editPost.id, {
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        imageUrl: form.imageUrl.trim(),
        author: form.author.trim(),
        tags: parseTagsField(form.tagsField),
        date: dateIso,
      });
      if (!res.success) throw res;
      toast.success("Post updated");
      setEditPost(null);
      void load();
    } catch (err) {
      showApiError(err, "Could not update post");
    }
  }

  async function remove(p: AdminBlogPostDto) {
    if (!window.confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    try {
      const res = await adminApi.deleteBlogPost(p.id);
      if (!res.success) throw res;
      toast.success("Post deleted");
      void load();
    } catch (err) {
      showApiError(err, "Could not delete post");
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="text-sm text-muted-foreground">
            News and articles shown in the fan app. Use a stable URL slug as the post id.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Add post
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>
            Full article body supports long text. Cover image must be a reachable HTTPS URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Id</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[220px]">
                      <div className="line-clamp-2">{p.title}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.id}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(p.date)}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{p.author}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void remove(p)}>
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
            <DialogTitle>New blog post</DialogTitle>
          </DialogHeader>
          <BlogPostFormFields form={form} setForm={setForm} showId />
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

      <Dialog open={!!editPost} onOpenChange={(o) => !o && setEditPost(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit blog post</DialogTitle>
          </DialogHeader>
          {editPost && (
            <>
              <p className="text-sm text-muted-foreground">Id: {editPost.id}</p>
              <BlogPostFormFields form={form} setForm={setForm} showId={false} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditPost(null)}>
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

function BlogPostFormFields({
  form,
  setForm,
  showId,
}: {
  form: BlogForm;
  setForm: Dispatch<SetStateAction<BlogForm>>;
  showId: boolean;
}) {
  return (
    <div className="grid gap-3 py-2">
      {showId && (
        <div className="grid gap-2">
          <Label htmlFor="bp-id">Post id (slug)</Label>
          <Input
            id="bp-id"
            placeholder="e.g. studio-diary-2026"
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            autoComplete="off"
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="bp-title">Title</Label>
        <Input
          id="bp-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bp-excerpt">Excerpt</Label>
        <Textarea
          id="bp-excerpt"
          className="min-h-[72px]"
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bp-content">Content</Label>
        <Textarea
          id="bp-content"
          className="min-h-[160px]"
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="bp-author">Author</Label>
          <Input
            id="bp-author"
            value={form.author}
            onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bp-date">Publication date</Label>
          <Input
            id="bp-date"
            type="datetime-local"
            value={form.dateLocal}
            onChange={(e) => setForm((f) => ({ ...f, dateLocal: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bp-img">Cover image URL</Label>
        <Input
          id="bp-img"
          placeholder="https://…"
          value={form.imageUrl}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bp-tags">Tags</Label>
        <Input
          id="bp-tags"
          placeholder="Studio, Tour, Interview"
          value={form.tagsField}
          onChange={(e) => setForm((f) => ({ ...f, tagsField: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">Comma- or semicolon-separated.</p>
      </div>
    </div>
  );
}
