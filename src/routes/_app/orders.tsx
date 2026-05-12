import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Receipt, printReceiptWhenReady, type ReceiptData } from "@/components/Receipt";

export const Route = createFileRoute("/_app/orders")({
  component: OrdersPage,
});

interface Order {
  id: string;
  
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
  cashier_name: string | null;
  created_at: string;
}

function OrdersPage() {
  const { business, currentBranch } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [reprint, setReprint] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!business || !currentBranch) return;
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,subtotal,tax,discount,total,payment_method,status,cashier_name,created_at")
        .eq("business_id", business.id)
        .eq("branch_id", currentBranch.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setOrders((data ?? []) as Order[]);
    })();
  }, [business?.id, currentBranch?.id]);

  const printAgain = async (o: Order) => {
    if (!business || !currentBranch) return;
    const { data: items } = await supabase
      .from("order_items")
      .select("name,quantity,price,tax_rate")
      .eq("order_id", o.id);
    setReprint({
      business,
      branch: currentBranch,
      invoiceNumber: `#${o.id.slice(0, 8).toUpperCase()}`,
      createdAt: o.created_at,
      cashierName: o.cashier_name ?? "Cashier",
      items: (items ?? []).map((it: { name: string; quantity: number; price: number; tax_rate: number }) => ({
        name: it.name,
        qty: it.quantity,
        price: Number(it.price),
        tax_rate: Number(it.tax_rate),
      })),
      subtotal: Number(o.subtotal),
      tax: Number(o.tax),
      discount: Number(o.discount),
      total: Number(o.total),
      paymentMethod: o.payment_method,
    });
    printReceiptWhenReady();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">Latest 100 orders for {currentBranch?.name}</p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No orders yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Cashier</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium">#{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-3">{o.cashier_name}</td>
                  <td className="px-4 py-3 uppercase">{o.payment_method}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(Number(o.total))}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => printAgain(o)}>
                      <Printer className="mr-1 h-4 w-4" /> Print
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {reprint && <Receipt data={reprint} />}
    </div>
  );
}
