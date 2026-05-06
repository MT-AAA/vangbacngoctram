-- ============================================================================
-- Initial schema for vangbacngoctram (jewelry / gold / silver / gemstone shop)
-- VAT: direct method on value added (Điều 13, Luật Thuế GTGT VN)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. stores (tenants)
-- ---------------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  tax_code text,
  address text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_stores_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'staff', 'viewer');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  role public.user_role not null default 'staff',
  full_name text,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_store_id on public.profiles(store_id);
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. product_categories (Vàng ta, Vàng tây, Bạc)
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null, -- 'vang_ta', 'vang_tay', 'bac'
  name text not null, -- 'Vàng ta', 'Vàng tây', 'Bạc'
  description text,
  vat_rate numeric(5,2) not null default 10.00,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);

create index if not exists idx_product_categories_store_id on public.product_categories(store_id);
create trigger trg_product_categories_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. classification_rules
-- ---------------------------------------------------------------------------
create table if not exists public.classification_rules (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  keyword text not null,
  priority int not null default 100, -- lower = higher priority (matched first)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_classification_rules_store_id on public.classification_rules(store_id);
create index if not exists idx_classification_rules_category_id on public.classification_rules(category_id);
create trigger trg_classification_rules_updated_at
  before update on public.classification_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. import_files
-- ---------------------------------------------------------------------------
create type public.import_status as enum (
  'uploaded', 'processing', 'completed', 'failed'
);

create table if not exists public.import_files (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  file_name text not null,
  storage_path text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  status public.import_status not null default 'uploaded',
  total_rows int not null default 0,
  inserted_rows int not null default 0,
  updated_rows int not null default 0,
  error_rows int not null default 0,
  error_log jsonb,
  notes text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_import_files_store_id on public.import_files(store_id);

-- ---------------------------------------------------------------------------
-- 6. inventory_items
-- ---------------------------------------------------------------------------
create type public.inventory_status as enum ('in_stock', 'sold', 'reserved', 'written_off');

create table if not exists public.inventory_items (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_category_id uuid references public.product_categories(id) on delete set null,
  sku text,
  name text not null,
  weight numeric(14,4),
  weight_unit text not null default 'chỉ', -- 'chỉ' (3.75g), 'gram', 'lượng'
  quantity_on_hand numeric(14,4) not null default 0,
  unit_cost numeric(18,2) not null default 0, -- VND per unit
  total_cost numeric(18,2) not null default 0,
  status public.inventory_status not null default 'in_stock',
  notes text,
  source_customer_purchase_id uuid, -- FK added below to break circular ref
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_items_store_id on public.inventory_items(store_id);
create index if not exists idx_inventory_items_category_id on public.inventory_items(product_category_id);
create index if not exists idx_inventory_items_status on public.inventory_items(status);
create trigger trg_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. customer_purchases (shop buys gold/silver from walk-in customers)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_purchases (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_category_id uuid references public.product_categories(id) on delete set null,
  purchase_date date not null,
  customer_name text,
  customer_phone text,
  customer_id_card text,
  product_name text not null,
  weight numeric(14,4),
  weight_unit text not null default 'chỉ',
  quantity numeric(14,4) not null default 1,
  unit_price numeric(18,2) not null default 0,
  total_amount numeric(18,2) not null default 0,
  becomes_inventory boolean not null default true,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_purchases_store_id on public.customer_purchases(store_id);
create index if not exists idx_customer_purchases_date on public.customer_purchases(purchase_date);
create index if not exists idx_customer_purchases_category_id on public.customer_purchases(product_category_id);
create trigger trg_customer_purchases_updated_at
  before update on public.customer_purchases
  for each row execute function public.set_updated_at();

alter table public.inventory_items
  add constraint inventory_items_source_customer_purchase_fkey
  foreign key (source_customer_purchase_id)
  references public.customer_purchases(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 8. sales_transactions
-- ---------------------------------------------------------------------------
create type public.purchase_cost_source as enum (
  'excel', 'manual', 'inventory', 'average', 'unknown'
);

create type public.tax_calc_status as enum (
  'complete', 'missing_purchase_cost', 'estimated'
);

create table if not exists public.sales_transactions (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  import_file_id uuid references public.import_files(id) on delete set null,

  -- core invoice / dedupe
  invoice_no text,
  transaction_hash text not null,
  sale_date date not null,

  -- customer
  customer_name text,
  customer_phone text,

  -- product
  product_name_raw text not null,
  product_name text,
  product_category_id uuid references public.product_categories(id) on delete set null,
  classification_source text, -- 'rule' | 'manual' | 'unknown'

  -- amounts
  quantity numeric(14,4) not null default 1,
  weight numeric(14,4),
  weight_unit text default 'chỉ',
  unit_price numeric(18,2) not null default 0,
  total_amount numeric(18,2) not null default 0,

  -- VAT direct method inputs
  purchase_cost_amount numeric(18,2),
  purchase_cost_source public.purchase_cost_source not null default 'unknown',
  linked_inventory_item_id uuid references public.inventory_items(id) on delete set null,
  value_added_amount numeric(18,2),
  tax_calculation_status public.tax_calc_status not null default 'missing_purchase_cost',

  -- raw data preserved from Excel
  raw_data jsonb,

  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (store_id, transaction_hash)
);

create index if not exists idx_sales_transactions_store_id on public.sales_transactions(store_id);
create index if not exists idx_sales_transactions_sale_date on public.sales_transactions(sale_date);
create index if not exists idx_sales_transactions_category_id on public.sales_transactions(product_category_id);
create index if not exists idx_sales_transactions_invoice_no on public.sales_transactions(invoice_no);
create index if not exists idx_sales_transactions_tax_status on public.sales_transactions(tax_calculation_status);
create index if not exists idx_sales_transactions_import_file on public.sales_transactions(import_file_id);
create trigger trg_sales_transactions_updated_at
  before update on public.sales_transactions
  for each row execute function public.set_updated_at();

-- Auto-fill value_added_amount and tax_calculation_status
create or replace function public.compute_sales_value_added()
returns trigger
language plpgsql
as $$
begin
  if new.purchase_cost_amount is null then
    new.value_added_amount := null;
    if new.tax_calculation_status is null or new.tax_calculation_status = 'complete' then
      new.tax_calculation_status := 'missing_purchase_cost';
    end if;
  else
    new.value_added_amount := coalesce(new.total_amount, 0) - coalesce(new.purchase_cost_amount, 0);
    if new.purchase_cost_source = 'average' then
      new.tax_calculation_status := 'estimated';
    else
      new.tax_calculation_status := 'complete';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_sales_compute_va
  before insert or update on public.sales_transactions
  for each row execute function public.compute_sales_value_added();

-- ---------------------------------------------------------------------------
-- 9. tax_settings (per store)
-- ---------------------------------------------------------------------------
create table if not exists public.tax_settings (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  vat_rate numeric(5,2) not null default 10.00,
  method text not null default 'direct_value_added',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id)
);

create trigger trg_tax_settings_updated_at
  before update on public.tax_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. tax_periods
-- ---------------------------------------------------------------------------
create type public.tax_period_type as enum ('month', 'quarter', 'year', 'custom');

create table if not exists public.tax_periods (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  period_type public.tax_period_type not null,
  start_date date not null,
  end_date date not null,
  year int not null,
  is_locked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, period_type, start_date, end_date)
);

create index if not exists idx_tax_periods_store_id on public.tax_periods(store_id);
create index if not exists idx_tax_periods_year on public.tax_periods(year);
create index if not exists idx_tax_periods_dates on public.tax_periods(start_date, end_date);
create trigger trg_tax_periods_updated_at
  before update on public.tax_periods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. tax_reports (one row per period, snapshot of calculated VAT)
-- ---------------------------------------------------------------------------
create table if not exists public.tax_reports (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,

  total_sales_amount numeric(18,2) not null default 0,
  total_purchase_cost_amount numeric(18,2) not null default 0,
  value_added_amount numeric(18,2) not null default 0,
  negative_carried_in numeric(18,2) not null default 0, -- positive number representing absolute carry-in
  taxable_value_added numeric(18,2) not null default 0,
  vat_rate numeric(5,2) not null default 10.00,
  vat_amount numeric(18,2) not null default 0,
  negative_carried_out numeric(18,2) not null default 0, -- positive number; absolute negative carried to next period

  -- counters
  total_transactions int not null default 0,
  transactions_missing_purchase_cost int not null default 0,
  transactions_estimated int not null default 0,

  notes text,
  calculated_at timestamptz not null default now(),
  calculated_by uuid references public.profiles(id) on delete set null,
  unique (store_id, tax_period_id)
);

create index if not exists idx_tax_reports_store_id on public.tax_reports(store_id);
create index if not exists idx_tax_reports_period_id on public.tax_reports(tax_period_id);

-- ---------------------------------------------------------------------------
-- 12. audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null, -- 'insert' | 'update' | 'delete' | 'login' | 'import' | etc.
  entity_type text not null, -- table name or virtual entity
  entity_id text,
  diff jsonb,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_store_id on public.audit_logs(store_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Helper: get current user's store_id and role
-- ---------------------------------------------------------------------------
create or replace function public.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Auth bootstrap: trigger creates a profile + a default store on first signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_profile_count int;
  v_new_store_id uuid;
begin
  select count(*) into v_existing_profile_count from public.profiles;

  -- First user becomes admin of a freshly created default store.
  if v_existing_profile_count = 0 then
    insert into public.stores (name)
    values (coalesce(new.raw_user_meta_data->>'store_name', 'Cửa hàng của tôi'))
    returning id into v_new_store_id;

    insert into public.profiles (id, store_id, role, full_name, email)
    values (
      new.id,
      v_new_store_id,
      'admin',
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email
    );

    perform public.seed_store_defaults(v_new_store_id);
  else
    -- Subsequent users start without a store; admin must assign them.
    insert into public.profiles (id, store_id, role, full_name, email)
    values (
      new.id,
      null,
      'staff',
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email
    );
  end if;

  return new;
end;
$$;

-- Seed default categories, classification rules, and tax_settings for a store
create or replace function public.seed_store_defaults(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vang_ta_id uuid;
  v_vang_tay_id uuid;
  v_bac_id uuid;
begin
  -- Categories
  insert into public.product_categories (store_id, code, name, vat_rate, display_order)
  values (p_store_id, 'vang_ta', 'Vàng ta', 10.00, 1)
  on conflict (store_id, code) do nothing
  returning id into v_vang_ta_id;
  if v_vang_ta_id is null then
    select id into v_vang_ta_id from public.product_categories where store_id = p_store_id and code = 'vang_ta';
  end if;

  insert into public.product_categories (store_id, code, name, vat_rate, display_order)
  values (p_store_id, 'vang_tay', 'Vàng tây', 10.00, 2)
  on conflict (store_id, code) do nothing
  returning id into v_vang_tay_id;
  if v_vang_tay_id is null then
    select id into v_vang_tay_id from public.product_categories where store_id = p_store_id and code = 'vang_tay';
  end if;

  insert into public.product_categories (store_id, code, name, vat_rate, display_order)
  values (p_store_id, 'bac', 'Bạc', 10.00, 3)
  on conflict (store_id, code) do nothing
  returning id into v_bac_id;
  if v_bac_id is null then
    select id into v_bac_id from public.product_categories where store_id = p_store_id and code = 'bac';
  end if;

  -- Classification rules — order matters (lowest priority first wins)
  -- Bạc keywords (priority 10 — checked first because "bạc" is unique)
  insert into public.classification_rules (store_id, category_id, keyword, priority) values
    (p_store_id, v_bac_id, 'bạc', 10),
    (p_store_id, v_bac_id, 'bac', 10);

  -- Vàng tây keywords (priority 20)
  insert into public.classification_rules (store_id, category_id, keyword, priority) values
    (p_store_id, v_vang_tay_id, '18k', 20),
    (p_store_id, v_vang_tay_id, '14k', 20),
    (p_store_id, v_vang_tay_id, '10k', 20),
    (p_store_id, v_vang_tay_id, 'vàng tây', 20),
    (p_store_id, v_vang_tay_id, 'vang tay', 20),
    (p_store_id, v_vang_tay_id, 'tây', 25);

  -- Vàng ta keywords (priority 30)
  insert into public.classification_rules (store_id, category_id, keyword, priority) values
    (p_store_id, v_vang_ta_id, '9999', 30),
    (p_store_id, v_vang_ta_id, '999', 30),
    (p_store_id, v_vang_ta_id, '24k', 30),
    (p_store_id, v_vang_ta_id, 'vàng ta', 30),
    (p_store_id, v_vang_ta_id, 'vang ta', 30);

  -- Tax settings
  insert into public.tax_settings (store_id, vat_rate, method)
  values (p_store_id, 10.00, 'direct_value_added')
  on conflict (store_id) do nothing;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.stores               enable row level security;
alter table public.profiles             enable row level security;
alter table public.product_categories   enable row level security;
alter table public.classification_rules enable row level security;
alter table public.import_files         enable row level security;
alter table public.inventory_items      enable row level security;
alter table public.customer_purchases   enable row level security;
alter table public.sales_transactions   enable row level security;
alter table public.tax_settings         enable row level security;
alter table public.tax_periods          enable row level security;
alter table public.tax_reports          enable row level security;
alter table public.audit_logs           enable row level security;

-- profiles: a user can read/update their own profile; admins can read all in their store
create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_admin_read_store" on public.profiles
  for select using (
    store_id is not null
    and store_id = public.current_store_id()
    and public.current_user_role() = 'admin'
  );

create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_update" on public.profiles
  for update using (
    store_id is not null
    and store_id = public.current_store_id()
    and public.current_user_role() = 'admin'
  ) with check (
    store_id = public.current_store_id()
  );

-- stores: members of a store can see it; admins can update it.
create policy "stores_member_read" on public.stores
  for select using (id = public.current_store_id());

create policy "stores_admin_update" on public.stores
  for update using (
    id = public.current_store_id() and public.current_user_role() = 'admin'
  ) with check (
    id = public.current_store_id() and public.current_user_role() = 'admin'
  );

-- Generic per-store table policy macro replacement:
-- All tenant tables follow: read if store_id = current_store_id; write if role in (admin, staff)
do $$
declare
  t text;
  tables text[] := array[
    'product_categories',
    'classification_rules',
    'import_files',
    'inventory_items',
    'customer_purchases',
    'sales_transactions',
    'tax_settings',
    'tax_periods',
    'tax_reports',
    'audit_logs'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      create policy "%1$I_member_read" on public.%1$I
      for select using (store_id = public.current_store_id());

      create policy "%1$I_staff_insert" on public.%1$I
      for insert with check (
        store_id = public.current_store_id()
        and public.current_user_role() in ('admin','staff')
      );

      create policy "%1$I_staff_update" on public.%1$I
      for update using (
        store_id = public.current_store_id()
        and public.current_user_role() in ('admin','staff')
      ) with check (
        store_id = public.current_store_id()
      );

      create policy "%1$I_admin_delete" on public.%1$I
      for delete using (
        store_id = public.current_store_id()
        and public.current_user_role() = 'admin'
      );
    $f$, t);
  end loop;
end;
$$;
