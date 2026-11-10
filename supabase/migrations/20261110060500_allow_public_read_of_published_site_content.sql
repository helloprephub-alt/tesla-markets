drop policy if exists "Site settings: public read published content" on public.site_settings;
create policy "Site settings: public read published content"
on public.site_settings
for select
to anon, authenticated
using (key in ('investment_gallery', 'public_site_content'));
