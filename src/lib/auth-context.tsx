import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "cashier";

export interface BusinessSummary {
  id: string;
  name: string;
  business_type: string;
  gst_number: string | null;
  address: string | null;
  phone: string | null;
}

export interface BranchSummary {
  id: string;
  name: string;
  business_id: string;
  is_default: boolean;
}

interface AuthState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: { full_name: string | null; email: string | null } | null;
  business: BusinessSummary | null;
  branches: BranchSummary[];
  currentBranch: BranchSummary | null;
  role: AppRole | null;
  setCurrentBranch: (b: BranchSummary) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<BranchSummary | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const loadContext = async (uid: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("full_name,email").eq("id", uid).maybeSingle(),
      supabase
        .from("user_roles")
        .select("role,business_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);
    setProfile(prof ?? null);
    if (!roles || roles.length === 0) {
      setBusiness(null);
      setBranches([]);
      setCurrentBranchState(null);
      setRole(null);
      return;
    }
    const r = roles[0];
    setRole(r.role as AppRole);
    const [{ data: biz }, { data: brs }] = await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,business_type,gst_number,address,phone")
        .eq("id", r.business_id)
        .maybeSingle(),
      supabase
        .from("branches")
        .select("id,name,business_id,is_default")
        .eq("business_id", r.business_id)
        .order("created_at", { ascending: true }),
    ]);
    setBusiness(biz as BusinessSummary | null);
    const list = (brs ?? []) as BranchSummary[];
    setBranches(list);
    const stored = typeof window !== "undefined" ? localStorage.getItem("pos.branch") : null;
    const found = list.find((b) => b.id === stored) ?? list.find((b) => b.is_default) ?? list[0] ?? null;
    setCurrentBranchState(found);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock per supabase guidance
        setTimeout(() => {
          void loadContext(s.user.id);
        }, 0);
      } else {
        setProfile(null);
        setBusiness(null);
        setBranches([]);
        setCurrentBranchState(null);
        setRole(null);
      }
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadContext(data.session.user.id);
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const setCurrentBranch = (b: BranchSummary) => {
    setCurrentBranchState(b);
    if (typeof window !== "undefined") localStorage.setItem("pos.branch", b.id);
  };

  const refresh = async () => {
    if (user) await loadContext(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider
      value={{
        loading,
        user,
        session,
        profile,
        business,
        branches,
        currentBranch,
        role,
        setCurrentBranch,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
