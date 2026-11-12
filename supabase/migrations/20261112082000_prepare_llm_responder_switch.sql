-- Prepare the live responder for a safe switch from keyword replies to the LLM.
-- The existing responder remains active while llm_enabled=false.
create table if not exists public.ai_responder_runs (
  message_id uuid primary key references public.support_messages(id) on delete cascade,
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  response_message_id uuid references public.support_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_responder_runs enable row level security;
revoke all on public.ai_responder_runs from anon, authenticated;

create index if not exists ai_follow_up_queue_due_idx
  on public.ai_follow_up_queue(due_at)
  where due_at is not null;

do $patch$
declare
  function_sql text;
  old_decl text := $old$v_sender uuid;$old$;
  new_decl text := $new$v_sender uuid;
  v_llm_enabled boolean := false;$new$;
  old_gate text := $old$select * into v_conv from public.support_conversations where id = new.conversation_id;
  if not found or v_conv.responder_paused then return new; end if;$old$;
  new_gate text := $new$select * into v_conv from public.support_conversations where id = new.conversation_id;
  if not found or v_conv.responder_paused then return new; end if;

  select coalesce((value->>'llm_enabled')::boolean, false)
    into v_llm_enabled
    from public.site_settings
   where key = 'ai_responder_settings';

  if coalesce(v_llm_enabled, false) then
    return new;
  end if;$new$;
begin
  select pg_get_functiondef('public.tesla_markets_rule_responder()'::regprocedure)
    into function_sql;

  if position(old_decl in function_sql) = 0 then
    raise exception 'Could not locate rule responder variable declaration.';
  end if;
  function_sql := replace(function_sql, old_decl, new_decl);

  if position(old_gate in function_sql) = 0 then
    raise exception 'Could not locate rule responder pause gate.';
  end if;
  function_sql := replace(function_sql, old_gate, new_gate);

  execute function_sql;
end
$patch$;
