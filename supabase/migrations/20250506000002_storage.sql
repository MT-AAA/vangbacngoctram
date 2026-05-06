-- ============================================================================
-- Storage buckets for Excel imports + receipts
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('imports', 'imports', false, 50 * 1024 * 1024)  -- 50 MB
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('receipts', 'receipts', false, 20 * 1024 * 1024) -- 20 MB
on conflict (id) do nothing;

-- Authenticated users in the store may read/write their store's files.
-- Files are stored under a `<store_id>/...` prefix.
do $$
begin
  -- imports bucket
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_member_read'
  ) then
    create policy "imports_member_read"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'imports'
        and (storage.foldername(name))[1] = public.current_store_id()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_member_write'
  ) then
    create policy "imports_member_write"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'imports'
        and (storage.foldername(name))[1] = public.current_store_id()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_member_update'
  ) then
    create policy "imports_member_update"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'imports'
        and (storage.foldername(name))[1] = public.current_store_id()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_admin_delete'
  ) then
    create policy "imports_admin_delete"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'imports'
        and (storage.foldername(name))[1] = public.current_store_id()::text
        and public.current_user_role() = 'admin'
      );
  end if;

  -- receipts bucket
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'receipts_member_read'
  ) then
    create policy "receipts_member_read"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'receipts'
        and (storage.foldername(name))[1] = public.current_store_id()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'receipts_member_write'
  ) then
    create policy "receipts_member_write"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'receipts'
        and (storage.foldername(name))[1] = public.current_store_id()::text
      );
  end if;
end;
$$;
