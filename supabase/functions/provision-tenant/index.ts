// Provision tenant: create business, default branch, owner membership for current user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  businessName: string;
  businessType?: string;
  branchName?: string;
  gst?: string | null;
  phone?: string | null;
  address?: string | null;
  fullName?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return json({ error: "Missing Authorization bearer token" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the user from the JWT
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      console.error("[provision-tenant] auth.getUser failed", userErr);
      return json({ error: "Invalid session" }, 401);
    }
    const user = userData.user;
    console.log("[provision-tenant] user", user.id, user.email);

    const body = (await req.json().catch(() => ({}))) as Payload;
    if (!body.businessName?.trim()) {
      return json({ error: "businessName is required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Idempotency: if user already has a membership, return it.
    const { data: existing } = await admin
      .from("business_members")
      .select("business_id, branch_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      console.log("[provision-tenant] existing membership", existing);
      return json({ ok: true, alreadyProvisioned: true, ...existing });
    }

    // 1. business
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .insert({
        name: body.businessName.trim(),
        business_type: (body.businessType ?? "other"),
        gst_number: body.gst ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        owner_id: user.id,
      })
      .select("id")
      .single();
    if (bizErr || !biz) {
      console.error("[provision-tenant] business insert failed", bizErr);
      return json({ error: bizErr?.message ?? "Could not create business" }, 500);
    }
    console.log("[provision-tenant] business created", biz.id);

    // 2. default branch
    const { data: branch, error: brErr } = await admin
      .from("branches")
      .insert({
        business_id: biz.id,
        name: body.branchName?.trim() || "Main Branch",
        address: body.address ?? null,
        phone: body.phone ?? null,
        is_default: true,
      })
      .select("id")
      .single();
    if (brErr || !branch) {
      console.error("[provision-tenant] branch insert failed", brErr);
      return json({ error: brErr?.message ?? "Could not create branch" }, 500);
    }
    console.log("[provision-tenant] branch created", branch.id);

    // 3. owner membership (business_members)
    const { error: memErr } = await admin.from("business_members").insert({
      user_id: user.id,
      business_id: biz.id,
      branch_id: branch.id,
      role: "owner",
    });
    if (memErr) {
      console.error("[provision-tenant] business_members insert failed", memErr);
      return json({ error: memErr.message }, 500);
    }

    // Mirror to legacy user_roles so existing RLS-touching code keeps working
    await admin
      .from("user_roles")
      .insert({ user_id: user.id, business_id: biz.id, role: "owner" })
      .then(({ error }) => error && console.warn("[provision-tenant] user_roles mirror skipped", error.message));

    // Ensure profile exists / update full_name
    if (body.fullName) {
      await admin
        .from("profiles")
        .upsert({ id: user.id, full_name: body.fullName, email: user.email })
        .then(({ error }) => error && console.warn("[provision-tenant] profile upsert", error.message));
    }

    return json({
      ok: true,
      business_id: biz.id,
      branch_id: branch.id,
      user_id: user.id,
      email: user.email,
    });
  } catch (e) {
    console.error("[provision-tenant] fatal", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
