import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Minus, Trash2, Banknote, CreditCard, Smartphone } from "lucide-react";
import { formatMoney, generateInvoiceNumber } from "@/lib/format";
import { toast } from "sonner";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pos")({
  component: PosPage,
});

interface Product {
  id: string;
  name: string;
  price: number;
  tax_rate: number;
}
interface CartLine {
  product_id: string;
  name: string;
  price: number;
  tax_rate: number;
  qty: number;
}

type PaymentMethod = "cash" | "card" | "upi";

function PosPage() {
  const { business, currentBranch, profile, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!business) return;
    void (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,price,tax_rate")
        .eq("business_id", business.id)
        .eq("is_available", true)
        .order("name");
      setProducts((data ?? []) as Product[]);
    })();
  }, [business?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    cart.forEach((l) => {
      const line = l.price * l.qty;
      subtotal += line;
      tax += (line * l.tax_rate) / 100;
    });
    const total = Math.max(0, subtotal + tax - discount);
    return { subtotal, tax, total };
  }, [cart, discount]);

  const addToCart = (p: Product) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.product_id === p.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), tax_rate: Number(p.tax_rate), qty: 1 }];
    });
  };
  const setQty = (id: string, qty: number) =>
    setCart((c) => c.map((l) => (l.product_id === id ? { ...l, qty: Math.max(0, qty) } : l)).filter((l) => l.qty > 0));

  const checkout = async (method: PaymentMethod) => {
    if (!business || !currentBranch || cart.length === 0) return;
    setBusy(true);
    const invoice = generateInvoiceNumber(currentBranch.name);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        business_id: business.id,
        branch_id: currentBranch.id,
        invoice_number: invoice,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount,
        total: totals.total,
        payment_method: method,
        status: "completed",
        cashier_id: user?.id,
        cashier_name: profile?.full_name || profile?.email || "Cashier",
      })
      .select("id,invoice_number,created_at")
      .single();
    if (error || !order) {
      setBusy(false);
      return toast.error(error?.message ?? "Could not create order");
    }
    const items = cart.map((l) => ({
      order_id: order.id,
      product_id: l.product_id,
      name: l.name,
      quantity: l.qty,
      price: l.price,
      tax_rate: l.tax_rate,
      line_total: l.price * l.qty * (1 + l.tax_rate / 100),
    }));
    const { error: itemErr } = await supabase.from("order_items").insert(items);
    setBusy(false);
    if (itemErr) return toast.error(itemErr.message);
    toast.success("Payment successful");
    setReceipt({
      business: business!,
      branch: currentBranch!,
      invoiceNumber: order.invoice_number,
      createdAt: order.created_at,
      cashierName: profile?.full_name || profile?.email || "Cashier",
      items: cart.map((l) => ({ name: l.name, qty: l.qty, price: l.price, tax_rate: l.tax_rate })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount,
      total: totals.total,
      paymentMethod: method,
    });
    setCart([]);
    setDiscount(0);
    // auto print after the receipt mounts
    setTimeout(() => window.print(), 250);
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[1fr_400px]">
      {/* Product grid */}
      <div className="flex flex-col overflow-hidden p-4 md:p-6">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {products.length === 0 ? "No products yet — add some in Products." : "No matches"}
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-2 gap-3 overflow-auto pb-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="group flex flex-col rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="flex h-20 items-center justify-center rounded-lg bg-secondary text-2xl font-bold text-muted-foreground">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-medium">{p.name}</div>
                <div className="mt-1 text-sm font-semibold text-primary">{formatMoney(Number(p.price))}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <aside className="flex flex-col border-t bg-card lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">Current order</h2>
            <p className="text-xs text-muted-foreground">{cart.length} item{cart.length === 1 ? "" : "s"}</p>
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCart([])}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Tap a product to add it
            </div>
          ) : (
            <div className="divide-y">
              {cart.map((l) => (
                <div key={l.product_id} className="p-4">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{formatMoney(l.price)} · GST {l.tax_rate}%</div>
                    </div>
                    <div className="text-sm font-semibold">{formatMoney(l.price * l.qty)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.product_id, l.qty - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{l.qty}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.product_id, l.qty + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Tax</span><span>{formatMoney(totals.tax)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="discount">Discount</label>
            <Input
              id="discount"
              type="number"
              step="0.01"
              className="h-8 w-24 text-right"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span><span>{formatMoney(totals.total)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {([
              { m: "cash", l: "Cash", I: Banknote },
              { m: "card", l: "Card", I: CreditCard },
              { m: "upi", l: "UPI", I: Smartphone },
            ] as const).map((b) => (
              <Button
                key={b.m}
                disabled={busy || cart.length === 0}
                onClick={() => checkout(b.m)}
                className={cn("h-12 flex-col gap-0.5 text-xs", b.m === "cash" && "bg-[image:var(--gradient-primary)]")}
              >
                <b.I className="h-4 w-4" />
                {b.l}
              </Button>
            ))}
          </div>
        </div>
      </aside>

      {receipt && <Receipt data={receipt} />}
    </div>
  );
}
