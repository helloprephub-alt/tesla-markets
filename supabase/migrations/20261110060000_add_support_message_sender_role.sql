alter table public.support_messages
  add column if not exists sender_role text not null default 'customer';

alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('customer', 'management'));

drop policy if exists "message sender is owner or admin" on public.support_messages;

create policy "message sender is owner or admin"
on public.support_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_role = case
    when exists (
      select 1
      from public.customer_profiles p
      where p.id = (select auth.uid())
        and p.is_admin = true
    ) then 'management'
    else 'customer'
  end
  and exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and (
        c.customer_id = (select auth.uid())
        or exists (
          select 1
          from public.customer_profiles p
          where p.id = (select auth.uid())
            and p.is_admin = true
        )
      )
  )
);
