-- ============================================================================
-- Phase 2G: real inventory module
--
-- Replaces the `/inventory` placeholder with a real catalog of stock items.
-- The Phase 1 init schema already created `public.inventory_items` with the
-- core columns (sku, name, weight, weight_unit, quantity_on_hand, unit_cost,
-- total_cost, status, source_customer_purchase_id). Phase 2G extends that
-- table with the spec fields needed for direct-method VAT cost sourcing:
--
--   * product_type / purity / unit
--   * initial_quantity / current_quantity
--   * initial_weight  / current_weight
--   * purchase_unit_price / purchase_cost_amount / selling_price
--   * source_type (manual / customer_purchase / supplier / adjustment /
--                  excel_import) + source_id + source_reference
--   * is_tax_cost_source       — controls whether this stock can be linked
--                                to a sale to provide its purchase cost
--   * imported_at              — when the piece arrived in stock; used by
--                                the inventory list ordering
--   * attachment_url           — optional receipt/photo link
--   * archived_at / archived_by / archived_reason — soft-delete trail
--
-- The legacy columns (quantity_on_hand, weight, unit_cost, total_cost) are
-- kept and mirrored by a BEFORE INSERT trigger so the existing
-- customer-purchases linker (`src/lib/customer-purchases/inventory.ts`) and
-- the legacy /reports/inventory page continue to work without changes.
--
-- The inventory_status enum is extended with the new lifecycle values from
-- the spec: partially_sold, melted, returned, adjusted, archived. The
-- existing values (in_stock, sold, reserved, written_off) are kept.
--
-- Adds an SKU generator + sequence table for the
-- `NGOCTRAM-{CATEGORY_CODE}-YYYYMMDD-{NNNN}` pattern.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- inventory_items: new columns (all nullable / safe defaults so backfill can
-- run on existing rows). The new inventory_status values + inventory_source_type
-- enum are created in 20260506000007_phase2g_inventory_enums.sql.
-- ---------------------------------------------------------------------------
alter table public.inventory_items
  add column if not exists product_type text,
  add column if not exists purity text,
  add column if not exists unit text,
  add column if not exists initial_quantity numeric(14,4),
  add column if not exists current_quantity numeric(14,4),
  add column if not exists initial_weight numeric(14,4),
  add column if not exists current_weight numeric(14,4),
  add column if not exists purchase_unit_price numeric(18,2),
  add column if not exists purchase_cost_amount numeric(18,2),
  add column if not exists selling_price numeric(18,2),
  add column if not exists source_type public.inventory_source_type
    not null default 'manual',
  add column if not exists source_id uuid,
  add column if not exists source_reference text,
  add column if not exists is_tax_cost_source boolean not null default true,
  add column if not exists imported_at timestamptz,
  add column if not exists attachment_url text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id)
    on delete set null,
  add column if not exists archived_reason text;

-- ---------------------------------------------------------------------------
-- Backfill: copy legacy columns into the new ones, infer source_type from
-- source_customer_purchase_id, mirror weight_unit -> unit, set imported_at.
-- ---------------------------------------------------------------------------
update public.inventory_items
set
  initial_quantity = coalesce(initial_quantity, quantity_on_hand),
  current_quantity = coalesce(current_quantity, quantity_on_hand),
  initial_weight   = coalesce(initial_weight, weight),
  current_weight   = coalesce(current_weight, weight),
  purchase_cost_amount = coalesce(
    purchase_cost_amount,
    nullif(total_cost, 0)
  ),
  purchase_unit_price = coalesce(
    purchase_unit_price,
    nullif(unit_cost, 0)
  ),
  unit = coalesce(unit, weight_unit),
  imported_at = coalesce(imported_at, created_at),
  source_type = case
    when source_customer_purchase_id is not null then 'customer_purchase'::public.inventory_source_type
    else source_type
  end,
  source_id = coalesce(source_id, source_customer_purchase_id);

