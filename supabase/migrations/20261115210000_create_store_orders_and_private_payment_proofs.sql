create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  customer_email text not null check (customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  customer_phone text not null check (length(trim(customer_phone)) between 5 and 40),
  delivery_address text not null check (length(trim(delivery_address)) between 3 and 240),
  delivery_city text not null check (length(trim(delivery_city)) between 1 and 120),
  delivery_postal_code text,
  delivery_country text not null check (length(trim(delivery_country)) between 2 and 100),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal numeric(12,2) not null check (subtotal > 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'awaiting_payment'
    check (status in ('saved_for_later','awaiting_payment','proof_submitted','payment_proof_rejected','proof_approved_pending_settlement','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_orders_items_nonempty check (jsonb_array_length(items) between 1 and 49)
);

create table if not exists public.store_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  payment_method text not null check (payment_method in ('apple_gift_card','amazon_gift_card','visa_gift_card')),
  proof_storage_path text not null,
  status text not null default 'pending'
    check (status in ('pending','approved_pending_settlement','rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint store_payment_proof_path_matches_order check (proof_storage_path like order_id::text || '/%')
);

alter table public.store_orders enable row level security;
alter table public.store_payment_submissions enable row level security;

revoke all on public.store_orders from public;
revoke all on public.store_payment_submissions from public;
grant insert on public.store_orders to anon, authenticated;
grant select, update on public.store_orders to authenticated;
grant insert on public.store_payment_submissions to anon, authenticated;
grant select, update on public.store_payment_submissions to authenticated;

drop policy if exists "Guests submit shop orders" on public.store_orders;
create policy "Guests submit shop orders"
on public.store_orders
for insert
to anon, authenticated
with check (
  status in ('saved_for_later','awaiting_payment')
  and length(trim(customer_name)) between 1 and 120
  and customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  and jsonb_typeof(items) = 'array'
  and jsonb_array_length(items) between 1 and 49
);

drop policy if exists "Tesla admins read shop orders" on public.store_orders;
create policy "Tesla admins read shop orders"
on public.store_orders
for select
to authenticated
using (public.is_tesla_admin());

drop policy if exists "Tesla admins update shop orders" on public.store_orders;
create policy "Tesla admins update shop orders"
on public.store_orders
for update
to authenticated
using (public.is_tesla_admin())
with check (public.is_tesla_admin());

drop policy if exists "Guests submit shop payment proof metadata" on public.store_payment_submissions;
create policy "Guests submit shop payment proof metadata"
on public.store_payment_submissions
for insert
to anon, authenticated
with check (
  status = 'pending'
  and payment_method in ('apple_gift_card','amazon_gift_card','visa_gift_card')
  and proof_storage_path like order_id::text || '/%'
);

drop policy if exists "Tesla admins read shop payment proof metadata" on public.store_payment_submissions;
create policy "Tesla admins read shop payment proof metadata"
on public.store_payment_submissions
for select
to authenticated
using (public.is_tesla_admin());

drop policy if exists "Tesla admins review shop payment proof metadata" on public.store_payment_submissions;
create policy "Tesla admins review shop payment proof metadata"
on public.store_payment_submissions
for update
to authenticated
using (public.is_tesla_admin())
with check (public.is_tesla_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-payment-proofs','shop-payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Guests upload private shop payment proofs" on storage.objects;
create policy "Guests upload private shop payment proofs"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'shop-payment-proofs'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

drop policy if exists "Tesla admins read private shop payment proofs" on storage.objects;
create policy "Tesla admins read private shop payment proofs"
on storage.objects
for select
to authenticated
using (bucket_id = 'shop-payment-proofs' and public.is_tesla_admin());
