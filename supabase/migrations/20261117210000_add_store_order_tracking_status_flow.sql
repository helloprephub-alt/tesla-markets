alter table public.store_orders
  drop constraint if exists store_orders_status_check;
alter table public.store_orders
  add constraint store_orders_status_check
  check (status in (
    'saved_for_later',
    'awaiting_payment',
    'proof_submitted',
    'payment_proof_rejected',
    'proof_approved_pending_settlement',
    'processing',
    'shipped',
    'delivered',
    'completed',
    'cancelled'
  ));

create or replace function public.mark_store_order_proof_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.store_orders
     set status = 'proof_submitted',
         updated_at = now()
   where id = new.order_id
     and status in ('awaiting_payment','proof_submitted');
  return new;
end;
$$;

revoke all on function public.mark_store_order_proof_submitted() from public, anon, authenticated;
drop trigger if exists store_order_proof_submitted_status on public.store_payment_submissions;
create trigger store_order_proof_submitted_status
after insert on public.store_payment_submissions
for each row execute function public.mark_store_order_proof_submitted();

drop policy if exists "Customers submit proof for their own shop orders" on public.store_payment_submissions;
create policy "Customers submit proof for their own shop orders"
on public.store_payment_submissions
for insert
to authenticated
with check (
  status = 'pending'
  and payment_method in ('apple_gift_card','amazon_gift_card','visa_gift_card','google_play_gift_card','razor_gold_gift_card')
  and proof_storage_path like order_id::text || '/%'
  and exists (
    select 1 from public.store_orders o
    where o.id = store_payment_submissions.order_id
      and o.customer_id = (select auth.uid())
  )
);
