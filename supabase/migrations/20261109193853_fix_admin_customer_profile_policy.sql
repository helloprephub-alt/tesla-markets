create or replace function public.is_tesla_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.customer_profiles where id=auth.uid() and is_admin=true);
$$;
revoke all on function public.is_tesla_admin() from public,anon;
grant execute on function public.is_tesla_admin() to authenticated;
drop policy if exists "Admins can read customer profiles" on public.customer_profiles;
create policy "Admins can read customer profiles" on public.customer_profiles for select to authenticated using (public.is_tesla_admin());
