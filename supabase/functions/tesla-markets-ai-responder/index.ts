import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = (origin: string | null) => {
  const allowed = origin === "https://tesla-markets.vercel.app" ||
    origin === "https://tesla-markets-tesla-5c9c.vercel.app" ||
    !!origin && /^https:\/\/tesla-markets(?:-[a-z0-9-]+)?-tesla-5c9c\.vercel\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://tesla-markets.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
};

const json = (body: unknown, status: number, headers: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

const cleanString = (value: unknown, max = 300) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function outputText(payload: any): string {
  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

function detectDiscountRequest(text: string) {
  const mentionsDiscount = /(discount|cheaper|reduce.{0,20}price|lower.{0,20}price|negotiate|price.{0,15}off|off the price)/i.test(text);
  const percent = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i);
  return {
    mentionsDiscount,
    requestedPercent: percent ? Number(percent[1]) : null,
    aboveLimit: Boolean(percent && Number(percent[1]) > 3),
  };
}

function matchVehicle(text: string, conversationModel: string, catalogue: any[]) {
  const haystack = (conversationModel + " " + text).toLowerCase();
  return catalogue.find((vehicle) =>
    [vehicle.name, vehicle.model, vehicle.slug].filter(Boolean)
      .some((value: string) => haystack.includes(String(value).toLowerCase()))
  ) || null;
}

function buildDiscountReply(vehicle: any, aboveLimit: boolean) {
  const name = vehicle?.name || vehicle?.model || "your selected vehicle";
  if (vehicle?.price_usd !== null && vehicle?.price_usd !== undefined && Number(vehicle.price_usd) > 0) {
    const original = Number(vehicle.price_usd);
    const discounted = Math.round(original * 0.97 * 100) / 100;
    const money = (value: number) => new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 2,
    }).format(value);
    const extra = aboveLimit
      ? " I have also referred your request for any additional discount to our management team for review."
      : "";
    return {
      reply: `Thank you for your interest in the ${name}. This published listing qualifies for our standard 3% automatic discount. The listed price is ${money(original)}, and the discounted vehicle price is ${money(discounted)} before taxes, fees and delivery.${extra} Would you like assistance with the next steps?`,
      requiresManagement: aboveLimit,
      intent: "discount",
    };
  }
  return {
    reply: aboveLimit
      ? "Thank you for sharing your preferred discount. Tesla Markets can automatically apply up to 3% on eligible published vehicle listings. I have referred your request for any additional discount to our management team for review. Please share the exact model and configuration so we can confirm the current published price."
      : "Thank you for considering Tesla Markets. Eligible published vehicle configurations may qualify for an automatic discount of up to 3%. Please share your preferred model and configuration so we can confirm the current published price and eligibility.",
    requiresManagement: aboveLimit,
    intent: "discount",
  };
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    intent: { type: "string" },
    requires_management: { type: "boolean" },
    delivery_details: {
      type: "object",
      additionalProperties: false,
      properties: {
        full_name: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        preferred_delivery_date: { type: ["string", "null"] },
        instructions: { type: ["string", "null"] },
      },
      required: ["full_name", "email", "phone", "country", "city", "address", "preferred_delivery_date", "instructions"],
    },
  },
  required: ["reply", "intent", "requires_management", "delivery_details"],
};

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

  let runMessageId = "";
  let admin: ReturnType<typeof createClient> | null = null;

  try {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401, headers);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (() => {
      const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
      try { return raw ? JSON.parse(raw).default : ""; } catch { return ""; }
    })();
    if (!supabaseUrl || !serviceKey) throw new Error("Server credentials are unavailable.");

    admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your secure chat session could not be verified." }, 401, headers);
    const user = authData.user;

    const body = await req.json();
    const conversationId = cleanString(body?.conversation_id, 80);
    const messageId = cleanString(body?.message_id, 80);
    if (!conversationId || !messageId) return json({ error: "A conversation and message are required." }, 400, headers);
    runMessageId = messageId;

    const { data: conversation, error: conversationError } = await admin
      .from("support_conversations")
      .select("id,customer_id,status,responder_paused,vehicle_model,visitor_email,contact_phone,delivery_details")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation || conversation.customer_id !== user.id) return json({ error: "Conversation not found." }, 404, headers);
    if (conversation.responder_paused || conversation.status === "closed") {
      return json({ ok: true, skipped: true, reason: "management_takeover_or_closed" }, 200, headers);
    }

    const { data: customerMessage, error: messageError } = await admin
      .from("support_messages")
      .select("id,conversation_id,sender_id,sender_role,body,created_at")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!customerMessage || customerMessage.sender_id !== user.id || customerMessage.sender_role !== "customer") {
      return json({ error: "Customer message not found." }, 404, headers);
    }
    if (!cleanString(customerMessage.body, 4000)) return json({ ok: true, skipped: true, reason: "attachment_only" }, 200, headers);

    const { data: settingsRow, error: settingsError } = await admin
      .from("site_settings").select("value").eq("key", "ai_responder_settings").maybeSingle();
    if (settingsError) throw settingsError;
    const settings = settingsRow?.value || {};
    if (settings.llm_enabled !== true) return json({ ok: true, enabled: false }, 200, headers);

    const { data: existingRun, error: runReadError } = await admin
      .from("ai_responder_runs").select("status,updated_at")
      .eq("message_id", messageId).maybeSingle();
    if (runReadError) throw runReadError;
    if (existingRun?.status === "completed") return json({ ok: true, duplicate: true }, 200, headers);
    if (existingRun?.status === "processing" && Date.now() - new Date(existingRun.updated_at).getTime() < 120000) {
      return json({ ok: true, processing: true }, 200, headers);
    }

    const runWrite = existingRun
      ? await admin.from("ai_responder_runs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("message_id", messageId)
      : await admin.from("ai_responder_runs").insert({ message_id: messageId, conversation_id: conversationId, status: "processing" });
    if (runWrite.error) {
      const { data: claimed } = await admin.from("ai_responder_runs").select("status").eq("message_id", messageId).maybeSingle();
      if (claimed?.status === "completed" || claimed?.status === "processing") return json({ ok: true, duplicate: true }, 200, headers);
      throw runWrite.error;
    }

    const { data: managementProfile, error: managementError } = await admin
      .from("customer_profiles").select("id").eq("is_admin", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (managementError) throw managementError;
    if (!managementProfile?.id) throw new Error("No authorised management sender is configured.");

    const { data: historyRows, error: historyError } = await admin
      .from("support_messages")
      .select("id,sender_role,body,created_at,automated_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(14);
    if (historyError) throw historyError;
    const history = (historyRows || []).reverse();

    const { data: managementReplies, error: managementRepliesError } = await admin
      .from("support_messages")
      .select("id,automated_type")
      .eq("conversation_id", conversationId)
      .eq("sender_role", "management")
      .gt("created_at", customerMessage.created_at)
      .limit(10);
    if (managementRepliesError) throw managementRepliesError;
    if ((managementReplies || []).some((row: any) => row.automated_type === null || row.automated_type === "ai_response")) {
      await admin.from("ai_responder_runs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("message_id", messageId);
      return json({ ok: true, skipped: true, reason: "management_already_replied" }, 200, headers);
    }

    const { data: catalogue, error: catalogueError } = await admin
      .from("vehicle_catalog")
      .select("name,model,slug,description,price_usd,availability,specifications")
      .eq("is_published", true);
    if (catalogueError) throw catalogueError;

    const discount = detectDiscountRequest(customerMessage.body);
    const vehicle = matchVehicle(customerMessage.body, conversation.vehicle_model || "", catalogue || []);
    let reply = "";
    let intent = "general";
    let requiresManagement = false;
    let extractedDelivery: Record<string, string> = {};

    if (discount.mentionsDiscount) {
      const result = buildDiscountReply(vehicle, discount.aboveLimit);
      reply = result.reply;
      intent = result.intent;
      requiresManagement = result.requiresManagement;
    } else {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        reply = "Thank you for contacting Tesla Markets. Your message has been received, and our management team will review it and assist you with accurate information shortly.";
        intent = "management_review";
        requiresManagement = true;
      } else {
        const model = Deno.env.get("OPENAI_MODEL") || "gpt-6-luna";
        const vehicleFacts = (catalogue || []).map((item: any) => ({
          name: item.name, model: item.model, description: item.description,
          price_usd: item.price_usd, availability: item.availability, specifications: item.specifications,
        }));
        const instructions = `You are the premium customer-relations assistant for Tesla Markets. Write in a polished, positive, courteous, concise corporate voice. The customer-facing chat is branded Tesla Markets Management, but you are an automated assistant: never claim a human is typing or has personally reviewed something. If asked directly, disclose that you are Tesla Markets' automated assistant supporting the management team.

Reply in the customer's language automatically. Be welcoming and commercially helpful without pressure. Use "we" and "our team" naturally. Never invent vehicle models, prices, specifications, availability, shipping costs, delivery dates, payments, approvals, investment performance or business relationships. Vehicle information must come only from the published catalogue facts below. If a fact is missing, say the team will confirm it.

Discount policy: automatic discount is capped at 3% and only applies to eligible published vehicle listings with a verified price. Do not promise more than 3%. Requests above 3% need management review and approval. Never imply a discount is approved unless the verified listing and policy allow it.

Investment policy: never promise guaranteed profits, fixed returns, risk-free gains, or invented portfolio performance. Explain that investments can lose value. Do not claim Tesla, Inc. endorses Tesla Markets or that Tesla Markets is an official Tesla website. Investment-specific or regulated advice must be referred to management.

Purchase and delivery: collect full name, email, phone, country, city and delivery address progressively when relevant. Do not ask for all details at once unless the customer is ready to order. Never say an order, payment or delivery is confirmed without verified records. Do not request passwords, full card numbers or security codes.

Escalate complaints, requests for a human, legal or financial advice, payment disputes, fraud concerns, unverified facts and any matter you cannot answer confidently. Keep the reply natural and generally under 120 words.

Published vehicle catalogue facts (empty means no current public listing is verified):
${JSON.stringify(vehicleFacts)}`;

        const input = history.map((item: any) => ({
          role: item.sender_role === "customer" ? "user" : "assistant",
          content: item.body || "[Customer shared an attachment]",
        }));

        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            instructions,
            input,
            store: false,
            max_output_tokens: 650,
            temperature: 0.35,
            text: { format: { type: "json_schema", name: "tesla_markets_customer_reply", strict: true, schema: responseSchema } },
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error("OpenAI response error", response.status, detail.slice(0, 500));
          reply = "Thank you for contacting Tesla Markets. Your message has been received, and our management team will review it and assist you with accurate information shortly.";
          intent = "management_review";
          requiresManagement = true;
        } else {
          const payload = await response.json();
          const raw = outputText(payload);
          try {
            const parsed = JSON.parse(raw);
            reply = cleanString(parsed.reply, 1400);
            intent = cleanString(parsed.intent, 80) || "general";
            requiresManagement = parsed.requires_management === true;
            const candidate = parsed.delivery_details || {};
            for (const key of ["full_name", "email", "phone", "country", "city", "address", "preferred_delivery_date", "instructions"]) {
              const value = cleanString(candidate[key], 300);
              if (value) extractedDelivery[key] = value;
            }
          } catch {
            reply = cleanString(raw, 1400);
            intent = "general";
            requiresManagement = true;
          }
          if (!reply) {
            reply = "Thank you for your enquiry. Our management team will review the details and assist you shortly.";
            intent = "management_review";
            requiresManagement = true;
          }
        }
      }
    }

    if (Object.keys(extractedDelivery).length) {
      const current = conversation.delivery_details && typeof conversation.delivery_details === "object"
        ? conversation.delivery_details : {};
      const merged = { ...current, ...extractedDelivery };
      const { error: deliveryError } = await admin.from("support_conversations")
        .update({ delivery_details: merged, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
      if (deliveryError) throw deliveryError;
    }

    const { data: responseMessage, error: responseInsertError } = await admin
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: managementProfile.id,
        sender_role: "management",
        body: reply,
        automated_type: "ai_response",
      })
      .select("id").single();
    if (responseInsertError) throw responseInsertError;

    await admin.from("ai_responder_runs").update({
      status: "completed",
      response_message_id: responseMessage.id,
      updated_at: new Date().toISOString(),
    }).eq("message_id", messageId);

    await admin.from("admin_notifications").insert({
      type: "ai_response",
      title: "AI responder sent a reply",
      body: `Customer ${conversation.visitor_email || "website visitor"} · ${intent} · ${reply.slice(0, 150)}`.slice(0, 240),
      entity_type: "conversation",
      entity_id: conversationId,
      is_read: false,
    });

    if (requiresManagement || intent === "investment" || intent === "complaint" || intent === "human_handover" || discount.aboveLimit) {
      await admin.from("admin_notifications").insert({
        type: "ai_escalation",
        title: "AI enquiry requires management review",
        body: `Customer ${conversation.visitor_email || "website visitor"} · ${intent} · Please review the conversation.`.slice(0, 240),
        entity_type: "conversation",
        entity_id: conversationId,
        is_read: false,
      });
    }

    await admin.from("admin_audit_logs").insert({
      actor_id: null,
      action: "ai_response_sent",
      entity_type: "conversation",
      entity_id: conversationId,
      details: { message_id: messageId, response_message_id: responseMessage.id, intent, requires_management: requiresManagement },
    });

    return json({ ok: true, response_message_id: responseMessage.id, intent }, 200, headers);
  } catch (error) {
    console.error("tesla-markets-ai-responder:", error);
    if (admin && runMessageId) {
      await admin.from("ai_responder_runs").update({ status: "failed", updated_at: new Date().toISOString() }).eq("message_id", runMessageId);
    }
    return json({ error: "Tesla Markets could not complete the automated response. Management has been notified." }, 500, headers);
  }
});
