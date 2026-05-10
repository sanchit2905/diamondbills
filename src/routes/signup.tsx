import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const BUSINESS_TYPES = [
  { v: "cafe", l: "Café" },
  { v: "restaurant", l: "Restaurant" },
  { v: "salon", l: "Salon" },
  { v: "grocery", l: "Grocery" },
  { v: "bakery", l: "Bakery" },
  { v: "other", l: "Other" },
];

function SignupPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    businessName: "",
    businessType: "cafe",
    branchName: "Main Branch",
    gst: "",
    phone: "",
    address: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    console.log("[signup] starting signup for", form.email);
    const { data: signup, error: signErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName },
      },
    });
    if (signErr || !signup.user) {
      setBusy(false);
      const msg = signErr?.message ?? "Signup failed";
      setError(msg);
      toast.error(msg);
      return;
    }
    console.log("[signup] user created", signup.user.id, signup.user.email);

    if (!signup.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInErr) {
        setBusy(false);
        setError(signInErr.message);
        toast.error(signInErr.message);
        return;
      }
    }

    // Call provision-tenant edge function
    console.log("[signup] invoking provision-tenant…");
    const { data: prov, error: provErr } = await supabase.functions.invoke("provision-tenant", {
      body: {
        businessName: form.businessName,
        businessType: form.businessType,
        branchName: form.branchName,
        gst: form.gst || null,
        phone: form.phone || null,
        address: form.address || null,
        fullName: form.fullName,
      },
    });
    console.log("[signup] provision-tenant response", { prov, provErr });

    if (provErr || !prov?.ok) {
      setBusy(false);
      const msg = (prov as { error?: string } | null)?.error ?? provErr?.message ?? "Tenant provisioning failed";
      setError(msg);
      toast.error(msg);
      return;
    }
    console.log("[signup] tenant provisioned", {
      business_id: prov.business_id,
      branch_id: prov.branch_id,
      user_id: prov.user_id,
      email: prov.email,
    });

    await refresh();
    toast.success("Your store is ready");
    setBusy(false);
    void nav({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-[var(--shadow-elevated)]">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <span className="font-semibold">Tilly POS</span>
        </Link>
        <h1 className="text-2xl font-semibold">Create your store</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up your business in under a minute.</p>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Your name</Label>
            <Input required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" required minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2 mt-2 border-t pt-4">
            <Label className="text-base font-semibold">Business</Label>
          </div>
          <div className="space-y-2">
            <Label>Business name</Label>
            <Input required value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Business type</Label>
            <Select value={form.businessType} onValueChange={(v) => set("businessType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default branch name</Label>
            <Input value={form.branchName} onChange={(e) => set("branchName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>GST number (optional)</Label>
            <Input value={form.gst} onChange={(e) => set("gst", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating store…" : "Create store"}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
