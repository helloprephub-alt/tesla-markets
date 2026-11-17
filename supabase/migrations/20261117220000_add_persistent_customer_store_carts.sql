create table if not exists public.customer_store_carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint customer_store_carts_items_array check (jsonb_typeof(items) = 'array'),
  constraint customer_store_carts_items_limit check (jsonb_array_length(items) <= 100)
);
alter table public.customer_store_carts enable row level security;
revoke all on public.customer_store_carts from anon, public;
grant select, insert, update, delete on public.customer_store_carts to authenticated;
drop policy if exists "Customers manage their own saved store cart" on public.customer_store_carts;
create policy "Customers manage their own saved store cart"
on public.customer_store_carts for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
