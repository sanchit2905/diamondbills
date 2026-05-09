import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

interface Product {
  id: string;
  name: string;
  price: number;
  tax_rate: number;
  is_available: boolean;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

function ProductsPage() {
  const { business, role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const canEdit = role === "owner" || role === "manager";

  const load = async () => {
    if (!business) return;
    const [{ data: ps }, { data: cs }] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,price,tax_rate,is_available,category_id")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name").eq("business_id", business.id),
    ]);
    setProducts((ps ?? []) as Product[]);
    setCategories((cs ?? []) as Category[]);
  };
  useEffect(() => { void load(); }, [business?.id]);

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  const toggle = async (p: Product) => {
    const { error } = await supabase.from("products").update({ is_available: !p.is_available }).eq("id", p.id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products & services</h1>
          <p className="text-sm text-muted-foreground">{products.length} item{products.length === 1 ? "" : "s"}</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New product</Button>
            </DialogTrigger>
            <ProductDialog
              key={editing?.id ?? "new"}
              product={editing}
              categories={categories}
              businessId={business!.id}
              onSaved={() => { setOpen(false); setEditing(null); void load(); }}
            />
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        {products.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No products yet. {canEdit && "Add your first product to start selling."}
          </div>
        ) : (
          <div className="divide-y">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatMoney(Number(p.price))} · GST {Number(p.tax_rate)}%
                  </div>
                </div>
                {canEdit && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      Available
                      <Switch checked={p.is_available} onCheckedChange={() => toggle(p)} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [tax, setTax] = useState(String(product?.tax_rate ?? "0"));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    const payload = {
      business_id: businessId,
      name: name.trim(),
      price: Number(price) || 0,
      tax_rate: Number(tax) || 0,
    };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert({ ...payload, is_available: true });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  // categories param reserved for future use; suppress unused warning
  void categories;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
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
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
