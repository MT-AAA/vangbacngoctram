-- ============================================================================
-- Phase 2C: manual customer purchases
--
-- The Phase 1 init schema already created `public.customer_purchases` with the
-- core columns (purchase_date, customer_name/phone/id_card, product_name,
-- weight, weight_unit, quantity, unit_price, total_amount, becomes_inventory,
-- inventory_item_id, notes). Phase 2C extends that table with:
--
--   * customer_tax_code         — VN tax code (MST). The existing
--                                 customer_id_card column covers CCCD/CMND;
--                                 a customer can have either or both.
--   * purity                    — gold/silver purity tag selected from a fixed
--                                 list (9999, 24K, 18K, 14K, 10K, 925, other).
--                                 Stored as plain text so future stores can add
--                                 their own values without a migration.
--   * unit                      — sale unit (e.g. "chỉ", "g", "cái"). Distinct
--                                 from weight_unit so a single piece of
--                                 jewelry sold by `cái` can still record its
--                                 weight in `chỉ`.
--   * is_tax_purchase_input     — flag controlling whether this purchase will
--                                 be included in the average-purchase-price
--                                 calculation used by the direct-method VAT
--                                 engine. Default TRUE; admins can untick for
--                                 personal trades, gifts, etc.
--   * image_url, attachment_url — optional links into the receipts bucket.
--
-- Also adds indexes that the new /customer-purchases listing + dashboard
-- queries need (customer name, product name search, tax-input flag).
-- ============================================================================

alter table public.customer_purchases
  add column if not exists customer_tax_code text,
  add column if not exists purity text,
  add column if not exists unit text,
  add column if not exists is_tax_purchase_input boolean not null default true,
  add column if not exists image_url text,
  add column if not exists attachment_url text;

create index if not exists idx_customer_purchases_customer_name
  on public.customer_purchases(store_id, customer_name);
create index if not exists idx_customer_purchases_product_name
  on public.customer_purchases(store_id, product_name);
create index if not exists idx_customer_purchases_tax_input
  on public.customer_purchases(store_id, is_tax_purchase_input);
