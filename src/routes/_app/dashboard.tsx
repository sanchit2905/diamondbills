import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatDateTime } from "@/lib/format";
import { TrendingUp, Receipt, IndianRupee, ShoppingBag } from "lucide-react";
import { DebugPanel } from "@/components/DebugPanel";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface Stats {
  todaySales: number;
  todayOrders: number;
  totalProducts: number;
  recent: Array<{ id: string; invoice_number: string; total: number; created_at: string; payment_method: string }>;
  top: Array<{ name: string; qty: number; revenue: number }>;
}

function Dashboard() {
  const { business, currentBranch } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!business || !currentBranch) return;
    void (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const { data: todays } = await supabase
        .from("orders")
        .select("id,total")
        .eq("business_id", business.id)
        .eq("branch_id", currentBranch.id)
        .gte("created_at", start.toISOString())
        .eq("status", "completed");

      const { data: recent } = await supabase
        .from("orders")
        .select("id,invoice_number,total,created_at,payment_method")
        .eq("business_id", business.id)
        .eq("branch_id", currentBranch.id)
        .order("created_at", { ascending: false })
        .limit(8);

      const { count: pCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id);

      // Top products in last 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: items } = await supabase
        .from("order_items")
        .select("name,quantity,line_total,orders!inner(business_id,branch_id,created_at,status)")
        .eq("orders.business_id", business.id)
        .eq("orders.branch_id", currentBranch.id)
        .eq("orders.status", "completed")
        .gte("orders.created_at", since.toISOString());

      const map = new Map<string, { qty: number; revenue: number }>();
      (items ?? []).forEach((it: { name: string; quantity: number; line_total: number }) => {
        const cur = map.get(it.name) ?? { qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += Number(it.line_total);
        map.set(it.name, cur);
      });
      const top = [...map.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      setStats({
        todaySales: (todays ?? []).reduce((a, o) => a + Number(o.total), 0),
        todayOrders: (todays ?? []).length,
        totalProducts: pCount ?? 0,
        recent: (recent ?? []) as Stats["recent"],
        top,
      });
    })();
  }, [business, currentBranch]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {currentBranch?.name} — {formatDateTime(new Date())}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={IndianRupee} label="Today's revenue" value={formatMoney(stats?.todaySales ?? 0)} accent />
        <StatCard icon={Receipt} label="Today's orders" value={String(stats?.todayOrders ?? 0)} />
        <StatCard icon={ShoppingBag} label="Products" value={String(stats?.totalProducts ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Recent orders</h2>
          <div className="mt-4 divide-y">
            {(stats?.recent ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No orders yet</p>
            )}
            {stats?.recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{o.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(o.created_at)} · {o.payment_method.toUpperCase()}
                  </div>
                </div>
                <div className="font-semibold">{formatMoney(Number(o.total))}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Top products (30d)</h2>
          <div className="mt-4 space-y-3">
            {(stats?.top ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales yet</p>
            )}
            {stats?.top.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-sm font-semibold">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.qty} sold</div>
                </div>
                <div className="text-sm font-semibold">{formatMoney(t.revenue)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-xl border bg-[image:var(--gradient-primary)] p-5 text-primary-foreground shadow-[var(--shadow-elevated)]"
          : "rounded-xl border bg-card p-5"
      }
    >
      <div className="flex items-center gap-2 text-sm opacity-90">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}
