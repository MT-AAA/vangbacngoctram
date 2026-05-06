-- ============================================================================
-- Phase 2B: "Cần xử lý" data quality screen
--
-- Adds:
--   * is_intentionally_ignored flag on sales_transactions (so the store
--     owner can mark missing-purchase-cost rows that they will never fill
--     in — promotional gifts, known data gaps, etc.) plus reason / who /
--     when fields for the audit trail.
--   * Index on (store_id, is_intentionally_ignored) for the issues queue.
--   * Updated trigger so ignored rows take tax_calculation_status =
--     'ignored' (added in 20250506000004) instead of 'missing_purchase_cost',
--     and so unsetting the flag re-flags the row as missing.
-- ============================================================================

alter table public.sales_transactions
  add column if not exists is_intentionally_ignored boolean not null default false,
  add column if not exists ignored_reason text,
  add column if not exists ignored_at timestamptz,
  add column if not exists ignored_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_sales_transactions_ignored
  on public.sales_transactions(store_id, is_intentionally_ignored);

-- ---------------------------------------------------------------------------
-- Trigger: ignored rows are never reported as missing_purchase_cost.
-- ---------------------------------------------------------------------------
create or replace function public.compute_sales_value_added()
returns trigger
language plpgsql
as $$
begin
  if new.is_intentionally_ignored then
    new.value_added_amount := null;
    new.tax_calculation_status := 'ignored';
    return new;
  end if;

  if new.purchase_cost_amount is null then
    new.value_added_amount := null;
    if new.tax_calculation_status is null
      or new.tax_calculation_status in ('complete', 'ignored') then
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
