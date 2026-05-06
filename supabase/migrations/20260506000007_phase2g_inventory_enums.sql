-- ============================================================================
-- Phase 2G: extend inventory_status enum + introduce inventory_source_type.
--
-- The next migration (20260506000008_phase2g_inventory.sql) creates a trigger
-- function that references the new 'archived' enum value inline.
-- Postgres requires `ALTER TYPE ... ADD VALUE` to be committed before the new
-- value can be referenced, so we add the values here in their own migration
-- and consume them in 20260506000008.
-- ============================================================================

alter type public.inventory_status add value if not exists 'partially_sold';
alter type public.inventory_status add value if not exists 'melted';
alter type public.inventory_status add value if not exists 'returned';
alter type public.inventory_status add value if not exists 'adjusted';
alter type public.inventory_status add value if not exists 'archived';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_source_type') then
    create type public.inventory_source_type as enum (
      'manual', 'customer_purchase', 'supplier', 'adjustment', 'excel_import'
    );
  end if;
end
$$;
