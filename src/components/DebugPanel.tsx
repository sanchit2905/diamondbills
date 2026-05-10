import { useEffect, useState } from "react";
import { Bug, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

interface Counts {
  products: number | null;
  orders: number | null;
  rlsTenantOk: boolean | null;
}

export function DebugPanel() {
  const { user, business, currentBranch, role } = useAuth();
  const [open, setOpen] = useState(true);
  const [counts, setCounts] = useState<Counts>({ products: null, orders: null, rlsTenantOk: null });
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!business) return;
    void (async () => {
      const [{ count: p }, { count: o }, { data: bizCheck }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("businesses").select("id").eq("id", business.id).maybeSingle(),
      ]);
      setCounts({ products: p ?? 0, orders: o ?? 0, rlsTenantOk: !!bizCheck });
    })();
  }, [business?.id]);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1200);
  };

  const Row = ({ k, v }: { k: string; v: string | number | null | undefined }) => {
    const display = v === null || v === undefined || v === "" ? "—" : String(v);
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
        <span className="text-muted-foreground">{k}</span>
        <button
          onClick={() => copy(k, display)}
          className="group flex max-w-[60%] items-center gap-1.5 truncate font-mono text-foreground hover:text-primary"
          title="Copy"
        >
          <span className="truncate">{display}</span>
          {copied === k ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60" />}
        </button>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-dashed bg-muted/30 p-4">
      <button onClick={() => setOpen((s) => !s)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bug className="h-4 w-4" /> Debug panel
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase text-muted-foreground">dev</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Session</div>
            <Row k="user.email" v={user?.email} />
            <Row k="user.id" v={user?.id} />
            <Row k="role" v={role} />
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Tenant</div>
            <Row k="business_id" v={business?.id} />
            <Row k="business.name" v={business?.name} />
            <Row k="branch_id" v={currentBranch?.id} />
            <Row k="branch.name" v={currentBranch?.name} />
          </div>
          <div className="rounded-lg border bg-card p-3 md:col-span-2">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Database (RLS-scoped)</div>
            <Row k="products (count)" v={counts.products} />
            <Row k="orders (count)" v={counts.orders} />
            <Row
              k="active RLS tenant context"
              v={
                counts.rlsTenantOk === null
                  ? "checking…"
                  : counts.rlsTenantOk
                    ? `✓ visible as ${role} of ${business?.name}`
                    : "✗ business row not visible (RLS blocked)"
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}
