import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { adminApi, type AdminStoreItemDto } from "@/services/api/adminApi";
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
import { ExternalLink } from "lucide-react";

function emptyForm(): Omit<AdminStoreItemDto, "id"> & { id: string } {
  return {
    id: "",
    title: "",
    description: "",
    price: 0,
    imageUrl: "",
    category: "",
    externalPurchaseUrl: "",
  };
}

export default function AdminStorePage() {
  const [items, setItems] = useState<AdminStoreItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdminStoreItemDto | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listStoreItems();
      if (!res.success || !res.data) {
        toast.error(res.error?.message ?? "Failed to load store items");
        return;
      }
      setItems(res.data);
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

  function openEdit(item: AdminStoreItemDto) {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      category: item.category,
      externalPurchaseUrl: item.externalPurchaseUrl ?? "",
    });
    setEditItem(item);
  }

  async function submitCreate() {
    const id = form.id.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(id)) {
      toast.error("Id must be a lowercase slug (a–z, digits, hyphen, underscore).");
      return;
    }
    if (!form.title.trim() || !form.imageUrl.trim() || !form.category.trim()) {
      toast.error("Title, image URL, and category are required.");
      return;
    }
    try {
      const res = await adminApi.createStoreItem({
        id,
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        imageUrl: form.imageUrl.trim(),
        category: form.category.trim(),
        externalPurchaseUrl: form.externalPurchaseUrl.trim(),
      });
      if (!res.success) throw res;
      toast.success("Item created");
      setCreateOpen(false);
      void load();
    } catch (err) {
      showApiError(err, "Could not create item");
    }
  }

  async function submitEdit() {
    if (!editItem) return;
    if (!form.title.trim() || !form.imageUrl.trim() || !form.category.trim()) {
      toast.error("Title, image URL, and category are required.");
      return;
    }
    try {
      const res = await adminApi.updateStoreItem(editItem.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        imageUrl: form.imageUrl.trim(),
        category: form.category.trim(),
        externalPurchaseUrl: form.externalPurchaseUrl.trim(),
      });
      if (!res.success) throw res;
      toast.success("Item updated");
      setEditItem(null);
      void load();
    } catch (err) {
      showApiError(err, "Could not update item");
    }
  }

  async function remove(item: AdminStoreItemDto) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try {
      const res = await adminApi.deleteStoreItem(item.id);
      if (!res.success) throw res;
      toast.success("Item deleted");
      void load();
    } catch (err) {
      showApiError(err, "Could not delete item");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Store</h1>
          <p className="text-sm text-muted-foreground">
            Merch catalog shown in the app. Set <strong>Official store URL</strong> to the product page
            on the band&apos;s shop (opens in a new tab for fans).
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Add item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            Price is shown in the app as-is (e.g. rubles). Image must be a reachable HTTPS URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Id</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Official URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="line-clamp-2">{it.title}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{it.id}</TableCell>
                    <TableCell>{it.category}</TableCell>
                    <TableCell>{it.price}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {it.externalPurchaseUrl ? (
                        <a
                          href={it.externalPurchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs inline-flex items-center gap-1 hover:underline break-all"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          Link
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(it)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void remove(it)}>
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
            <DialogTitle>New store item</DialogTitle>
          </DialogHeader>
          <StoreItemFormFields form={form} setForm={setForm} showId />
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

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit store item</DialogTitle>
          </DialogHeader>
          {editItem && (
            <>
              <p className="text-sm text-muted-foreground">Id: {editItem.id}</p>
              <StoreItemFormFields form={form} setForm={setForm} showId={false} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditItem(null)}>
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

function StoreItemFormFields({
  form,
  setForm,
  showId,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: Dispatch<SetStateAction<ReturnType<typeof emptyForm>>>;
  showId: boolean;
}) {
  return (
    <div className="grid gap-3 py-2">
      {showId && (
        <div className="grid gap-2">
          <Label htmlFor="sf-id">Item id (slug)</Label>
          <Input
            id="sf-id"
            placeholder="e.g. vinyl-2026"
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            autoComplete="off"
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="sf-title">Title</Label>
        <Input
          id="sf-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sf-desc">Description</Label>
        <Textarea
          id="sf-desc"
          className="min-h-[100px]"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sf-price">Price (number)</Label>
          <Input
            id="sf-price"
            type="number"
            min={0}
            step="1"
            value={form.price === 0 ? "" : form.price}
            onChange={(e) =>
              setForm((f) => ({ ...f, price: e.target.value === "" ? 0 : Number(e.target.value) }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sf-cat">Category</Label>
          <Input
            id="sf-cat"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sf-img">Image URL</Label>
        <Input
          id="sf-img"
          placeholder="https://…"
          value={form.imageUrl}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sf-ext">Official store product URL</Label>
        <Input
          id="sf-ext"
          placeholder="https://official-shop.example/…"
          value={form.externalPurchaseUrl}
          onChange={(e) => setForm((f) => ({ ...f, externalPurchaseUrl: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Opens in a new tab when fans tap “Buy on official store” in the app. Leave empty to hide
          the button.
        </p>
      </div>
    </div>
  );
}
