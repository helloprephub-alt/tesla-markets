create table if not exists public.translation_cache (
  cache_key text primary key,
  source_language text not null default 'en',
  target_language text not null,
  source_text_hash text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  constraint translation_cache_language_format
    check (target_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint translation_cache_text_nonempty
    check (length(btrim(translated_text)) > 0)
);

create index if not exists translation_cache_expiry_idx
  on public.translation_cache (expires_at);
alter table public.translation_cache enable row level security;
revoke all on public.translation_cache from anon, authenticated;
grant all on public.translation_cache to service_role;

create table if not exists public.translation_issues (
  id uuid primary key default gen_random_uuid(),
  target_language text not null,
  source_hash text,
  issue_type text not null,
  component text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint translation_issues_language_format
    check (target_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint translation_issues_type_check
    check (issue_type in (
      'provider_unavailable',
      'invalid_response',
      'missing_translation',
      'protected_token_mismatch',
      'cache_error',
      'unsupported_language',
      'rate_limited',
      'ambiguous_translation'
    ))
);

create index if not exists translation_issues_created_at_idx
  on public.translation_issues (created_at desc);
create index if not exists translation_issues_language_idx
  on public.translation_issues (target_language, created_at desc);

alter table public.translation_issues enable row level security;
revoke all on public.translation_issues from anon;
revoke insert, update, delete on public.translation_issues from authenticated;
grant select on public.translation_issues to authenticated;
grant all on public.translation_issues to service_role;

drop policy if exists "Tesla admins can read translation issues" on public.translation_issues;
create policy "Tesla admins can read translation issues"
  on public.translation_issues
  for select
  to authenticated
  using (public.is_tesla_admin());

create table if not exists public.translation_rate_limits (
  ip_hash text not null,
  bucket timestamptz not null,
  request_count integer not null default 0,
  primary key (ip_hash, bucket),
  constraint translation_rate_limits_count_nonnegative check (request_count >= 0)
);

create index if not exists translation_rate_limits_bucket_idx
  on public.translation_rate_limits (bucket);
alter table public.translation_rate_limits enable row level security;
revoke all on public.translation_rate_limits from anon, authenticated;
grant all on public.translation_rate_limits to service_role;

create or replace function public.consume_translation_rate_limit(
  p_ip_hash text,
  p_bucket timestamptz,
  p_limit integer default 20
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_count integer;
begin
  delete from public.translation_rate_limits where bucket < now() - interval '1 day';
  if p_ip_hash is null or length(p_ip_hash) <> 64 or p_limit < 1 or p_limit > 100 then
    return false;
  end if;
  insert into public.translation_rate_limits (ip_hash, bucket, request_count)
  values (p_ip_hash, p_bucket, 1)
  on conflict (ip_hash, bucket)
  do update set request_count = public.translation_rate_limits.request_count + 1
  returning request_count into current_count;
  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_translation_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_translation_rate_limit(text, timestamptz, integer) to service_role;