-- ---------------------------------------------------------------------------
-- Sync trigger: keep new + legacy columns aligned on insert/update so the
-- customer-purchase linker (which only writes to the legacy columns) and the
-- new inventory form (which writes to the new columns) both produce valid
-- rows.
-- ---------------------------------------------------------------------------
create or replace function public.sync_inventory_columns()
returns trigger
language plpgsql
as $$
begin
  -- New <- legacy (when only legacy provided, e.g. customer-purchase linker)
  if new.current_quantity is null then
    new.current_quantity := new.quantity_on_hand;
  end if;
  if new.initial_quantity is null then
    new.initial_quantity := coalesce(new.current_quantity, new.quantity_on_hand);
  end if;
  if new.current_weight is null then
    new.current_weight := new.weight;
  end if;
  if new.initial_weight is null then
    new.initial_weight := coalesce(new.current_weight, new.weight);
  end if;
  if new.purchase_cost_amount is null and coalesce(new.total_cost, 0) > 0 then
    new.purchase_cost_amount := new.total_cost;
  end if;
  if new.purchase_unit_price is null and coalesce(new.unit_cost, 0) > 0 then
    new.purchase_unit_price := new.unit_cost;
  end if;
  if new.unit is null then
    new.unit := new.weight_unit;
  end if;
  if new.imported_at is null then
    new.imported_at := coalesce(new.created_at, now());
  end if;

  -- Legacy <- new (when only the new columns were written)
  if coalesce(new.quantity_on_hand, 0) = 0 and new.current_quantity is not null then
    new.quantity_on_hand := new.current_quantity;
  end if;
  if new.weight is null and new.current_weight is not null then
    new.weight := new.current_weight;
  end if;
  if coalesce(new.unit_cost, 0) = 0 and new.purchase_unit_price is not null then
    new.unit_cost := new.purchase_unit_price;
  end if;
  if coalesce(new.total_cost, 0) = 0 and new.purchase_cost_amount is not null then
    new.total_cost := new.purchase_cost_amount;
  end if;

  -- Derived: purchase_unit_price = purchase_cost_amount / initial_weight
  if new.purchase_unit_price is null
     and new.purchase_cost_amount is not null
     and coalesce(new.initial_weight, 0) > 0 then
    new.purchase_unit_price := new.purchase_cost_amount / new.initial_weight;
    new.unit_cost := new.purchase_unit_price;
  end if;

  -- Auto-archive metadata: when status flips to 'archived' record archived_at.
  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_inventory_columns on public.inventory_items;
create trigger trg_sync_inventory_columns
  before insert or update on public.inventory_items
  for each row execute function public.sync_inventory_columns();

-- Touch all rows so the backfill above + sync trigger reconcile everything.
update public.inventory_items set updated_at = updated_at;

-- ---------------------------------------------------------------------------
-- SKU generator: NGOCTRAM-{CATEGORY_CODE}-{YYYYMMDD}-{NNNN}
-- We use a per-(store, category, date) sequence table so concurrent inserts
-- don't collide, and so the sequence resets daily per category.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_sku_sequences (
  store_id uuid not null references public.stores(id) on delete cascade,
  category_code text not null,
  date_key text not null,
  next_value int not null default 1,
  primary key (store_id, category_code, date_key)
);

alter table public.inventory_sku_sequences enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='inventory_sku_sequences'
      and policyname='inventory_sku_sequences_member_read'
  ) then
    create policy "inventory_sku_sequences_member_read" on public.inventory_sku_sequences
      for select using (store_id = public.current_store_id());
  end if;
end
$$;

create or replace function public.next_inventory_sku(
  p_store_id uuid,
  p_category_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date_key text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD');
  v_code text := upper(coalesce(nullif(trim(p_category_code), ''), 'SP'));
  v_seq int;
begin
  insert into public.inventory_sku_sequences (store_id, category_code, date_key, next_value)
  values (p_store_id, v_code, v_date_key, 2)
  on conflict (store_id, category_code, date_key) do update
    set next_value = inventory_sku_sequences.next_value + 1
  returning next_value into v_seq;

  -- next_value was just incremented (or initialized to 2). The current SKU
  -- index is therefore (next_value - 1).
  return 'NGOCTRAM-' || v_code || '-' || v_date_key || '-' || lpad((v_seq - 1)::text, 4, '0');
end;
$$;

grant execute on function public.next_inventory_sku(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes for the new list / picker / dashboard queries
-- ---------------------------------------------------------------------------
create index if not exists idx_inventory_items_sku
  on public.inventory_items(store_id, sku);
create index if not exists idx_inventory_items_source
  on public.inventory_items(store_id, source_type, source_id);
create index if not exists idx_inventory_items_imported_at
  on public.inventory_items(store_id, imported_at desc);
create index if not exists idx_inventory_items_status_active
  on public.inventory_items(store_id, status)
  where status not in ('archived', 'sold');
create index if not exists idx_inventory_items_missing_cost
  on public.inventory_items(store_id)
  where purchase_cost_amount is null and is_tax_cost_source = true;

-- ---------------------------------------------------------------------------
-- Audit-log convenience: a partial unique index on (store_id, sku) guarantees
-- the SKU is unique within the store but allows nulls (we generate one when
-- the form leaves it blank). Done here so the SKU generator can rely on it.
-- ---------------------------------------------------------------------------
create unique index if not exists ux_inventory_items_store_sku
  on public.inventory_items(store_id, sku)
  where sku is not null;
