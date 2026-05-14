import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  CreditCard,
  Smartphone,
  Percent,
  Printer,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { ProductAvatar } from "@/components/ProductAvatar";
import { cn } from "@/lib/utils";
import { Receipt, printReceiptWhenReady, type ReceiptData } from "@/components/Receipt";

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
type DiscountMode = "flat" | "percent";

function PosPage() {
  const { business, currentBranch, user, profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("flat");
  const [discountInput, setDiscountInput] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!business) return;
    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, tax_rate")
        .eq("business_id", business.id)
        .eq("is_available", true)
        .order("name");
      if (error) {
        console.error("[POS] load products", error);
        toast.error(error.message);
        return;
      }
      setProducts((data || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        tax_rate: Number(p.tax_rate ?? 0),
      })));
    })();
  }, [business?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.price * l.qty, 0),
    [cart],
  );

  const tax = useMemo(
    () => cart.reduce((s, l) => s + l.price * l.qty * (l.tax_rate / 100), 0),
    [cart],
  );

  const discount = useMemo(() => {
    const v = Number(discountInput);
    if (!v || v <= 0) return 0;
    if (discountMode === "percent") return Math.min(subtotal, (subtotal * v) / 100);
    return Math.min(subtotal, v);
  }, [discountInput, discountMode, subtotal]);

  const total = useMemo(
    () => Math.max(0, subtotal + tax - discount),
    [subtotal, tax, discount],
  );

  const addToCart = (p: Product) => {
    setCart((curr) => {
      const ex = curr.find((x) => x.product_id === p.id);
      if (ex) return curr.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...curr, { product_id: p.id, name: p.name, price: p.price, tax_rate: p.tax_rate, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart((curr) => curr.map((x) => (x.product_id === id ? { ...x, qty } : x)).filter((x) => x.qty > 0));
  };

  const checkout = async (method: PaymentMethod) => {
    if (!business || !currentBranch) {
      toast.error("No business/branch");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setBusy(true);

    const orderPayload = {
      business_id: business.id,
      branch_id: currentBranch.id,
      subtotal,
      tax,
      discount,
      total,
      payment_method: method,
      cashier_id: user?.id ?? null,
      cashier_name: profile?.full_name || profile?.email || null,
    };
    console.log("[POS] inserting order", orderPayload);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (orderErr || !order) {
      console.error("[POS] order insert failed", orderErr);
      toast.error(orderErr?.message ?? "Order insert failed");
      setBusy(false);
      return;
    }
    console.log("[POS] order inserted", order.id);

    const itemsPayload = cart.map((l) => ({
      order_id: order.id,
      product_id: l.product_id,
      name: l.name,
      price: l.price,
      quantity: l.qty,
      tax_rate: l.tax_rate,
      line_total: l.price * l.qty,
    }));
    console.log("[POS] inserting order_items", itemsPayload.length);

    const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
    if (itemsErr) {
      console.error("[POS] order_items insert failed", itemsErr);
      toast.error(`Order saved but items failed: ${itemsErr.message}`);
    } else {
      console.log("[POS] order_items inserted");
    }

    toast.success(`Order #${order.id.slice(0, 8).toUpperCase()} created`);

    setReceipt({
      business: {
        name: business.name,
        gst_number: business.gst_number,
        address: business.address,
        phone: business.phone,
      },
      branch: { name: currentBranch.name },
      invoiceNumber: `#${order.id.slice(0, 8).toUpperCase()}`,
      createdAt: order.created_at,
      cashierName: profile?.full_name || profile?.email || "Cashier",
      items: cart.map((l) => ({ name: l.name, qty: l.qty, price: l.price, tax_rate: l.tax_rate })),
      subtotal,
      tax,
      discount,
      total,
      paymentMethod: method,
    });
    printReceiptWhenReady();

    setCart([]);
    setDiscountInput("");
    setBusy(false);
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col overflow-hidden p-4 md:p-6">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9"
          />
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-auto pb-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="aspect-square w-full overflow-hidden">
                <ProductAvatar name={p.name} imageUrl={null} rounded="rounded-none" className="text-3xl" />
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                <div className="mt-1 text-sm font-semibold text-primary">{formatMoney(p.price)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="flex flex-col border-t bg-card lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">Current order</h2>
            <p className="text-xs text-muted-foreground">{cart.length} items</p>
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
              {cart.map((line) => (
                <div key={line.product_id} className="p-4">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm font-medium">{line.name}</div>
                      <div className="text-xs text-muted-foreground">{formatMoney(line.price)}</div>
                    </div>
                    <div className="text-sm font-semibold">{formatMoney(line.price * line.qty)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(line.product_id, line.qty - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{line.qty}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(line.product_id, line.qty + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border text-xs">
              <button
                type="button"
                className={cn("px-2 py-1", discountMode === "flat" ? "bg-secondary" : "")}
                onClick={() => setDiscountMode("flat")}
              >
                Flat
              </button>
              <button
                type="button"
                className={cn("px-2 py-1", discountMode === "percent" ? "bg-secondary" : "")}
                onClick={() => setDiscountMode("percent")}
              >
                %
              </button>
            </div>
            <div className="relative flex-1">
              <Percent className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                placeholder={discountMode === "percent" ? "Discount %" : "Discount amount"}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="h-9 pr-7"
              />
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            {tax > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{formatMoney(tax)}</span></div>}
            {discount > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>- {formatMoney(discount)}</span></div>}
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
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

          {receipt && (
            <Button variant="outline" className="w-full" onClick={() => printReceiptWhenReady()}>
              <Printer className="mr-2 h-4 w-4" /> Reprint last receipt
            </Button>
          )}
        </div>
      </aside>

      {receipt && <Receipt data={receipt} />}
    </div>
  );
}
