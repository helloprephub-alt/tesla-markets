drop policy if exists "Public can read visitor presence keys" on public.site_presence;
create or replace function public.record_site_presence(p_visitor_id text,p_page text) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_visitor_id is null or length(p_visitor_id)>100 or p_page is null or length(p_page)>120 then raise exception 'Invalid presence payload'; end if;
 insert into public.site_presence(visitor_id,page,last_seen_at) values(p_visitor_id,p_page,now()) on conflict(visitor_id) do update set page=excluded.page,last_seen_at=excluded.last_seen_at;
end;
$$;
revoke all on function public.record_site_presence(text,text) from public;
grant execute on function public.record_site_presence(text,text) to anon,authenticated;
