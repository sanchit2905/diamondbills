
-- 1. business_members table
CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  branch_id uuid,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id)
);

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- Backfill from user_roles (best-effort, default branch chosen)
INSERT INTO public.business_members (user_id, business_id, role, branch_id)
SELECT ur.user_id, ur.business_id, ur.role,
  (SELECT b.id FROM public.branches b WHERE b.business_id = ur.business_id ORDER BY b.is_default DESC, b.created_at ASC LIMIT 1)
FROM public.user_roles ur
ON CONFLICT (user_id, business_id) DO NOTHING;

-- 2. Update helper functions to read business_members
CREATE OR REPLACE FUNCTION public.is_business_member(_user_id uuid, _business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE user_id = _user_id AND business_id = _business_id);
$$;

CREATE OR REPLACE FUNCTION public.is_business_manager(_user_id uuid, _business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE user_id = _user_id AND business_id = _business_id AND role IN ('owner','manager'));
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _business_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE user_id = _user_id AND business_id = _business_id AND role = _role);
$$;

-- 3. RLS for business_members
CREATE POLICY business_members_select_self_or_member
ON public.business_members FOR SELECT
USING (user_id = auth.uid() OR public.is_business_member(auth.uid(), business_id));

CREATE POLICY business_members_insert_owner_or_self_owner
ON public.business_members FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), business_id, 'owner')
  OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()))
);

CREATE POLICY business_members_update_owner
ON public.business_members FOR UPDATE
USING (public.has_role(auth.uid(), business_id, 'owner'));

CREATE POLICY business_members_delete_owner
ON public.business_members FOR DELETE
USING (public.has_role(auth.uid(), business_id, 'owner'));
