-- Inventory period accounting: opening Q2/2026 and daily movements.

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_category_id uuid not null references public.product_categories(id) on delete restrict,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  source_type text not null check (source_type in ('opening_balance','customer_purchase','manual','sale','adjustment')),
  source_id uuid,
  source_label text,
  movement_date date not null,
  weight_delta numeric(14,4) not null default 0,
  quantity_delta numeric(14,4) not null default 0,
  cost_delta numeric(18,2) not null default 0,
  unit_cost numeric(18,2),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(store_id, source_type, source_id)
);

create index if not exists idx_inventory_movements_store_date
  on public.inventory_movements(store_id, movement_date desc);
create index if not exists idx_inventory_movements_category_date
  on public.inventory_movements(store_id, product_category_id, movement_date desc);
create index if not exists idx_inventory_movements_source
  on public.inventory_movements(store_id, source_type, source_id);

alter table public.inventory_movements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='inventory_movements'
      and policyname='inventory_movements_member_read'
  ) then
    create policy "inventory_movements_member_read" on public.inventory_movements
      for select using (store_id = public.current_store_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='inventory_movements'
      and policyname='inventory_movements_staff_write'
  ) then
    create policy "inventory_movements_staff_write" on public.inventory_movements
      for all using (
        store_id = public.current_store_id()
        and public.current_user_role() in ('admin','staff')
      )
      with check (
        store_id = public.current_store_id()
        and public.current_user_role() in ('admin','staff')
      );
  end if;
end
$$;

insert into public.inventory_movements (
  store_id,
  product_category_id,
  source_type,
  source_id,
  source_label,
  movement_date,
  weight_delta,
  quantity_delta,
  cost_delta,
  unit_cost,
  note
)
select
  pc.store_id,
  pc.id,
  'opening_balance',
  pc.id,
  'Tồn đầu kỳ Q2/2026 từ báo cáo Q1',
  date '2026-04-01',
  case lower(pc.code)
    when 'bac' then 732.20
    when 'vangta' then 106.00
    when 'vang_ta' then 106.00
    when 'vangtay' then 51.41
    when 'vang_tay' then 51.41
  end,
  case lower(pc.code)
    when 'bac' then 732.20
    when 'vangta' then 106.00
    when 'vang_ta' then 106.00
    when 'vangtay' then 51.41
    when 'vang_tay' then 51.41
  end,
  case lower(pc.code)
    when 'bac' then 68487217
    when 'vangta' then 1745470239
    when 'vang_ta' then 1745470239
    when 'vangtay' then 197387431
    when 'vang_tay' then 197387431
  end,
  case lower(pc.code)
    when 'bac' then 93536.22
    when 'vangta' then 16466700.37
    when 'vang_ta' then 16466700.37
    when 'vangtay' then 3839475.41
    when 'vang_tay' then 3839475.41
  end,
  'Seed từ cột Cuối kỳ Q1 file bao_cao_q1_2026_tu_anh.xlsx'
from public.product_categories pc
where lower(pc.code) in ('bac','vangta','vang_ta','vangtay','vang_tay')
on conflict (store_id, source_type, source_id) do update
set
  movement_date = excluded.movement_date,
  weight_delta = excluded.weight_delta,
  quantity_delta = excluded.quantity_delta,
  cost_delta = excluded.cost_delta,
  unit_cost = excluded.unit_cost,
  note = excluded.note;
