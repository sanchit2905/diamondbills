import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setForm((f) => ({
      ...f,
      [key]: value,
    }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setBusy(true);
    setError(null);

    const { data: signup, error: signErr } =
      await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
          },
        },
      });

    if (signErr || !signup.user) {
      setBusy(false);

      const msg = signErr?.message ?? "Signup failed";

      setError(msg);
      toast.error(msg);

      return;
    }

    const { data: signInData, error: signInErr } =
      await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

    if (signInErr || !signInData.session) {
      setBusy(false);

      const msg = signInErr?.message ?? "Auto login failed";

      setError(msg);
      toast.error(msg);

      return;
    }

    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .insert({
        name: form.businessName,
      })
      .select()
      .single();

    if (bizErr || !biz) {
      setBusy(false);
      toast.error("Failed creating business");
      return;
    }

    await supabase.from("branches").insert({
      business_id: biz.id,
      name: form.branchName,
    });

    await supabase.from("business_members").insert({
      user_id: signup.user.id,
      business_id: biz.id,
      role: "owner",
    });

    await refresh();

    toast.success("Your store is ready");

    setBusy(false);

    window.location.href = "/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-[var(--shadow-elevated)]">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
          </div>

          <span className="font-semibold">Tilly POS</span>
        </Link>

        <h1 className="text-2xl font-semibold">
          Create your store
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Set up your business in under a minute.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-2 md:col-span-2">
            <Label>Your name</Label>

            <Input
              required
              value={form.fullName}
              onChange={(e) =>
                set("fullName", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>

            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                set("email", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>

            <Input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) =>
                set("password", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Business name</Label>

            <Input
              required
              value={form.businessName}
              onChange={(e) =>
                set("businessName", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Business type</Label>

            <Select
              value={form.businessType}
              onValueChange={(v) =>
                set("businessType", v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem
                    key={t.v}
                    value={t.v}
                  >
                    {t.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default branch name</Label>

            <Input
              value={form.branchName}
              onChange={(e) =>
                set("branchName", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>GST number (optional)</Label>

            <Input
              value={form.gst}
              onChange={(e) =>
                set("gst", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>

            <Input
              value={form.phone}
              onChange={(e) =>
                set("phone", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Address</Label>

            <Input
              value={form.address}
              onChange={(e) =>
                set("address", e.target.value)
              }
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              className="w-full"
              disabled={busy}
            >
              {busy
                ? "Creating store..."
                : "Create store"}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
