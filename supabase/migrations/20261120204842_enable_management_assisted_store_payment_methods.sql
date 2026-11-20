begin;

-- Additive fields: existing customer orders and proof records remain intact.
alter table public.store_orders
  add column if not exists payment_method text,
  add column if not exists payment_method_selected_at timestamptz,
  add column if not exists payment_verified_at timestamptz;

alter table public.store_orders
  drop constraint if exists store_orders_payment_method_check;

alter table public.store_orders
  add constraint store_orders_payment_method_check
  check (
    payment_method is null or payment_method = any (array[
      'paypal','zelle','apple_pay','chime',
      'amazon_gift_card','apple_gift_card','google_play_gift_card','razor_gold_gift_card'
    ]::text[])
  );

alter table public.store_orders
  drop constraint if exists store_orders_status_check;

alter table public.store_orders
  add constraint store_orders_status_check
  check (status = any (array[
    'saved_for_later','awaiting_payment','proof_submitted',
    'payment_proof_rejected','proof_approved_pending_settlement',
    'payment_verified','processing','shipped','delivered','completed','cancelled'
  ]::text[]));

-- Preserve the existing customer checks and additionally prevent a customer
-- from self-selecting a method or marking their own order as paid.
drop policy if exists "Authenticated customers create their own shop orders"
  on public.store_orders;

create policy "Authenticated customers create their own shop orders"
on public.store_orders
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and lower(customer_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and status = any (array['saved_for_later','awaiting_payment']::text[])
  and payment_method is null
  and payment_method_selected_at is null
  and payment_verified_at is null
  and length(trim(customer_name)) between 1 and 120
  and customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
  and jsonb_typeof(items) = 'array'
  and jsonb_array_length(items) between 1 and 49
);

-- Enforce payment verification in the database as well as the admin UI.
-- Existing legacy orders already in fulfilment are not retroactively blocked,
-- but new transitions into fulfilment require an explicit verified timestamp.
create or replace function public.enforce_store_order_payment_verification()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'payment_verified' and new.payment_verified_at is null then
      raise exception 'Payment must be verified before the order can be marked paid.';
    end if;
    if new.status = any (array['processing','shipped','delivered','completed']::text[])
       and new.payment_verified_at is null then
      raise exception 'Payment must be verified before fulfilment can begin.';
    end if;
  else
    if old.payment_verified_at is not null
       and new.payment_verified_at is null
       and new.status <> 'cancelled' then
      raise exception 'Payment verification cannot be cleared after it has been recorded.';
    end if;
    if new.status = 'payment_verified' and new.payment_verified_at is null then
      raise exception 'Payment must be verified before the order can be marked paid.';
    end if;
    if new.status = any (array['processing','shipped','delivered','completed']::text[])
       and new.payment_verified_at is null
       and old.status <> all (array['processing','shipped','delivered','completed']::text[]) then
      raise exception 'Payment must be verified before fulfilment can begin.';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_store_order_payment_verification() from public;
revoke all on function public.enforce_store_order_payment_verification() from anon;
grant execute on function public.enforce_store_order_payment_verification() to authenticated;

drop trigger if exists trg_store_order_payment_verification
  on public.store_orders;

create trigger trg_store_order_payment_verification
before insert or update of status, payment_verified_at
on public.store_orders
for each row
execute function public.enforce_store_order_payment_verification();

alter table public.store_payment_submissions
  add column if not exists provider_reference text,
  add column if not exists verified_at timestamptz;

alter table public.store_payment_submissions
  drop constraint if exists store_payment_submissions_provider_reference_length_check;

alter table public.store_payment_submissions
  add constraint store_payment_submissions_provider_reference_length_check
  check (provider_reference is null or length(provider_reference) <= 120);

alter table public.store_payment_submissions
  drop constraint if exists store_payment_submissions_payment_method_check;

alter table public.store_payment_submissions
  add constraint store_payment_submissions_payment_method_check
  check (payment_method = any (array[
    'paypal','zelle','apple_pay','chime',
    'amazon_gift_card','apple_gift_card','google_play_gift_card','razor_gold_gift_card'
  ]::text[]));

