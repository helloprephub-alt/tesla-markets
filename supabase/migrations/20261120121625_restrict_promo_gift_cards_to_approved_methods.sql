alter table public.store_payment_submissions
  drop constraint if exists store_payment_submissions_payment_method_check;

alter table public.store_payment_submissions
  add constraint store_payment_submissions_payment_method_check
  check (payment_method in (
    'amazon_gift_card',
    'apple_gift_card',
    'google_play_gift_card',
    'razor_gold_gift_card'
  ));
