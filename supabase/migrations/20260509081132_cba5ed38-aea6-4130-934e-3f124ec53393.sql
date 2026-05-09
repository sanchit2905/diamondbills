
-- Enums
create type public.app_role as enum ('owner','manager','cashier');
create type public.business_type as enum ('cafe','restaurant','salon','grocery','bakery','other');
create type public.payment_method as enum ('cash','card','upi','other');
create type public.order_status as enum ('completed','refunded','void');

-- Tables
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type public.business_type not null default 'other',
  gst_number text,
  address text,
  phone text,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index branches_business_idx on public.branches(business_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, business_id, role)
);
create index user_roles_user_idx on public.user_roles(user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index categories_business_idx on public.categories(business_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  price numeric(10,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_business_idx on public.products(business_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  invoice_number text not null,
  subtotal numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method public.payment_method not null default 'cash',
  status public.order_status not null default 'completed',
  cashier_id uuid,
  cashier_name text,
  created_at timestamptz not null default now()
);
create unique index orders_business_invoice_idx on public.orders(business_id, invoice_number);
create index orders_branch_idx on public.orders(branch_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity int not null default 1,
  price numeric(10,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(10,2) not null default 0
);
create index order_items_order_idx on public.order_items(order_id);

-- Helper functions (security definer to avoid RLS recursion)
create or replace function public.has_role(_user_id uuid, _business_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id and business_id = _business_id and role = _role
  );
$$;

create or replace function public.is_business_member(_user_id uuid, _business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id and business_id = _business_id
  );
$$;

create or replace function public.is_business_manager(_user_id uuid, _business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id and business_id = _business_id and role in ('owner','manager')
  );
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Enable RLS
alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- profiles: own only
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- businesses
create policy "businesses_select_members" on public.businesses for select
  using (public.is_business_member(auth.uid(), id) or auth.uid() = owner_id);
create policy "businesses_insert_owner" on public.businesses for insert
  with check (auth.uid() = owner_id);
create policy "businesses_update_owner" on public.businesses for update
  using (public.has_role(auth.uid(), id, 'owner'));

-- user_roles
create policy "user_roles_select_in_business" on public.user_roles for select
  using (user_id = auth.uid() or public.is_business_member(auth.uid(), business_id));
create policy "user_roles_insert" on public.user_roles for insert
  with check (
    -- Owner can add roles, OR a user can add themselves as owner of their own new business
    public.has_role(auth.uid(), business_id, 'owner')
    or (auth.uid() = user_id and exists (
        select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
    ))
  );
create policy "user_roles_delete_owner" on public.user_roles for delete
  using (public.has_role(auth.uid(), business_id, 'owner'));

-- branches
create policy "branches_select_members" on public.branches for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "branches_insert_mgmt" on public.branches for insert
  with check (
    public.is_business_manager(auth.uid(), business_id)
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );
create policy "branches_update_mgmt" on public.branches for update
  using (public.is_business_manager(auth.uid(), business_id));
create policy "branches_delete_owner" on public.branches for delete
  using (public.has_role(auth.uid(), business_id, 'owner'));

-- categories
create policy "categories_select_members" on public.categories for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "categories_write_mgmt" on public.categories for all
  using (public.is_business_manager(auth.uid(), business_id))
  with check (public.is_business_manager(auth.uid(), business_id));

-- products
create policy "products_select_members" on public.products for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "products_write_mgmt" on public.products for all
  using (public.is_business_manager(auth.uid(), business_id))
  with check (public.is_business_manager(auth.uid(), business_id));

-- orders
create policy "orders_select_members" on public.orders for select
  using (public.is_business_member(auth.uid(), business_id));
create policy "orders_insert_members" on public.orders for insert
  with check (public.is_business_member(auth.uid(), business_id));
create policy "orders_update_mgmt" on public.orders for update
  using (public.is_business_manager(auth.uid(), business_id));

-- order_items via parent order
create policy "order_items_select" on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and public.is_business_member(auth.uid(), o.business_id)
  ));
create policy "order_items_insert" on public.order_items for insert
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id and public.is_business_member(auth.uid(), o.business_id)
  ));
