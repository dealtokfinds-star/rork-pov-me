-- 021_storage_buckets.sql
-- Storage bucket policies for avatars (public), covers (public), kyc-documents (private).

-- Avatars bucket (public read, auth write)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "avatars_read_public" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_insert_auth" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "avatars_update_owner" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid() = owner);

-- Covers bucket (public read, auth write)
insert into storage.buckets (id, name, public) values ('covers', 'covers', true)
  on conflict (id) do nothing;

create policy "covers_read_public" on storage.objects for select
  using (bucket_id = 'covers');
create policy "covers_insert_auth" on storage.objects for insert
  with check (bucket_id = 'covers' and auth.role() = 'authenticated');
create policy "covers_update_owner" on storage.objects for update
  using (bucket_id = 'covers' and auth.uid() = owner);

-- KYC documents bucket (private — service-role write only, admin + self read)
insert into storage.buckets (id, name, public) values ('kyc-documents', 'kyc-documents', false)
  on conflict (id) do nothing;

create policy "kyc_docs_select_self" on storage.objects for select
  using (bucket_id = 'kyc-documents' and auth.uid() = owner);
create policy "kyc_docs_insert_self" on storage.objects for insert
  with check (bucket_id = 'kyc-documents' and auth.role() = 'authenticated');
