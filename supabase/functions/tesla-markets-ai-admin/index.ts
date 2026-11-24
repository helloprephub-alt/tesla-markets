import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const text = (value: unknown, max = 5000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const allowed = (value: string, values: string[]) => values.includes(value);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return json({ error: "Admin service is not configured." }, 500);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Administrator sign-in is required." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  if (userError || !userResult.user) return json({ error: "Administrator session could not be verified." }, 401);

  const actor = userResult.user;
  const { data: profile, error: profileError } = await admin
    .from("customer_profiles").select("is_admin").eq("id", actor.id).maybeSingle();
  if (profileError) return json({ error: "Administrator permissions could not be checked." }, 500);
  if (profile?.is_admin !== true) return json({ error: "Administrator access required." }, 403);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const action = text(body.action, 60);

  try {
    if (action === "overview") {
      const tables = ["customer_profiles", "support_conversations", "ai_knowledge_documents", "ai_approval_requests", "ai_research_logs"];
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
        if (error) throw error;
        counts[table] = count || 0;
      }
      const { count: openCount, error: openError } = await admin.from("support_conversations").select("id", { count: "exact", head: true }).eq("status", "open");
      if (openError) throw openError;
      const { count: pendingCount, error: pendingError } = await admin.from("ai_approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      if (pendingError) throw pendingError;
      return json({ ok: true, counts: { ...counts, open_conversations: openCount || 0, pending_approvals: pendingCount || 0 } });
    }


    if (action === "list_vehicles") {
      const { data, error } = await admin.from("vehicle_catalog")
        .select("id,slug,name,model,category,description,price_usd,availability,featured,is_published,specifications,model_year,market,source_url,source_type,verification_status,last_verified_at,updated_at")
        .order("name", { ascending: true }).limit(100);
      if (error) throw error;
      return json({ ok: true, vehicles: data || [] });
    }

    if (action === "save_vehicle") {
      const id = text(body.id, 80);
      const name = text(body.name, 140);
      const model = text(body.model, 100);
      const slug = text(body.slug, 120).toLowerCase();
      const verification = text(body.verification_status || "unverified", 40);
      const sourceType = text(body.source_type || "management", 40);
      const price = body.price_usd === "" || body.price_usd === null || body.price_usd === undefined ? null : Number(body.price_usd);
      if (!name || !model || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ error: "Vehicle name, model and a valid lowercase slug are required." }, 400);
      if (price !== null && (!Number.isFinite(price) || price < 0)) return json({ error: "Vehicle price must be a valid non-negative USD amount." }, 400);
      if (!allowed(verification, ["verified_official","verified_independent","management_approved","unverified","outdated"])) return json({ error: "Invalid verification status." }, 400);
      if (!allowed(sourceType, ["management","tesla_official","government","independent","other"])) return json({ error: "Invalid source type." }, 400);
      const specs = body.specifications && typeof body.specifications === "object" && !Array.isArray(body.specifications) ? body.specifications : {};
      const publish = body.is_published === true && verification !== "unverified" && verification !== "outdated";
      const record = {
        slug, name, model, category: text(body.category || "vehicle", 50),
        description: text(body.description, 8000), price_usd: price,
        availability: text(body.availability || "unknown", 40),
        featured: body.featured === true, is_published: publish,
        specifications: specs, model_year: text(body.model_year, 40) || null,
        market: text(body.market, 80) || null, source_url: text(body.source_url, 1000) || null,
        source_type: sourceType, verification_status: verification,
        last_verified_at: verification === "verified_official" || verification === "verified_independent" ? new Date().toISOString() : null,
        approved_by: verification === "management_approved" || verification === "verified_official" || verification === "verified_independent" ? actor.id : null,
        updated_at: new Date().toISOString()
      };
      let result;
      if (id) {
        const { data, error } = await admin.from("vehicle_catalog").update(record).eq("id", id).select("id,slug,name,model,price_usd,availability,is_published,verification_status,updated_at").single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await admin.from("vehicle_catalog").insert({ ...record, created_by: actor.id }).select("id,slug,name,model,price_usd,availability,is_published,verification_status,updated_at").single();
        if (error) throw error;
        result = data;
      }
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: id ? "vehicle_catalog_updated" : "vehicle_catalog_created", entity_type: "vehicle", entity_id: result.id, details: { name, model, price_usd: price, verification_status: verification, is_published: publish } });
      return json({ ok: true, vehicle: result });
    }

    if (action === "list_knowledge") {
      const { data, error } = await admin.from("ai_knowledge_documents")
        .select("id,title,category,content,source_url,source_type,verification_status,market,model_year,approved,version,updated_at")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, documents: data || [] });
    }

    if (action === "save_knowledge") {
      const id = text(body.id, 80);
      const title = text(body.title, 180);
      const content = text(body.content, 25000);
      const category = text(body.category, 50);
      const sourceType = text(body.source_type || "management", 40);
      const verification = text(body.verification_status || "unverified", 40);
      if (!title || !content) return json({ error: "A title and document content are required." }, 400);
      if (!allowed(category, ["company_faq","vehicle_brochure","price_list","sales_procedure","delivery_policy","warranty","discount_policy","investment_information","customer_service","terms","other"])) return json({ error: "Invalid knowledge category." }, 400);
      if (!allowed(sourceType, ["management","tesla_official","government","independent","other"])) return json({ error: "Invalid source type." }, 400);
      if (!allowed(verification, ["verified_official","verified_independent","management_approved","unverified","outdated"])) return json({ error: "Invalid verification status." }, 400);
      const approved = body.approved === true && verification !== "unverified" && verification !== "outdated";
      const record = {
        title, content, category, source_url: text(body.source_url, 1000) || null,
        source_type: sourceType, verification_status: verification,
        market: text(body.market, 80) || null, model_year: text(body.model_year, 40) || null,
        approved, updated_by: actor.id, updated_at: new Date().toISOString()
      };
      let result;
      if (id) {
        const { data, error } = await admin.from("ai_knowledge_documents").update({ ...record, version: (Number(body.version) || 1) + 1 }).eq("id", id).select("id,title,category,verification_status,approved,version,updated_at").single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await admin.from("ai_knowledge_documents").insert({ ...record, created_by: actor.id }).select("id,title,category,verification_status,approved,version,updated_at").single();
        if (error) throw error;
        result = data;
      }
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: id ? "ai_knowledge_updated" : "ai_knowledge_created", entity_type: "ai_knowledge_document", entity_id: result.id, details: { title, category, verification_status: verification, approved } });
      return json({ ok: true, document: result });
    }

    if (action === "list_approvals") {
      const { data, error } = await admin.from("ai_approval_requests")
        .select("id,customer_id,conversation_id,order_id,approval_type,status,request_data,decision_note,requested_at,decided_at")
        .order("requested_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, approvals: data || [] });
    }

    if (action === "decide_approval") {
      const id = text(body.id, 80);
      const status = text(body.status, 20);
      const note = text(body.decision_note, 1200);
      if (!id || !allowed(status, ["approved","rejected"])) return json({ error: "A valid approval request and decision are required." }, 400);
      const { data, error } = await admin.from("ai_approval_requests")
        .update({ status, decision_note: note || null, decided_at: new Date().toISOString(), approved_by: actor.id })
        .eq("id", id).eq("status", "pending")
        .select("id,approval_type,status,decision_note,decided_at").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "This request is no longer pending. Refresh the approval queue." }, 409);
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: "ai_approval_" + status, entity_type: "ai_approval_request", entity_id: id, details: { decision_note: note } });
      return json({ ok: true, approval: data, commitment_executed: false });
    }

    if (action === "list_research") {
      const { data, error } = await admin.from("ai_research_logs")
        .select("id,customer_id,conversation_id,source_message_id,query,status,sources,findings,answer_summary,verified,model,error_message,retrieved_at,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, research: data || [] });
    }

    if (action === "list_followups") {
      const { data, error } = await admin.from("ai_follow_up_queue")
        .select("conversation_id,customer_id,automated_message_id,source_message_id,sent_message_id,due_at,sent_at,status,cancellation_reason,attempt_count,last_error,updated_at")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, followups: data || [] });
    }

    if (action === "list_customer_memory") {
      const [{ data: memories, error: memoryError }, { data: customers, error: customerError }] = await Promise.all([
        admin.from("ai_customer_memory").select("customer_id,memory,memory_enabled,follow_up_enabled,last_interaction_at,updated_at").order("updated_at", { ascending: false }).limit(100),
        admin.from("customer_profiles").select("id,display_name,email,phone").limit(500)
      ]);
      if (memoryError) throw memoryError;
      if (customerError) throw customerError;
      const profileMap = new Map((customers || []).map((item: any) => [item.id, item]));
      return json({ ok: true, memories: (memories || []).map((item: any) => ({ ...item, profile: profileMap.get(item.customer_id) || null })) });
    }

    if (action === "set_memory_preference") {
      const customerId = text(body.customer_id, 80);
      const enabled = body.enabled === true;
      if (!customerId) return json({ error: "Customer ID is required." }, 400);
      const { error } = await admin.from("ai_customer_memory").upsert({
        customer_id: customerId, memory_enabled: enabled,
        ...(enabled ? {} : { memory: {} }), updated_at: new Date().toISOString()
      }, { onConflict: "customer_id" });
      if (error) throw error;
      await admin.from("ai_customer_memory_events").insert({ customer_id: customerId, actor_id: actor.id, action: enabled ? "enabled" : "disabled", memory_keys: [], details: { changed_by_admin: true } });
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: enabled ? "customer_memory_enabled" : "customer_memory_disabled", entity_type: "customer", entity_id: customerId, details: {} });
      return json({ ok: true });
    }


    if (action === "list_customers") {
      const { data: customers, error } = await admin.from("customer_profiles")
        .select("id,display_name,email,phone,crm_stage,crm_stage_updated_at,created_at")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const { data: memories, error: memoryError } = await admin.from("ai_customer_memory")
        .select("customer_id,memory_enabled,follow_up_enabled,last_interaction_at");
      if (memoryError) throw memoryError;
      const memoryMap = new Map((memories || []).map((item:any) => [item.customer_id, item]));
      return json({ ok: true, customers: (customers || []).map((item:any) => ({ ...item, memory: memoryMap.get(item.id) || null })) });
    }

    if (action === "set_crm_stage") {
      const customerId = text(body.customer_id, 80);
      const stage = text(body.stage, 40);
      const stages = ["new_enquiry","researching","comparing_vehicles","purchase_interested","draft_order_created","awaiting_management","awaiting_customer","completed","opted_out"];
      if (!customerId || !allowed(stage, stages)) return json({ error: "A valid customer and CRM stage are required." }, 400);
      const { error } = await admin.from("customer_profiles").update({
        crm_stage: stage, crm_stage_updated_at: new Date().toISOString(), crm_stage_updated_by: actor.id
      }).eq("id", customerId);
      if (error) throw error;
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: "crm_stage_updated", entity_type: "customer", entity_id: customerId, details: { stage } });
      return json({ ok: true });
    }

    if (action === "list_customer_interactions") {
      const customerId = text(body.customer_id, 80);
      let query = admin.from("ai_customer_interactions")
        .select("id,customer_id,conversation_id,interaction_type,summary,metadata,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (customerId) query = query.eq("customer_id", customerId);
      const { data, error } = await query;
      if (error) throw error;
      return json({ ok: true, interactions: data || [] });
    }


    if (action === "set_followup_preference") {
      const customerId = text(body.customer_id, 80);
      const enabled = body.enabled === true;
      if (!customerId) return json({ error: "Customer ID is required." }, 400);
      const { error } = await admin.from("ai_customer_memory").upsert({
        customer_id: customerId,
        follow_up_enabled: enabled,
        follow_up_opted_out_at: enabled ? null : new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: "customer_id" });
      if (error) throw error;
      if (!enabled) {
        const { data: conversations, error: conversationsError } = await admin.from("support_conversations").select("id").eq("customer_id", customerId);
        if (conversationsError) throw conversationsError;
        const conversationIds = (conversations || []).map((item:any) => item.id);
        if (conversationIds.length) {
          const { error: queueError } = await admin.from("ai_follow_up_queue").update({
            due_at: null, status: "cancelled", cancelled_at: new Date().toISOString(),
            cancellation_reason: "management_opt_out", updated_at: new Date().toISOString()
          }).in("conversation_id", conversationIds).is("sent_at", null);
          if (queueError) throw queueError;
        }
      }
      await admin.from("ai_customer_memory_events").insert({ customer_id: customerId, actor_id: actor.id, action: "updated", memory_keys: ["follow_up_enabled"], details: { changed_by_admin: true, enabled } });
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: enabled ? "customer_followups_enabled" : "customer_followups_disabled", entity_type: "customer", entity_id: customerId, details: {} });
      return json({ ok: true });
    }

    if (action === "settings") {
      const { data, error } = await admin.from("site_settings").select("value").eq("key", "ai_responder_settings").maybeSingle();
      if (error) throw error;
      const value = data?.value || {};
      return json({ ok: true, settings: {
        llm_enabled: value.llm_enabled === true,
        follow_up_enabled: value.follow_up_enabled === true,
        follow_up_hours: 24,
        max_auto_discount_percent: Math.min(70, Math.max(25, Number(value.max_auto_discount_percent || 70))),
        personality: "premium",
        web_research_enabled: value.web_research_enabled === true,
        model: text(Deno.env.get("TESLA_PRIVATE_LLM_MODEL"),160) || "Private open-weight model not configured",
        private_model_configured: !!(Deno.env.get("TESLA_PRIVATE_LLM_ENDPOINT") && Deno.env.get("TESLA_PRIVATE_LLM_API_KEY") && Deno.env.get("TESLA_PRIVATE_LLM_MODEL"))
      }});
    }

    if (action === "update_settings") {
      const { data, error } = await admin.from("site_settings").select("value").eq("key", "ai_responder_settings").maybeSingle();
      if (error) throw error;
      const current = data?.value || {};
      const next = { ...current };
      if (typeof body.llm_enabled === "boolean") next.llm_enabled = body.llm_enabled;
      if (typeof body.follow_up_enabled === "boolean") next.follow_up_enabled = body.follow_up_enabled;
      next.follow_up_hours = 24;
      next.max_auto_discount_percent = 70;
      next.discount_mode = "database_approved";
      next.external_ai_api = false;
      const privateModelConfigured = !!(Deno.env.get("TESLA_PRIVATE_LLM_ENDPOINT") && Deno.env.get("TESLA_PRIVATE_LLM_API_KEY") && Deno.env.get("TESLA_PRIVATE_LLM_MODEL"));
      next.engine_mode = privateModelConfigured ? "private_open_weight" : "private_open_weight_pending";
      next.independent_engine_enabled = privateModelConfigured;
      const { error: updateError } = await admin.from("site_settings").update({ value: next }).eq("key", "ai_responder_settings");
      if (updateError) throw updateError;
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: "ai_settings_updated", entity_type: "ai_settings", entity_id: "ai_responder_settings", details: { llm_enabled: next.llm_enabled, follow_up_enabled: next.follow_up_enabled, follow_up_hours: 24 } });
      return json({ ok: true, settings: { llm_enabled: next.llm_enabled === true, follow_up_enabled: next.follow_up_enabled === true, follow_up_hours: 24, max_auto_discount_percent: 70, personality: "premium", web_research_enabled: next.web_research_enabled === true, model: text(Deno.env.get("TESLA_PRIVATE_LLM_MODEL"),160) || "Private open-weight model not configured", private_model_configured: privateModelConfigured }});
    }

    if (action === "test_ai") {
      const endpoint=text(Deno.env.get("TESLA_PRIVATE_LLM_ENDPOINT"),700),apiKey=text(Deno.env.get("TESLA_PRIVATE_LLM_API_KEY"),500),model=text(Deno.env.get("TESLA_PRIVATE_LLM_MODEL"),160);
      if(!endpoint||!apiKey||!model)return json({error:"Private model infrastructure is not configured. Provision the Tesla-controlled open-weight model server, then set TESLA_PRIVATE_LLM_ENDPOINT, TESLA_PRIVATE_LLM_API_KEY and TESLA_PRIVATE_LLM_MODEL as server-side Supabase secrets."},503);
      let target:URL;try{target=new URL(endpoint);if(target.protocol!=="https:")throw new Error("HTTPS required");}catch{return json({error:"Private model endpoint must be a valid HTTPS URL."},400);}
      const targetUrl=/\/v1\/chat\/completions\/?$/i.test(target.pathname)?target.toString():target.toString().replace(/\/+$/,"")+"/v1/chat/completions";
      const prompt=text(body.prompt||"A customer asked about Model Y and then said: what about its price? Resolve the follow-up using context without inventing catalogue facts.",700),started=Date.now();
      let response:Response;try{response=await fetch(targetUrl,{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model,messages:[
        {role:"system",content:"You are testing the Tesla Markets virtual assistant. Be natural, context-aware and factually careful. Do not invent prices, specifications or availability. Return a concise customer-facing answer."},
        {role:"user",content:prompt}
      ],max_tokens:300,temperature:0.2,stream:false}),signal:AbortSignal.timeout(25000)});}catch(error){console.error("Tesla private model admin test failed:",error);return json({error:"The private model endpoint could not be reached. Check the private server, network access and TLS certificate."},502);}
      if(!response.ok)return json({error:"Private model inference returned HTTP "+response.status+"."},502);
      const payload=await response.json(),reply=text(payload?.choices?.[0]?.message?.content,1800);
      if(!reply)return json({error:"The private model returned no assistant text."},502);
      const latencyMs=Date.now()-started;
      await admin.from("admin_audit_logs").insert({actor_id:actor.id,action:"ai_model_tested",entity_type:"ai_settings",entity_id:"tesla_private_open_weight",details:{model,latency_ms:latencyMs}});
      return json({ok:true,provider:"Tesla-controlled private inference",model,latency_ms:latencyMs,reply});
    }

    if (action === "set_research_enabled") {
      if (body.enabled === true && body.confirm_provider_billing !== true) return json({ error: "Confirm that a Cloudflare AI Gateway provider key or credits are configured before enabling live search." }, 400);
      const { data, error } = await admin.from("site_settings").select("value").eq("key", "ai_responder_settings").maybeSingle();
      if (error) throw error;
      const value = { ...(data?.value || {}), web_research_enabled: body.enabled === true };
      const { error: updateError } = await admin.from("site_settings").update({ value }).eq("key", "ai_responder_settings");
      if (updateError) throw updateError;
      await admin.from("admin_audit_logs").insert({ actor_id: actor.id, action: "ai_web_research_" + (body.enabled === true ? "enabled" : "disabled"), entity_type: "ai_settings", entity_id: "ai_responder_settings", details: { enabled: body.enabled === true } });
      return json({ ok: true, web_research_enabled: body.enabled === true });
    }

    return json({ error: "Unknown admin action." }, 400);
  } catch (error) {
    console.error("Tesla Markets AI admin action failed:", action, error);
    return json({ error: "The requested admin operation could not be completed." }, 500);
  }
});
