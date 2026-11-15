alter table public.store_orders
  drop constraint if exists store_orders_customer_email_check;
alter table public.store_orders
  add constraint store_orders_customer_email_check
  check (customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$');

drop policy if exists "Authenticated customers create their own shop orders" on public.store_orders;
create policy "Authenticated customers create their own shop orders"
on public.store_orders
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and lower(customer_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and status in ('saved_for_later','awaiting_payment')
  and length(trim(customer_name)) between 1 and 120
  and customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
  and jsonb_typeof(items) = 'array'
  and jsonb_array_length(items) between 1 and 49
);

create index if not exists store_orders_customer_id_idx
  on public.store_orders(customer_id);

revoke execute on function public.validate_store_order_pricing() from public, anon, authenticated;
revoke execute on function public.validate_and_mark_store_payment_proof() from public, anon, authenticated;
