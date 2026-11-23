-- One active draft/awaiting-payment order per exact vehicle selection in a conversation.
-- The RPC below serializes purchase submissions on the conversation row and reuses
-- an existing draft for the same model rather than creating one per chat message.
CREATE UNIQUE INDEX IF NOT EXISTS business_orders_active_vehicle_selection_uidx
ON public.business_orders (customer_id, conversation_id, item_type, item_description)
WHERE item_type = 'vehicle' AND status IN ('draft', 'awaiting_payment');

CREATE OR REPLACE FUNCTION public.create_or_update_vehicle_draft_order(
  p_conversation_id uuid,
  p_customer_id uuid,
  p_vehicle_model text,
  p_selected_variant text,
  p_amount numeric,
  p_original_amount numeric,
  p_discount_percent numeric,
  p_delivery_details jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid;
  v_order public.business_orders%rowtype;
  v_enquiry_id uuid;
  v_item_description text;
  v_config jsonb;
  v_created_new boolean := false;
  v_updated_draft boolean := false;
  v_reference text;
BEGIN
  IF p_conversation_id IS NULL OR p_customer_id IS NULL
     OR nullif(trim(coalesce(p_vehicle_model, '')), '') IS NULL
     OR nullif(trim(coalesce(p_selected_variant, '')), '') IS NULL
     OR p_amount IS NULL OR p_amount <= 0
     OR p_original_amount IS NULL OR p_original_amount <= 0
     OR jsonb_typeof(coalesce(p_delivery_details, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Vehicle order details are incomplete or invalid.';
  END IF;

  IF coalesce(p_discount_percent, 0) <> 0
     AND (p_discount_percent < 25 OR p_discount_percent > 70) THEN
    RAISE EXCEPTION 'The selected vehicle discount is outside the approved range.';
  END IF;

  SELECT customer_id
    INTO v_owner
    FROM public.support_conversations
   WHERE id = p_conversation_id
   FOR UPDATE;

  IF v_owner IS NULL OR v_owner <> p_customer_id THEN
    RAISE EXCEPTION 'This conversation is not available to this customer.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customer_profiles WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'The customer profile is not available.';
  END IF;

  v_item_description := trim(p_vehicle_model) || ' · ' || trim(p_selected_variant);
  v_config := jsonb_build_object(
    'selected_variant', trim(p_selected_variant),
    'selected_price_usd', p_amount,
    'original_price_usd', p_original_amount,
    'christmas_discount_percent', nullif(coalesce(p_discount_percent, 0), 0),
    'delivery_details', coalesce(p_delivery_details, '{}'::jsonb),
    'conversation_id', p_conversation_id
  );

  UPDATE public.support_conversations
     SET delivery_details = coalesce(delivery_details, '{}'::jsonb) || coalesce(p_delivery_details, '{}'::jsonb),
         visitor_email = coalesce(nullif(lower(trim(p_delivery_details->>'email')), ''), visitor_email),
         contact_phone = coalesce(nullif(trim(p_delivery_details->>'phone'), ''), contact_phone),
         vehicle_model = trim(p_vehicle_model),
         enquiry_type = 'vehicle_purchase',
         updated_at = now(),
         last_message_at = now()
   WHERE id = p_conversation_id;

  INSERT INTO public.customer_profiles (id, display_name, email, phone)
  VALUES (
    p_customer_id,
    nullif(trim(p_delivery_details->>'full_name'), ''),
    nullif(lower(trim(p_delivery_details->>'email')), ''),
    nullif(trim(p_delivery_details->>'phone'), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = coalesce(excluded.display_name, public.customer_profiles.display_name),
        email = coalesce(excluded.email, public.customer_profiles.email),
        phone = coalesce(excluded.phone, public.customer_profiles.phone),
        updated_at = now();

  -- Exact active selection: reuse it. Never mix a different model or variant.
  SELECT *
    INTO v_order
    FROM public.business_orders
   WHERE customer_id = p_customer_id
     AND conversation_id = p_conversation_id
     AND item_type = 'vehicle'
     AND item_description = v_item_description
     AND status IN ('draft', 'awaiting_payment')
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    v_enquiry_id := v_order.vehicle_enquiry_id;
    IF v_order.status = 'draft' THEN
      IF v_enquiry_id IS NULL THEN
        INSERT INTO public.vehicle_enquiries (
          customer_id, vehicle_model, configuration, customer_note, status
        ) VALUES (
          p_customer_id, trim(p_vehicle_model), v_config,
          'Customer submitted vehicle and delivery details through Tesla Markets chat. Management approval and final quotation required.',
          'new'
        ) RETURNING id INTO v_enquiry_id;
      ELSE
        UPDATE public.vehicle_enquiries
           SET vehicle_model = trim(p_vehicle_model),
               configuration = v_config,
               updated_at = now()
         WHERE id = v_enquiry_id
           AND customer_id = p_customer_id;
      END IF;

      UPDATE public.business_orders
         SET vehicle_enquiry_id = v_enquiry_id,
             agreed_amount = p_amount,
             updated_at = now()
       WHERE id = v_order.id
       RETURNING * INTO v_order;

      v_updated_draft := true;
    END IF;
  ELSE
    -- Reuse the latest draft for this same model if the customer changes variant.
    SELECT *
      INTO v_order
      FROM public.business_orders
     WHERE customer_id = p_customer_id
       AND conversation_id = p_conversation_id
       AND item_type = 'vehicle'
       AND status = 'draft'
       AND split_part(item_description, ' · ', 1) = trim(p_vehicle_model)
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;

    IF FOUND THEN
      v_enquiry_id := v_order.vehicle_enquiry_id;
      IF v_enquiry_id IS NULL THEN
        INSERT INTO public.vehicle_enquiries (
          customer_id, vehicle_model, configuration, customer_note, status
        ) VALUES (
          p_customer_id, trim(p_vehicle_model), v_config,
          'Customer submitted vehicle and delivery details through Tesla Markets chat. Management approval and final quotation required.',
          'new'
        ) RETURNING id INTO v_enquiry_id;
      ELSE
        UPDATE public.vehicle_enquiries
           SET vehicle_model = trim(p_vehicle_model),
               configuration = v_config,
               updated_at = now()
         WHERE id = v_enquiry_id
           AND customer_id = p_customer_id;
      END IF;

      UPDATE public.business_orders
         SET item_description = v_item_description,
             vehicle_enquiry_id = v_enquiry_id,
             agreed_amount = p_amount,
             updated_at = now()
       WHERE id = v_order.id
       RETURNING * INTO v_order;

      v_updated_draft := true;
    ELSE
      INSERT INTO public.vehicle_enquiries (
        customer_id, vehicle_model, configuration, customer_note, status
      ) VALUES (
        p_customer_id, trim(p_vehicle_model), v_config,
        'Customer submitted vehicle and delivery details through Tesla Markets chat. Management approval and final quotation required.',
        'new'
      ) RETURNING id INTO v_enquiry_id;

      v_reference := 'TM-PRO-' || to_char(now(), 'YYYYMMDD') || '-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

      INSERT INTO public.business_orders (
        order_reference, customer_id, conversation_id, vehicle_enquiry_id,
        item_type, item_description, currency, agreed_amount, status, internal_notes
      ) VALUES (
        v_reference, p_customer_id, p_conversation_id, v_enquiry_id,
        'vehicle', v_item_description, 'USD', p_amount, 'draft',
        'Draft vehicle order. Management must confirm availability, final quotation, taxes, delivery charges and approved payment method before requesting payment.'
      ) RETURNING * INTO v_order;

      v_created_new := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_reference', v_order.order_reference,
    'agreed_amount', v_order.agreed_amount,
    'item_description', v_order.item_description,
    'payment_url', v_order.payment_url,
    'status', v_order.status,
    'created_new', v_created_new,
    'updated_draft', v_updated_draft
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_or_update_vehicle_draft_order(
  uuid, uuid, text, text, numeric, numeric, numeric, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_or_update_vehicle_draft_order(
  uuid, uuid, text, text, numeric, numeric, numeric, jsonb
) TO service_role;
