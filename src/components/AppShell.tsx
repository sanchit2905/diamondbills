import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LayoutDashboard, ShoppingCart, Package, Receipt, LogOut, Store, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "POS", icon: ShoppingCart },
  { to: "/products", label: "Products", icon: Package },
  { to: "/orders", label: "Orders", icon: Receipt },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { business, branches, currentBranch, setCurrentBranch, profile, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{business?.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{business?.business_type}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = path === item.to || path.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="px-2 py-1 text-xs text-muted-foreground">{profile?.email}</div>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start"
            onClick={async () => {
              await signOut();
              void nav({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:px-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm">{business?.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <Select
              value={currentBranch?.id}
              onValueChange={(id) => {
                const b = branches.find((x) => x.id === id);
                if (b) setCurrentBranch(b);
              }}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
        <nav className="grid grid-cols-4 border-t bg-card md:hidden">
          {NAV.map((item) => {
            const active = path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
