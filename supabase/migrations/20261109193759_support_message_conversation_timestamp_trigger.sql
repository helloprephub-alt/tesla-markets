create or replace function public.touch_support_conversation_after_message() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.support_conversations set last_message_at=new.created_at,updated_at=new.created_at where id=new.conversation_id; return new; end;
$$;
revoke all on function public.touch_support_conversation_after_message() from public,anon,authenticated;
drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation after insert on public.support_messages for each row execute function public.touch_support_conversation_after_message();
