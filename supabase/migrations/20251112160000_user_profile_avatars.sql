-- Migration: User profile enhancements (avatars bucket + preferences JSON)
-- Adds storage bucket for user avatars and a JSONB preferences column on profiles

begin;

-- 1) Add preferences column to profiles (idempotent)
alter table if exists public.profiles
  add column if not exists preferences jsonb;

-- 2) Create storage bucket for avatars (public)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3) Storage policies for avatars bucket (idempotent via policy existence checks)
do $$
begin
  -- View policy: any authenticated user can view avatars
  if not exists (
    select 1 from pg_policy p join pg_class c on p.polrelid = c.oid
    where c.relname = 'objects' and p.polname = 'view_avatars'
  ) then
    create policy view_avatars
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;

  -- Insert policy: users can upload to their own folder (prefix = auth.uid())
  if not exists (
    select 1 from pg_policy p join pg_class c on p.polrelid = c.oid
    where c.relname = 'objects' and p.polname = 'insert_own_avatar'
  ) then
    create policy insert_own_avatar
      on storage.objects for insert
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Update policy: users can update their own avatar objects
  if not exists (
    select 1 from pg_policy p join pg_class c on p.polrelid = c.oid
    where c.relname = 'objects' and p.polname = 'update_own_avatar'
  ) then
    create policy update_own_avatar
      on storage.objects for update
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Delete policy: users can delete their own avatar objects
  if not exists (
    select 1 from pg_policy p join pg_class c on p.polrelid = c.oid
    where c.relname = 'objects' and p.polname = 'delete_own_avatar'
  ) then
    create policy delete_own_avatar
      on storage.objects for delete
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

commit;