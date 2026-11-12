-- Tesla Markets AI responder configuration and 24-hour follow-up scheduler.
-- The current keyword responder remains active until the LLM provider secret is configured.
create extension if not exists pg_cron;

alter table public.support_messages
  add column if not exists automated_type text;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_messages_automated_type_check'
      and conrelid = 'public.support_messages'::regclass
  ) then
    alter table public.support_messages
      add constraint support_messages_automated_type_check
      check (automated_type is null or automated_type in
        ('welcome', 'automated_reply', 'ai_response', 'follow_up'));
  end if;
end
$constraint$;

create table if not exists public.ai_follow_up_queue (
  conversation_id uuid primary key references public.support_conversations(id) on delete cascade,
  automated_message_id uuid references public.support_messages(id) on delete set null,
  due_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_follow_up_queue enable row level security;
revoke all on public.ai_follow_up_queue from anon, authenticated;

insert into public.site_settings(key, value, updated_at)
values (
  'ai_responder_settings',
  jsonb_build_object(
    'discount_mode', 'auto3',
    'max_auto_discount_percent', 3,
    'follow_up_enabled', true,
    'follow_up_hours', 24,
    'language_mode', 'auto',
    'personality', 'premium',
    'admin_notifications', 'all',
    'llm_enabled', false
  ),
  now()
)
on conflict (key) do update
set value = public.site_settings.value || excluded.value,
    updated_at = now();

-- Mark system-generated messages explicitly so a human takeover can cancel follow-ups.
do $patch$
declare
  function_sql text;
  old_rule text;
  new_rule text;
  old_welcome text;
  new_welcome text;
begin
  old_rule := $old$insert into public.support_messages(conversation_id,sender_id,sender_role,body)
  values(new.conversation_id,v_sender,'management',v_reply);$old$;
  new_rule := $new$insert into public.support_messages(conversation_id,sender_id,sender_role,body,automated_type)
  values(new.conversation_id,v_sender,'management',v_reply,'automated_reply');$new$;

  select pg_get_functiondef('public.tesla_markets_rule_responder()'::regprocedure)
    into function_sql;
  if position(old_rule in function_sql) = 0 then
    raise exception 'Could not locate the existing rule responder message insert.';
  end if;
  execute replace(function_sql, old_rule, new_rule);

  old_welcome := $old$insert into public.support_messages
    (conversation_id, sender_id, sender_role, body, created_at)
  values
    (new.id, new.customer_id, 'management', reply_text, now());$old$;
  new_welcome := $new$insert into public.support_messages
    (conversation_id, sender_id, sender_role, body, created_at, automated_type)
  values
    (new.id, new.customer_id, 'management', reply_text, now(), 'welcome');$new$;

  select pg_get_functiondef('public.tesla_markets_enquiry_autoreply()'::regprocedure)
    into function_sql;
  if position(old_welcome in function_sql) = 0 then
    raise exception 'Could not locate the existing enquiry welcome message insert.';
  end if;
  execute replace(function_sql, old_welcome, new_welcome);
end
$patch$;

create or replace function public.manage_tesla_markets_followup_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.sender_role = 'customer' then
    update public.ai_follow_up_queue
       set due_at = null,
           updated_at = now()
     where conversation_id = new.conversation_id;

  elsif new.sender_role = 'management' and new.automated_type in ('automated_reply', 'ai_response') then
    insert into public.ai_follow_up_queue
      (conversation_id, automated_message_id, due_at, sent_at, updated_at)
    values
      (new.conversation_id, new.id, new.created_at + interval '24 hours', null, now())
    on conflict (conversation_id) do update
      set automated_message_id = excluded.automated_message_id,
          due_at = excluded.due_at,
          sent_at = null,
          updated_at = now();

  elsif new.sender_role = 'management' and new.automated_type = 'follow_up' then
    update public.ai_follow_up_queue
       set due_at = null,
           sent_at = new.created_at,
           updated_at = now()
     where conversation_id = new.conversation_id;

  elsif new.sender_role = 'management' and new.automated_type is null then
    -- A human management reply takes over and cancels the pending automated follow-up.
    update public.ai_follow_up_queue
       set due_at = null,
           updated_at = now()
     where conversation_id = new.conversation_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_manage_tesla_markets_followup_queue on public.support_messages;
create trigger trg_manage_tesla_markets_followup_queue
after insert on public.support_messages
for each row
execute function public.manage_tesla_markets_followup_queue();

create or replace function public.process_tesla_markets_followups()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  queued record;
  management_id uuid;
  followup_id uuid;
  sent_count integer := 0;
begin
  select id into management_id
  from public.customer_profiles
  where is_admin = true
  order by created_at asc
  limit 1;

  if management_id is null then
    return 0;
  end if;

  for queued in
    select q.conversation_id, q.automated_message_id, c.visitor_email, c.status
    from public.ai_follow_up_queue q
    join public.support_conversations c on c.id = q.conversation_id
    join public.support_messages automated_message on automated_message.id = q.automated_message_id
    where q.due_at is not null
      and q.due_at <= now()
      and q.sent_at is null
      and c.status <> 'closed'
      and c.responder_paused = false
      and not exists (
        select 1 from public.support_messages customer_message
        where customer_message.conversation_id = q.conversation_id
          and customer_message.sender_role = 'customer'
          and customer_message.created_at > automated_message.created_at
      )
      and not exists (
        select 1 from public.support_messages human_message
        where human_message.conversation_id = q.conversation_id
          and human_message.sender_role = 'management'
          and human_message.automated_type is null
          and human_message.created_at > automated_message.created_at
      )
    order by q.due_at
    limit 100
    for update of q skip locked
  loop
    insert into public.support_messages
      (conversation_id, sender_id, sender_role, body, automated_type)
    values
      (queued.conversation_id, management_id, 'management',
       'Good day. We hope you are doing well. We are following up on your recent enquiry with Tesla Markets. Our management team remains available to assist with any questions or next steps whenever convenient for you.',
       'follow_up')
    returning id into followup_id;

    insert into public.admin_notifications
      (type, title, body, entity_type, entity_id, is_read, created_at)
    values
      ('ai_follow_up', '24-hour customer follow-up sent',
       left('A premium follow-up was sent to ' || coalesce(queued.visitor_email, 'a customer') || '.', 240),
       'conversation', queued.conversation_id::text, false, now());

    insert into public.admin_audit_logs
      (actor_id, action, entity_type, entity_id, details, created_at)
    values
      (null, 'ai_follow_up_sent', 'conversation', queued.conversation_id::text,
       jsonb_build_object('source_message_id', queued.automated_message_id, 'follow_up_message_id', followup_id),
       now());

    update public.ai_follow_up_queue
       set due_at = null,
           sent_at = now(),
           updated_at = now()
     where conversation_id = queued.conversation_id;

    sent_count := sent_count + 1;
  end loop;

  return sent_count;
end;
$function$;

-- These are trigger-only functions. Their EXECUTE privileges are not needed by API clients.
revoke execute on function public.notify_admins_of_customer_message() from public, anon, authenticated;
revoke execute on function public.tesla_markets_admin_message_notification() from public, anon, authenticated;
revoke execute on function public.tesla_markets_enquiry_autoreply() from public, anon, authenticated;
revoke execute on function public.tesla_markets_rule_responder() from public, anon, authenticated;
revoke execute on function public.manage_tesla_markets_followup_queue() from public, anon, authenticated;
revoke execute on function public.process_tesla_markets_followups() from public, anon, authenticated;

-- Run every five minutes; messages become eligible only after the full 24-hour wait.
select cron.unschedule(jobid)
from cron.job
where jobname = 'tesla-markets-ai-follow-ups';

select cron.schedule(
  'tesla-markets-ai-follow-ups',
  '*/5 * * * *',
  'select public.process_tesla_markets_followups();'
);
