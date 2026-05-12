import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Upload, X, Tag } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { ProductAvatar } from "@/components/ProductAvatar";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  tax_rate: number;
  is_available: boolean;
  category_id: string | null;
  image_url: string | null;
  sku: string | null;
}

interface Category {
  id: string;
  name: string;
}

const ALL = "__all__";
const NONE = "__none__";

function ProductsPage() {
  const { business, role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const canEdit = role === "owner" || role === "manager";

  const load = async () => {
    if (!business) return;
    const [{ data: ps }, { data: cs }] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,description,price,tax_rate,is_available,category_id,image_url,sku")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name").eq("business_id", business.id).order("name"),
    ]);
    setProducts((ps ?? []) as Product[]);
    setCategories((cs ?? []) as Category[]);
  };
  useEffect(() => {
    void load();
  }, [business?.id]);

  const remove = async (p: Product) => {
    if (!confirm("Delete this product?")) return;
    if (p.image_url) await deleteImageByUrl(p.image_url);
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  const toggle = async (p: Product) => {
    const { error } = await supabase
      .from("products")
      .update({ is_available: !p.is_available })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const visible = products.filter((p) => {
    if (filter !== ALL && p.category_id !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Products & services</h1>
          <p className="text-sm text-muted-foreground">
            {visible.length} of {products.length} item{products.length === 1 ? "" : "s"}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatOpen(true)}>
              <Tag className="mr-2 h-4 w-4" /> Categories
            </Button>
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) setEditing(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New product
                </Button>
              </DialogTrigger>
              <ProductDialog
                key={editing?.id ?? "new"}
                product={editing}
                categories={categories}
                businessId={business!.id}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  void load();
                }}
              />
            </Dialog>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name, SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 max-w-xs"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-10 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          {products.length === 0
            ? canEdit
              ? "No products yet. Add your first product to start selling."
              : "No products yet."
            : "No matches for current filter."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => {
            const cat = categories.find((c) => c.id === p.category_id);
            return (
              <div key={p.id} className="flex gap-3 rounded-xl border bg-card p-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                  <ProductAvatar name={p.name} imageUrl={p.image_url} />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(Number(p.price))} · GST {Number(p.tax_rate)}%
                      </div>
                      {(cat || p.sku) && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {cat?.name}
                          {cat && p.sku ? " · " : ""}
                          {p.sku ? `SKU ${p.sku}` : ""}
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <Switch
                        checked={p.is_available}
                        onCheckedChange={() => toggle(p)}
                        aria-label="Available"
                      />
                    )}
                  </div>
                  {canEdit && (
                    <div className="mt-auto flex justify-end gap-1 pt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CategoriesDialog
        open={catOpen}
        onOpenChange={setCatOpen}
        businessId={business?.id ?? ""}
        categories={categories}
        onChanged={load}
      />
    </div>
  );
}

async function deleteImageByUrl(url: string) {
  // url shape: .../storage/v1/object/public/product-images/<businessId>/<file>
  const marker = "/product-images/";
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = url.slice(i + marker.length);
  await supabase.storage.from("product-images").remove([path]);
}

function ProductDialog({
  product,
  categories,
  businessId,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  businessId: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [desc, setDesc] = useState(product?.description ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [tax, setTax] = useState(String(product?.tax_rate ?? "0"));
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? NONE);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setPendingFile(f);
  };

  const removeImage = async () => {
    setPendingFile(null);
    if (imageUrl) {
      await deleteImageByUrl(imageUrl);
      setImageUrl(null);
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      let finalImageUrl = imageUrl;
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, pendingFile, { upsert: false, contentType: pendingFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
        // remove the previously stored image (replaced)
        if (imageUrl) await deleteImageByUrl(imageUrl);
        finalImageUrl = pub.publicUrl;
      }

      const payload = {
  business_id: businessId,
  name: name.trim(),
  price: Number(price) || 0,
};

const { error } = product
  ? await supabase.from("products").update(payload).eq("id", product.id)
  : await supabase.from("products").insert(payload);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const displayImage = previewUrl ?? imageUrl;

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border">
            <ProductAvatar name={name || "?"} imageUrl={displayImage} />
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickFile}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {displayImage ? "Replace image" : "Upload image"}
            </Button>
            {displayImage && (
              <Button type="button" variant="ghost" size="sm" onClick={removeImage}>
                <X className="mr-2 h-4 w-4" /> Remove
              </Button>
            )}
            <p className="text-xs text-muted-foreground">PNG/JPG, up to 5 MB</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Optional description shown on customer menu"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Price</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>GST %</Label>
            <Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Uncategorized</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>SKU (optional)</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CategoriesDialog({
  open,
  onOpenChange,
  businessId,
  categories,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businessId: string;
  categories: Category[];
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("categories")
      .insert({ business_id: businessId, name: newName.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setNewName("");
    onChanged();
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    const { error } = await supabase
      .from("categories")
      .update({ name: editingName.trim() })
      .eq("id", editingId);
    if (error) return toast.error(error.message);
    setEditingId(null);
    setEditingName("");
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category? Products will become uncategorized.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} disabled={busy || !newName.trim()}>
              Add
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No categories yet</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-2">
                  {editingId === c.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        autoFocus
                      />
                      <Button size="sm" onClick={saveEdit}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 px-2 text-sm">{c.name}</div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
