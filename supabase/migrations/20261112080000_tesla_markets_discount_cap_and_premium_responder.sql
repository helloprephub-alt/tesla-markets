-- Tesla Markets AI responder: enforce the approved automatic discount ceiling.
-- The current published vehicle catalogue is the source of truth for prices.
DO $migration$
DECLARE
  function_sql text;
  old_text text := $old$v_reply := 'I can note a 5% discount request for management to review. Which vehicle configuration are you interested in?';$old$;
  new_text text := $new$
    if v_text ~ '(4%|5%|6%|7%|8%|9%|10%|more than 3|above 3|over 3)' then
      v_reply := 'Thank you for sharing your preferred discount. Tesla Markets can automatically apply up to 3% on eligible published vehicle listings. I can also forward any additional discount request to management for review. Which vehicle configuration are you considering?';
    else
      select case
        when price_usd is not null then
          '$' || to_char(price_usd, 'FM999,999,990.00') ||
          ' (3% offer price: $' || to_char(price_usd * 0.97, 'FM999,999,990.00') || ')'
        else null
      end
      into v_price
      from public.vehicle_catalog
      where is_published = true
        and (lower(name) = lower(v_model)
          or lower(model) = lower(v_model)
          or lower(slug) = lower(replace(v_model, ' ', '-')))
      order by updated_at desc
      limit 1;

      if v_price is not null then
        v_reply := 'Thank you for your interest in ' || v_model ||
          '. This published listing qualifies for the standard 3% automatic discount. ' ||
          'The current price and discounted price are ' || v_price ||
          '. Taxes, fees and delivery are not included. Would you like assistance with the next steps?';
      else
        v_reply := 'Thank you for considering Tesla Markets. Eligible vehicle configurations may qualify for an automatic discount of up to 3%. Please share your preferred model and configuration so we can confirm the current published price and eligibility. Any request above 3% can be referred to management for review.';
      end if;
    end if;
  $new$;
BEGIN
  SELECT pg_get_functiondef('public.tesla_markets_rule_responder()'::regprocedure)
    INTO function_sql;

  IF position(old_text in function_sql) = 0 THEN
    RAISE EXCEPTION 'Expected existing 5%% discount rule was not found; migration stopped without changing the responder.';
  END IF;

  function_sql := replace(function_sql, old_text, new_text);
  EXECUTE function_sql;
END
$migration$;
