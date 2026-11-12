-- Catch every requested discount percentage above the approved 3% limit.
DO $patch$
DECLARE
  function_sql text;
  old_rule text := $old$v_text ~ '(4%|5%|6%|7%|8%|9%|10%|more than 3|above 3|over 3)'$old$;
  new_rule text := $new$v_text ~ '(3[.][1-9][0-9]*|[4-9]([.][0-9]+)?|[1-9][0-9]+([.][0-9]+)?)[[:space:]]*(%|percent)|more than 3|above 3|over 3'$new$;
BEGIN
  SELECT pg_get_functiondef('public.tesla_markets_rule_responder()'::regprocedure)
    INTO function_sql;
  IF position(old_rule in function_sql) = 0 THEN
    RAISE EXCEPTION 'Could not locate the previous discount threshold rule.';
  END IF;
  EXECUTE replace(function_sql, old_rule, new_rule);
END
$patch$;
