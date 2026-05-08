-- Track automatic inventory-cost recalculations for sales transactions.

create table if not exists public.sales_cost_revisions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sale_id uuid not null references public.sales_transactions(id) on delete cascade,
  old_purchase_cost_amount numeric(18,2),
  new_purchase_cost_amount numeric(18,2) not null,
  old_value_added_amount numeric(18,2),
  new_value_added_amount numeric(18,2) not null,
  reason text not null,
  metadata jsonb default '{}'::jsonb,
  recalculated_by uuid references public.profiles(id) on delete set null,
  recalculated_at timestamptz not null default now()
);

create index if not exists idx_sales_cost_revisions_store_sale
  on public.sales_cost_revisions(store_id, sale_id, recalculated_at desc);

create index if not exists idx_sales_cost_revisions_recalculated_at
  on public.sales_cost_revisions(recalculated_at desc);

alter table public.sales_transactions
  add column if not exists cost_calculated_at timestamptz,
  add column if not exists cost_calculation_method text,
  add column if not exists cost_calculation_note text;
