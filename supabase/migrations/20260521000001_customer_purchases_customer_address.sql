alter table public.customer_purchases
  add column if not exists customer_address text;

create index if not exists idx_customer_purchases_customer_address
  on public.customer_purchases(store_id, customer_address);
