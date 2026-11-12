create table if not exists public.ai_conversation_memory (
  conversation_id uuid primary key references public.support_conversations(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  memory jsonb not null default '{}'::jsonb,
  last_customer_message_at timestamptz,
  last_ai_response_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ai_conversation_memory enable row level security;
revoke all on public.ai_conversation_memory from public, anon, authenticated;
grant all on public.ai_conversation_memory to service_role;
create index if not exists ai_conversation_memory_customer_idx on public.ai_conversation_memory(customer_id);
