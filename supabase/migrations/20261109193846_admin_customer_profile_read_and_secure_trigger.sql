create policy "Admins can read customer profiles" on public.customer_profiles for select to authenticated using (exists(select 1 from public.customer_profiles admin_profile where admin_profile.id=auth.uid() and admin_profile.is_admin=true));
revoke all on function public.touch_support_conversation_after_message() from public,anon,authenticated;
