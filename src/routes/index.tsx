import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Receipt, Store, Zap, Shield, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Tilly POS</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" /> Built for cafés, restaurants, salons, grocery & bakeries
          </div>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight md:text-6xl">
            The POS your{" "}
            <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
              counter deserves
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            Ring up sales in seconds. Print GST-ready thermal receipts. Manage products,
            branches, and reports — all from one beautifully simple dashboard.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
          {[
            { icon: Receipt, title: "Lightning POS", desc: "Tablet-friendly grid, search, discounts, instant invoicing." },
            { icon: Store, title: "Multi-store", desc: "Run multiple branches with isolated orders & reports." },
            { icon: BarChart3, title: "Live insights", desc: "Daily sales, top products, branch-wise performance." },
            { icon: Shield, title: "Secure by default", desc: "Per-business data isolation with row-level security." },
            { icon: Zap, title: "Auto-print receipts", desc: "Optimized for 58mm and 80mm thermal printers." },
            { icon: ShoppingBag, title: "Any business", desc: "Cafés, restaurants, salons, grocery, bakery — one app." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Tilly POS
      </footer>
    </div>
  );
}
