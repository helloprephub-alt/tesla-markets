alter table public.customer_profiles
  add column if not exists preferred_language text not null default 'en';

alter table public.support_conversations
  add column if not exists preferred_language text not null default 'en';

update public.support_conversations c
set preferred_language = p.preferred_language
from public.customer_profiles p
where p.id = c.customer_id
  and c.preferred_language = 'en'
  and p.preferred_language <> 'en';

alter table public.customer_profiles
  drop constraint if exists customer_profiles_preferred_language_format;
alter table public.customer_profiles
  add constraint customer_profiles_preferred_language_format
  check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$');

alter table public.support_conversations
  drop constraint if exists support_conversations_preferred_language_format;
alter table public.support_conversations
  add constraint support_conversations_preferred_language_format
  check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$');

comment on column public.customer_profiles.preferred_language is
  'Customer-selected website and communications language (BCP-47-style locale).';
comment on column public.support_conversations.preferred_language is
  'Language used for the latest customer message and AI response in this conversation.';
