alter table public.store_orders
  add column if not exists customer_id uuid references public.customer_profiles(id) on delete restrict;

do $$
begin
  if exists (select 1 from public.store_orders where customer_id is null) then
    raise exception 'Existing store orders need customer ownership review before the auth gate can be enabled';
  end if;
end $$;

alter table public.store_orders alter column customer_id set not null;

revoke insert on table public.store_orders from anon;
revoke insert on table public.store_payment_submissions from anon;
grant insert on table public.store_orders to authenticated;
grant insert on table public.store_payment_submissions to authenticated;
grant select on table public.store_orders to authenticated;
grant select on table public.store_payment_submissions to authenticated;

drop policy if exists "Guests submit shop orders" on public.store_orders;
drop policy if exists "Customers read their own shop orders" on public.store_orders;
create policy "Authenticated customers create their own shop orders"
on public.store_orders for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and lower(customer_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and status in ('saved_for_later','awaiting_payment')
  and length(trim(customer_name)) between 1 and 120
  and customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  and jsonb_typeof(items) = 'array'
  and jsonb_array_length(items) between 1 and 49
);
create policy "Customers read their own shop orders"
on public.store_orders for select to authenticated
using (customer_id = (select auth.uid()));

drop policy if exists "Guests submit shop payment proof metadata" on public.store_payment_submissions;
drop policy if exists "Customers read their own payment proof metadata" on public.store_payment_submissions;
create policy "Customers submit proof for their own shop orders"
on public.store_payment_submissions for insert to authenticated
with check (
  status = 'pending'
  and payment_method in ('apple_gift_card','amazon_gift_card','visa_gift_card')
  and proof_storage_path like order_id::text || '/%'
  and exists (select 1 from public.store_orders o where o.id=order_id and o.customer_id=(select auth.uid()))
);
create policy "Customers read their own payment proof metadata"
on public.store_payment_submissions for select to authenticated
using (exists (select 1 from public.store_orders o where o.id=order_id and o.customer_id=(select auth.uid())));

drop policy if exists "Guests upload private shop payment proofs" on storage.objects;
create policy "Customers upload payment proof for their own shop orders"
on storage.objects for insert to authenticated
with check (
  bucket_id='shop-payment-proofs'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and lower(storage.extension(name)) in ('jpg','jpeg','webp','png')
  and exists (
    select 1 from public.store_orders o
    where o.id=((storage.foldername(name))[1])::uuid
      and o.customer_id=(select auth.uid())
      and o.status in ('awaiting_payment','proof_submitted','payment_proof_rejected')
  )
);
