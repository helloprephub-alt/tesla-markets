alter table public.store_products
  drop constraint if exists store_products_discount_percent_check;

alter table public.store_products
  add constraint store_products_discount_percent_check
  check (discount_percent = 0 or discount_percent between 25 and 70);
