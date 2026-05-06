-- ============================================================================
-- Phase 2A: real Vietnamese e-invoice import
--
-- The real "Báo cáo bán hàng chi tiết" Excel exports include columns that the
-- Phase 1 schema did not capture: invoice template/series, tax-authority code,
-- invoice/payment status, separate sales-vs-VAT amounts, etc. One e-invoice can
-- contain many product rows (multi-line), so we need TWO identifiers:
--
--   * invoice_key       — groups all product rows under the same e-invoice
--                         (hash of store_id + invoice_series + invoice_no +
--                          tax_authority_code)
--   * transaction_hash  — uniquely identifies one product line within an
--                         invoice (already on the table, but the Phase 2A
--                         importer recomputes it from the new fields)
--
-- This migration:
--   * adds the new e-invoice columns on `sales_transactions`
--   * adds aggregate metrics on `import_files` (period_start/end, totals,
--     unique invoice count) so /import can show reconciliation numbers
--   * creates indexes on (store_id, invoice_key) and on the new e-invoice
--     status columns to support the upcoming reconciliation views
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sales_transactions: e-invoice fields
-- ---------------------------------------------------------------------------
alter table public.sales_transactions
  add column if not exists invoice_template_code text,
  add column if not exists invoice_series text,
  add column if not exists invoice_key text,
  add column if not exists invoice_date timestamptz,
  add column if not exists product_code text,
  add column if not exists unit text,
  add column if not exists currency text,
  add column if not exists currency_rate numeric(14,4),
  add column if not exists sales_amount_before_tax numeric(18,2),
  add column if not exists vat_output_amount_from_invoice numeric(18,2),
  add column if not exists payment_method text,
  add column if not exists payment_status text,
  add column if not exists invoice_status text,
  add column if not exists tax_authority_status text,
  add column if not exists tax_authority_code text,
  add column if not exists customer_tax_code text,
  add column if not exists customer_address text,
  add column if not exists source_stt int,
  add column if not exists source_row_number int;

create index if not exists idx_sales_transactions_invoice_key
  on public.sales_transactions(store_id, invoice_key);
create index if not exists idx_sales_transactions_tax_authority_code
  on public.sales_transactions(tax_authority_code);
create index if not exists idx_sales_transactions_invoice_status
  on public.sales_transactions(invoice_status);
create index if not exists idx_sales_transactions_payment_status
  on public.sales_transactions(payment_status);

-- ---------------------------------------------------------------------------
-- import_files: aggregate counters and period bounds
-- ---------------------------------------------------------------------------
alter table public.import_files
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists transaction_line_count int not null default 0,
  add column if not exists unique_invoice_count int not null default 0,
  add column if not exists total_amount numeric(18,2) not null default 0;
