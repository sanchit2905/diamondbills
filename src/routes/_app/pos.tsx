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
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { ProductAvatar } from "@/components/ProductAvatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pos")({
  component: PosPage,
});

interface Product {
  id: string;
  name: string;
  price: number;
}

interface CartLine {
  product_id: string;
  name: string;
  price: number;
  qty: number;
}

type PaymentMethod = "cash" | "card" | "upi";

function PosPage() {
  const { business } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!business) return;

    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,business_id")
        .eq("business_id", business.id)
        .order("name");

      console.log("PRODUCTS", { data, error });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setProducts(data as Product[]);
      }
    })();
  }, [business]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((p) =>
      p.name.toLowerCase().includes(q)
    );
  }, [products, search]);

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );
  }, [cart]);

  const addToCart = (p: Product) => {
    setCart((c) => {
      const existing = c.find(
        (x) => x.product_id === p.id
      );

      if (existing) {
        return c.map((x) =>
          x.product_id === p.id
            ? { ...x, qty: x.qty + 1 }
            : x
        );
      }

      return [
        ...c,
        {
          product_id: p.id,
          name: p.name,
          price: Number(p.price),
          qty: 1,
        },
      ];
    });
  };

  const setQty = (
    product_id: string,
    qty: number
  ) => {
    setCart((c) =>
      c
        .map((x) =>
          x.product_id === product_id
            ? { ...x, qty }
            : x
        )
        .filter((x) => x.qty > 0)
    );
  };

  const checkout = async (
    method: PaymentMethod
  ) => {
    console.log("CHECKOUT START", {
      business,
      cart,
      total,
      method,
    });

    if (!business) {
      toast.error("No business found");
      return;
    }

    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("orders")
      .insert({
        business_id: business.id,
        total,
        payment_method: method,
      });

    console.log("ORDER RESULT", {
      error,
    });

    setBusy(false);

    if (error) {
      console.error(error);
      toast.error(error.message);
      return;
    }

    toast.success("Order created");

    setCart([]);
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col overflow-hidden p-4 md:p-6">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
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
                <ProductAvatar
                  name={p.name}
                  imageUrl={null}
                  rounded="rounded-none"
                  className="text-3xl"
                />
              </div>

              <div className="p-3">
                <div className="line-clamp-2 text-sm font-medium">
                  {p.name}
                </div>

                <div className="mt-1 text-sm font-semibold text-primary">
                  {formatMoney(Number(p.price))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="flex flex-col border-t bg-card lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">
              Current order
            </h2>

            <p className="text-xs text-muted-foreground">
              {cart.length} items
            </p>
          </div>

          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCart([])}
            >
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
                <div
                  key={l.product_id}
                  className="p-4"
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {l.name}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {formatMoney(l.price)}
                      </div>
                    </div>

                    <div className="text-sm font-semibold">
                      {formatMoney(
                        l.price * l.qty
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() =>
                        setQty(
                          l.product_id,
                          l.qty - 1
                        )
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>

                    <span className="w-8 text-center text-sm">
                      {l.qty}
                    </span>

                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() =>
                        setQty(
                          l.product_id,
                          l.qty + 1
                        )
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>

            <span>{formatMoney(total)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            {([
              {
                m: "cash",
                l: "Cash",
                I: Banknote,
              },
              {
                m: "card",
                l: "Card",
                I: CreditCard,
              },
              {
                m: "upi",
                l: "UPI",
                I: Smartphone,
              },
            ] as const).map((b) => (
              <Button
                key={b.m}
                disabled={
                  busy || cart.length === 0
                }
                onClick={() =>
                  checkout(b.m)
                }
                className={cn(
                  "h-12 flex-col gap-0.5 text-xs",
                  b.m === "cash" &&
                    "bg-[image:var(--gradient-primary)]"
                )}
              >
                <b.I className="h-4 w-4" />
                {b.l}
              </Button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
