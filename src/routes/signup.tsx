import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

    const { data: signup, error: signErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: form.fullName },
      },
    });
    if (signErr || !signup.user) {
      setBusy(false);
      toast.error(signErr?.message ?? "Signup failed");
      return;
    }

    // Ensure session (auto-confirm is enabled, but be safe)
    if (!signup.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInErr) {
        setBusy(false);
        toast.error(signInErr.message);
        return;
      }
    }

    const userId = signup.user.id;

    // Create business
    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .insert({
        name: form.businessName,
        business_type: form.businessType as "cafe" | "restaurant" | "salon" | "grocery" | "bakery" | "other",
        gst_number: form.gst || null,
        phone: form.phone || null,
        address: form.address || null,
        owner_id: userId,
      })
      .select("id")
      .single();
    if (bizErr || !biz) {
      setBusy(false);
      toast.error(bizErr?.message ?? "Could not create business");
      return;
    }

    // Owner role + default branch
    const [{ error: roleErr }, { error: brErr }] = await Promise.all([
      supabase.from("user_roles").insert({ user_id: userId, business_id: biz.id, role: "owner" }),
      supabase.from("branches").insert({
        business_id: biz.id,
        name: form.branchName || "Main Branch",
        address: form.address || null,
        phone: form.phone || null,
        is_default: true,
      }),
    ]);
    if (roleErr || brErr) {
      setBusy(false);
      toast.error((roleErr ?? brErr)?.message ?? "Setup failed");
      return;
    }

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
