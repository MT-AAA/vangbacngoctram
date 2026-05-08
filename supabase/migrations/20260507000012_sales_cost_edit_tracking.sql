-- Track manual purchase-cost edits on sales transactions.
-- This is intentionally separate from tax_calculation_status so a row can show
-- both business state tags, e.g. "Đầy đủ" + "Đã chỉnh sửa".

alter table public.sales_transactions
  add column if not exists purchase_cost_edited_at timestamptz,
  add column if not exists purchase_cost_edited_by uuid references public.profiles(id) on delete set null,
  add column if not exists purchase_cost_edit_reason text;

create index if not exists idx_sales_transactions_cost_edited_at
  on public.sales_transactions(purchase_cost_edited_at desc)
  where purchase_cost_edited_at is not null;