alter table public.store_payment_submissions
  drop constraint if exists store_payment_submissions_status_check;

alter table public.store_payment_submissions
  add constraint store_payment_submissions_status_check
  check (status = any (array[
    'pending','approved_pending_settlement','verified','rejected'
  ]::text[]));

-- This function exposes only an enabled/disabled boolean to the caller.
-- Recipient details remain protected by the admin-only site_settings policy.
create or replace function public.is_store_payment_method_enabled(p_method text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select case p_method
      when 'paypal' then
        coalesce(s.value -> 'PayPal' ->> 'enabled', 'false') = 'true'
        and (
          nullif(btrim(s.value -> 'PayPal' ->> 'email'), '') is not null
          or nullif(btrim(s.value -> 'PayPal' ->> 'username'), '') is not null
        )
      when 'zelle' then
        coalesce(s.value -> 'Zelle' ->> 'enabled', 'false') = 'true'
        and (
          nullif(btrim(s.value -> 'Zelle' ->> 'email'), '') is not null
          or nullif(btrim(s.value -> 'Zelle' ->> 'phone'), '') is not null
        )
      when 'apple_pay' then
        coalesce(s.value -> 'Apple Pay' ->> 'enabled', 'false') = 'true'
        and (
          nullif(btrim(s.value -> 'Apple Pay' ->> 'email'), '') is not null
          or nullif(btrim(s.value -> 'Apple Pay' ->> 'phone'), '') is not null
          or nullif(btrim(s.value -> 'Apple Pay' ->> 'username'), '') is not null
        )
      when 'chime' then
        coalesce(s.value -> 'Chime' ->> 'enabled', 'false') = 'true'
        and (
          nullif(btrim(s.value -> 'Chime' ->> 'username'), '') is not null
          or nullif(btrim(s.value -> 'Chime' ->> 'phone'), '') is not null
          or nullif(btrim(s.value -> 'Chime' ->> 'email'), '') is not null
        )
      when 'amazon_gift_card' then coalesce(s.value ->> 'giftCardEnabled', 'false') = 'true'
      when 'apple_gift_card' then coalesce(s.value ->> 'giftCardEnabled', 'false') = 'true'
      when 'google_play_gift_card' then coalesce(s.value ->> 'giftCardEnabled', 'false') = 'true'
      when 'razor_gold_gift_card' then coalesce(s.value ->> 'giftCardEnabled', 'false') = 'true'
      else false
    end
    from public.site_settings s
    where s.key = 'payment_account_details'
    limit 1
  ), false);
$function$;

revoke all on function public.is_store_payment_method_enabled(text) from public;
revoke all on function public.is_store_payment_method_enabled(text) from anon;
grant execute on function public.is_store_payment_method_enabled(text) to authenticated;

comment on function public.is_store_payment_method_enabled(text) is
  'Returns whether a shop payment method is enabled and has a recipient identifier; never returns recipient details.';

drop policy if exists "Customers submit proof for their own shop orders"
  on public.store_payment_submissions;

create policy "Customers submit proof for their own shop orders"
on public.store_payment_submissions
for insert
to authenticated
with check (
  status = 'pending'
  and public.is_store_payment_method_enabled(public.store_payment_submissions.payment_method)
  and public.store_payment_submissions.proof_storage_path
      like public.store_payment_submissions.order_id::text || '/%'
  and exists (
    select 1
    from public.store_orders o
    where o.id = public.store_payment_submissions.order_id
      and o.customer_id = auth.uid()
      and o.payment_method = public.store_payment_submissions.payment_method
      and o.status = any (array[
        'awaiting_payment','payment_proof_rejected','proof_submitted'
      ]::text[])
  )
);

comment on column public.store_orders.payment_method is
  'Customer-selected shop payment method, set by the owner-scoped payment instructions function.';
comment on column public.store_orders.payment_verified_at is
  'Timestamp when management independently confirmed the received payment.';

commit;
