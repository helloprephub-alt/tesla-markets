CREATE OR REPLACE FUNCTION public.prevent_duplicate_management_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_canonical text;
  v_source_text text;
  v_source_message_id uuid;
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

  -- Use the originating customer message id, not the new management message id.
  -- This blocks retries for one source message while allowing identical replies
  -- to distinct customer messages in the same conversation.
  v_source_text := nullif(trim(new.structured_data->>'source_message_id'),'');
  begin
    v_source_message_id := coalesce(v_source_text::uuid,new.id);
  exception when invalid_text_representation then
    v_source_message_id := new.id;
  end;
  v_hash := md5(new.conversation_id::text || ':' || v_source_message_id::text);

  insert into public.ai_sent_reply_registry(canonical_hash,canonical_text,source_message_id,conversation_id,first_sent_at)
  values(v_hash,v_canonical,v_source_message_id,new.conversation_id,coalesce(new.created_at,now()))
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