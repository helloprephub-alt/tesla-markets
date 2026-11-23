-- Prevent an in-flight AI response from being inserted after management has
-- taken over a conversation. The row lock serializes this check with the
-- responder_paused update performed by the AdminInbox.
CREATE OR REPLACE FUNCTION public.block_ai_reply_during_human_takeover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_responder_paused boolean;
BEGIN
  IF NEW.sender_role <> 'management'
     OR NEW.automated_type IS NULL
     OR NEW.automated_type NOT IN ('ai_response', 'automated_reply')
     OR COALESCE(NEW.message_type, 'text') IN ('payment_receipt', 'payment_pending') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(responder_paused, false)
    INTO v_responder_paused
    FROM public.support_conversations
   WHERE id = NEW.conversation_id
   FOR UPDATE;

  IF COALESCE(v_responder_paused, false) THEN
    RAISE EXCEPTION 'ai_reply_blocked_by_human_takeover'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS block_ai_reply_during_human_takeover
ON public.support_messages;

CREATE TRIGGER block_ai_reply_during_human_takeover
BEFORE INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.block_ai_reply_during_human_takeover();
