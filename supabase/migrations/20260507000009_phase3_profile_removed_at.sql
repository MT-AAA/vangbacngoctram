-- Phase 3 polish: support "Gỡ người dùng khỏi cửa hàng".
--
-- Adds two nullable columns to public.profiles to model a soft-removal:
--   removed_at  timestamptz   — when the admin removed the user from the store
--   removed_by  uuid          — which auth user performed the removal
--
-- We deliberately do NOT delete the auth.users row or the profiles row, so
-- historical references in import_files / sales_transactions / customer_purchases
-- / inventory_items / tax_reports / audit_logs remain intact.
--
-- The store-context helpers current_store_id() / current_user_role() are
-- redefined to ignore removed users, which transparently revokes the user's
-- access to every RLS-protected table without touching individual policies.

alter table public.profiles
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null;

create index if not exists idx_profiles_removed_at on public.profiles(removed_at);

create or replace function public.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id
  from public.profiles
  where id = auth.uid()
    and removed_at is null;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and removed_at is null;
$$;
