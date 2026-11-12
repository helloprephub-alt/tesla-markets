-- Tesla Markets vehicle purchase cards, hosted checkout links, and per-message reply deduplication.

ALTER TABLE public.support_messages
  DROP CONSTRAINT IF EXISTS support_messages_message_type_check;

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_message_type_check
  CHECK (message_type = ANY (ARRAY[
    'text'::text,
    'vehicle_card'::text,
    'vehicle_comparison'::text,
    'investment_summary'::text,
    'customer_details'::text,
    'management_card'::text,
    'cart_summary'::text,
    'vehicle_purchase_prompt'::text,
    'proforma_invoice'::text,
    'payment_card'::text
  ]));

ALTER TABLE public.business_orders
  ADD COLUMN IF NOT EXISTS payment_url text;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_management_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_canonical text;
  v_hash text;
begin
  if new.sender_role <> 'management'
     or new.automated_type is null
     or new.automated_type not in ('ai_response','automated_reply')
     or nullif(trim(new.body),'') is null then
    return new;
  end if;

  v_canonical := trim(regexp_replace(lower(coalesce(new.body,'')), '[^[:alnum:]]+', ' ', 'g'));
  if v_canonical = '' then return new; end if;

  -- Scope duplicate prevention to the exact generated message, not all future
  -- customer messages in the same conversation. Repeated prompts are valid.
  v_hash := md5(v_canonical || ':' || new.id::text);

  insert into public.ai_sent_reply_registry(canonical_hash,canonical_text,source_message_id,conversation_id,first_sent_at)
  values(v_hash,v_canonical,new.id,new.conversation_id,coalesce(new.created_at,now()))
  on conflict (conversation_id,canonical_hash) do nothing;

  if not found then
    update public.ai_sent_reply_registry
       set blocked_attempts=blocked_attempts+1,last_blocked_at=now()
     where conversation_id=new.conversation_id and canonical_hash=v_hash;
    return null;
  end if;
  return new;
end;
$function$;
