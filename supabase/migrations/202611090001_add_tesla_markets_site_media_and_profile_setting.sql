-- Dedicated public website media bucket. Public reads are intentional for
-- published site images; only authenticated Tesla Markets admins may mutate.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
)
on conflict (id) do nothing;

drop policy if exists "Tesla Markets media: public read" on storage.objects;
create policy "Tesla Markets media: public read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'site-media');

drop policy if exists "Tesla Markets media: admin upload" on storage.objects;
create policy "Tesla Markets media: admin upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-media'
  and exists (select 1 from public.customer_profiles p where p.id = (select auth.uid()) and p.is_admin = true)
);

drop policy if exists "Tesla Markets media: admin update" on storage.objects;
create policy "Tesla Markets media: admin update"
on storage.objects for update to authenticated
using (
  bucket_id = 'site-media'
  and exists (select 1 from public.customer_profiles p where p.id = (select auth.uid()) and p.is_admin = true)
)
with check (
  bucket_id = 'site-media'
  and exists (select 1 from public.customer_profiles p where p.id = (select auth.uid()) and p.is_admin = true)
);

drop policy if exists "Tesla Markets media: admin delete" on storage.objects;
create policy "Tesla Markets media: admin delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-media'
  and exists (select 1 from public.customer_profiles p where p.id = (select auth.uid()) and p.is_admin = true)
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.site_settings enable row level security;
drop policy if exists "Site settings: public read management profile" on public.site_settings;
create policy "Site settings: public read management profile"
on public.site_settings for select to anon, authenticated
using (key = 'management_profile');
drop policy if exists "Site settings: admin manage" on public.site_settings;
create policy "Site settings: admin manage"
on public.site_settings for all to authenticated
using (exists (select 1 from public.customer_profiles p where p.id = (select auth.uid()) and p.is_admin = true))
with check (exists (select 1 from public.customer_profiles p where p.id = (select auth.uid()) and p.is_admin = true));
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
