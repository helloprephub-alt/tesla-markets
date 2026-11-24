-- Persist vehicle configuration choices without sending another chat message.
-- Customers may update only their own conversation; pricing remains server-authoritative.
create or replace function public.save_vehicle_variant_selection(
  p_conversation_id uuid,
  p_vehicle_model text,
  p_selected_variant text,
  p_cart_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_conversation public.support_conversations%rowtype;
  v_memory jsonb;
begin
  if v_customer_id is null then
    raise exception 'A customer session is required.';
  end if;
  if nullif(trim(coalesce(p_vehicle_model, '')), '') is null
     or nullif(trim(coalesce(p_selected_variant, '')), '') is null then
    raise exception 'Choose a valid vehicle and version.';
  end if;
  if p_cart_items is not null and jsonb_typeof(p_cart_items) <> 'array' then
    raise exception 'Cart data must be a list.';
  end if;

  select * into v_conversation
    from public.support_conversations
   where id = p_conversation_id
     and customer_id = v_customer_id
   for update;

  if not found then
    raise exception 'This conversation is not available to this customer.';
  end if;

  update public.support_conversations
     set delivery_details = coalesce(delivery_details, '{}'::jsonb) ||
       jsonb_build_object(
         'selected_vehicle_model', trim(p_vehicle_model),
         'selected_variant', trim(p_selected_variant)
       ) ||
       case when p_cart_items is null then '{}'::jsonb
            else jsonb_build_object('cart_items', p_cart_items) end,
         vehicle_model = trim(p_vehicle_model),
         updated_at = now()
   where id = p_conversation_id;

  select coalesce(memory, '{}'::jsonb) into v_memory
    from public.ai_conversation_memory
   where conversation_id = p_conversation_id
   for update;

  v_memory := coalesce(v_memory, '{}'::jsonb) ||
    jsonb_build_object(
      'selected_vehicle', trim(p_vehicle_model),
      'selected_variant', trim(p_selected_variant),
      'last_intent', 'vehicle_configuration_selected'
    );
  if p_cart_items is not null then
    v_memory := v_memory || jsonb_build_object('cart_items', p_cart_items);
  end if;

  insert into public.ai_conversation_memory(conversation_id, customer_id, memory, updated_at)
  values (p_conversation_id, v_customer_id, v_memory, now())
  on conflict (conversation_id) do update
    set memory = excluded.memory, updated_at = now();

  return jsonb_build_object(
    'conversation_id', p_conversation_id,
    'vehicle_model', trim(p_vehicle_model),
    'selected_variant', trim(p_selected_variant),
    'saved', true
  );
end;
$function$;

revoke all on function public.save_vehicle_variant_selection(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_vehicle_variant_selection(uuid, text, text, jsonb) to authenticated;
