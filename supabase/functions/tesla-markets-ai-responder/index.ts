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

function detectDiscountRequest(text: string) {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mentionsDiscount = /\b(discount|cheaper|reduce.{0,25}price|lower.{0,25}price|negotiate|price.{0,15}off|rabais|reduction|remise|descuento|rebaja|rabatt|gunstiger)\b/i.test(t) || /\b\d+(?:[.,]\d+)?\s*%\s*off\b/i.test(t);
  const percent = t.match(/(\d+(?:[.,]\d+)?)\s*(?:%|percent|pourcent|por ciento|prozent)/i);
  const requestedPercent = percent ? Number(percent[1].replace(",", ".")) : null;
  return { mentionsDiscount, requestedPercent, aboveLimit: requestedPercent !== null && requestedPercent > 3 };
}
function canonicalVehicle(value: string) {
  const t = normalized(value).replace(/[^a-z0-9]+/g, " ").trim();
  if (/\bcyber ?truck\b/.test(t)) return "Cybertruck";
  if (/\broadster\b/.test(t)) return "Roadster";
  if (/\b(tesla )?semi\b/.test(t)) return "Tesla Semi";
  const model = t.match(/\bmodel ?([3ysx])\b/);
  if (model) return "Model " + model[1].toUpperCase();
  return "";
}
function matchVehicle(text: string, conversationModel: string, catalogue: any[]) {
  const selected = canonicalVehicle(text) || canonicalVehicle(conversationModel);
  if (!selected) return null;
  return catalogue.find((vehicle) => {
    const names = [vehicle.name, vehicle.model, vehicle.slug].filter(Boolean)
      .map((value: string) => canonicalVehicle(String(value)) || String(value).toLowerCase().replace(/-/g, " "));
    return names.some((value: string) => value.toLowerCase() === selected.toLowerCase());
  }) || null;
}


function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function languageOf(text: string): "en"|"fr"|"es"|"de" {
  const t=normalized(text);
  const scores=[
    ["fr", (t.match(/\b(bonjour|merci|voiture|vehicule|prix|reduction|livraison|investissement|paiement|combien|vous|nous|souhaite)\b/g)||[]).length],
    ["es", (t.match(/\b(hola|gracias|coche|vehiculo|precio|descuento|entrega|inversion|pago|cuanto|quiero|pueden)\b/g)||[]).length],
    ["de", (t.match(/\b(hallo|danke|fahrzeug|auto|preis|rabatt|lieferung|investition|zahlung|mochte|bitte)\b/g)||[]).length],
  ].sort((x,y)=>Number(y[1])-Number(x[1]));
  return Number(scores[0][1])>=2 ? String(scores[0][0]) as "fr"|"es"|"de" : "en";
}
function extractDelivery(text: string) {
  const out: Record<string,string> = {};
  const email=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone=text.match(/(?:\+?\d[\d ()-]{7,}\d)/);
  if(email)out.email=email[0].slice(0,200);
  if(phone)out.phone=phone[0].trim().slice(0,60);
  const nameMatch=text.match(/\b(?:my name is|name is|i am|i\x27m|nom est|me llamo|mein name ist)\s+(.+?)(?=\s+(?:from|based in|located in|de|en|desde|aus)\s+|[,;\n]|$)/i);
  if(nameMatch?.[1])out.full_name=nameMatch[1].trim().replace(/[.!?]+$/,"").slice(0,100);
  const addressMatch=text.match(/\b(?:my address is|address is|delivery address is|address|adresse|direccion|anschrift)\s*(?:is|:|=)?\s*(.+)$/i);
  if(addressMatch?.[1] && addressMatch[1].trim().length>=5)out.address=addressMatch[1].trim().replace(/[.!?]+$/,"").slice(0,240);
  const labelled:Record<string,RegExp>={country:/\b(?:country|pays|pais|land)\s*[:=-]\s*([^,.;\n]{2,80})/i,city:/\b(?:city|ville|ciudad|stadt)\s*[:=-]\s*([^,.;\n]{2,80})/i,preferred_delivery_date:/\b(?:delivery date|preferred date|date de livraison|fecha de entrega|lieferdatum)\s*[:=-]\s*([^,.;\n]{2,60})/i,instructions:/\b(?:instructions|notes|instrucciones)\s*[:=-]\s*([^.;\n]{3,160})/i};
  for(const [key,pattern] of Object.entries(labelled)){const m=text.match(pattern);if(m?.[1])out[key]=m[1].trim().slice(0,240);}
  if(!out.country || !out.city){
    const location=text.match(/\b(?:from|based in|located in|delivery to|deliver to)\s+(.+?)(?=[.!?]|$)/i)?.[1]?.trim();
    if(location){
      const countries=["United States of America","United States","USA","U.S.A.","United Kingdom","UK","Nigeria","Canada","France","Germany","Australia","United Arab Emirates","UAE"];
      const found=countries.find(country=>location.toLowerCase().includes(country.toLowerCase()));
      if(found&&!out.country)out.country=found;
      const rest=found?location.replace(new RegExp(found.replace(/[.*+?^$()|[\]\\]/g,"\\$&"),"i"),"").trim():location;
      if(rest&&!out.city&&rest.length<80)out.city=rest.replace(/^,|,$/g,"").trim();
    }
  }
  return out;
}
function independentReply(text: string, history: any[], catalogue: any[], vehicle: any, discount: any, conversation: any) {
  const lang=languageOf(text), t=normalized(text), delivery=extractDelivery(text);
  const has=(r:RegExp)=>r.test(t);
  const modelPattern=/\b(model\s*[3ysx]|cyber\s*truck|roadster|tesla\s*semi|semi)\b/i;
  const explicitModel=text.match(modelPattern)?.[0];
  const priorModel=[...history].reverse().filter((row:any)=>row.sender_role==="customer").map((row:any)=>String(row.body||"").match(modelPattern)?.[0]).find(Boolean);
  const rawModel=explicitModel||conversation.vehicle_model||priorModel||null;
  const mentionedModel=rawModel ? (/cyber\s*truck/i.test(rawModel)?"Cybertruck":/roadster/i.test(rawModel)?"Roadster":/semi/i.test(rawModel)?"Tesla Semi":rawModel.replace(/\s+/g," ").replace(/\bmodel\s*([3ysx])\b/i,(_,v)=>"Model "+String(v).toUpperCase())) : undefined;
  const name=vehicle?.name||vehicle?.model||mentionedModel||"your selected vehicle";
  const price=Number(vehicle?.price_usd), validPrice=Number.isFinite(price)&&price>0;
  const money=(n:number)=>new Intl.NumberFormat(lang==="fr"?"fr-FR":lang==="es"?"es-ES":lang==="de"?"de-DE":"en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
  let intent="general", requiresManagement=false, reply="";
  if(discount.mentionsDiscount){
    intent="discount"; requiresManagement=discount.aboveLimit;
    if(validPrice&&!discount.aboveLimit){
      const after=Math.round(price*.97*100)/100;
      reply=lang==="fr"?`Merci pour votre intérêt pour ${name}. Cette annonce publiée est éligible à la remise automatique de 3 %. Le prix affiché est de ${money(price)} et le prix après remise est de ${money(after)}, hors taxes, frais et livraison. Souhaitez-vous connaître les prochaines étapes ?`:
      lang==="es"?`Gracias por su interés en ${name}. Esta oferta publicada cumple los requisitos para el descuento automático del 3 %. El precio publicado es ${money(price)} y el precio con descuento es ${money(after)}, antes de impuestos, tasas y entrega. ¿Desea conocer los siguientes pasos?`:
      lang==="de"?`Vielen Dank für Ihr Interesse am ${name}. Dieses veröffentlichte Angebot ist für den automatischen Rabatt von 3 % berechtigt. Der Listenpreis beträgt ${money(price)}, der Preis nach Rabatt ${money(after)}, ohne Steuern, Gebühren und Lieferung. Möchten Sie die nächsten Schritte besprechen?`:
      `Thank you for your interest in the ${name}. This published listing qualifies for the standard 3% automatic discount. The listed price is ${money(price)}, and the discounted vehicle price is ${money(after)}, before taxes, fees and delivery. Would you like assistance with the next steps?`;
    } else {
      reply=lang==="fr"?"Merci pour votre demande. Tesla Markets peut appliquer automatiquement une remise maximale de 3 % sur les annonces publiées éligibles. Je vais vérifier les possibilités pour vous. Pourriez-vous préciser le modèle et la configuration souhaités ?":
      lang==="es"?"Gracias por su solicitud. Tesla Markets puede aplicar automáticamente hasta un 3 % de descuento en anuncios publicados que cumplan los requisitos. Voy a comprobar qué opciones pueden estar disponibles. Indíquenos el modelo y la configuración que desea.":
      lang==="de"?"Vielen Dank für Ihre Anfrage. Tesla Markets kann bei berechtigten veröffentlichten Angeboten automatisch bis zu 3 % Rabatt gewähren. Ich prüfe gerne, welche Möglichkeiten es gibt. Bitte nennen Sie mir das gewünschte Modell und die Konfiguration.":
      discount.aboveLimit?"Thank you for sharing your preferred discount. Tesla Markets can automatically apply up to 3% on eligible published vehicle listings. I’ll check what flexibility may be available for you. Please share the exact model and configuration so I can look into it.":"Thank you for considering Tesla Markets. Eligible published vehicle configurations may qualify for an automatic discount of up to 3%. Please share your preferred model and configuration so we can confirm the current published price and eligibility.";
    }
  } else if(has(/\b(invest|investment|investing|shares|stock|portfolio|profit|return|roi|investissement|inversion|acciones|anlage|aktien|rendite)\b/)){
    intent="investment"; requiresManagement=true;
    reply=lang==="fr"?"Merci pour votre intérêt pour Tesla Markets. Notre équipe sera ravie de vous présenter les informations disponibles et de vous guider dans les prochaines étapes. Que souhaitez-vous savoir ?":
    lang==="es"?"Gracias por su interés en Tesla Markets. Nuestro equipo estará encantado de explicarle la información disponible y guiarle en los próximos pasos. ¿Qué le gustaría saber?":
    lang==="de"?"Vielen Dank für Ihr Interesse an Tesla Markets. Unser Team informiert Sie gerne über die verfügbaren Informationen und begleitet Sie bei den nächsten Schritten. Was möchten Sie wissen?":
    "Thanks for your interest in Tesla Markets! Our team would be happy to walk you through the available information and guide you through the next steps. What would you like to know?";
  } else if(has(/\b(payment|payment method|payment options|paid|pay|transfer|receipt|refund|charge|paiement|remboursement|pago|zahlung)\b/)){
    intent="payment"; requiresManagement=true;
    // Payment instructions are never guessed or repeated by the automatic responder.
    reply="";
  } else if(has(/\b(human|person|agent|manager|representative|real person|speak to someone|conseiller|personne|persona|mitarbeiter)\b/)){
    intent="human_handover"; requiresManagement=true;
    reply=lang==="fr"?"Bien entendu. Bien entendu. Veuillez patienter un instant pendant que je vous mets en relation avec la personne la mieux placée pour vous aider.":
    lang==="es"?"Por supuesto. Por supuesto. Espere un momento mientras le pongo en contacto con la persona adecuada para ayudarle.":
    lang==="de"?"Selbstverständlich. Selbstverständlich. Bitte warten Sie einen Moment, während ich Sie mit der richtigen Ansprechperson verbinde.":
    "Certainly. I’ve notified our management team, and someone will continue with you here.";
  } else if(has(/\b(complaint|complain|problem|issue|disappointed|not received|broken|plainte|probleme|reclamacion|beschwerde)\b/)){
    intent="complaint"; requiresManagement=true;
    reply=lang==="fr"?"Merci de nous avoir signalé ce problème. Nous souhaitons l'examiner et vous aider. Je vais examiner cela pour vous. Vous pouvez partager la référence de commande, sans données de paiement sensibles.":
    lang==="es"?"Gracias por informarnos. Queremos revisar el asunto y ayudarle. Su mensaje se ha señalado para la atención de la dirección. Puede compartir la referencia del pedido, sin datos de pago confidenciales.":
    lang==="de"?"Vielen Dank für Ihren Hinweis. Wir möchten den Vorgang prüfen und Ihnen weiterhelfen. Ich prüfe das gerne für Sie. Bitte senden Sie keine sensiblen Zahlungsdaten.":
    "Thank you for bringing this to our attention. We appreciate the opportunity to review it and help. I’m sorry this has happened. Please give me a moment to look into this and help you with the next step.";
  } else if(has(/\b(hello|hi|hey|good morning|good afternoon|good evening|bonjour|bonsoir|hola|guten tag|hallo)\b/)&&t.split(/\s+/).length<9&&!mentionedModel&&!conversation.vehicle_model){
    intent="greeting";
    reply=lang==="fr"?"Bienvenue chez Tesla Markets. Merci de nous avoir contactés. Notre équipe est à votre disposition. Que souhaitez-vous savoir aujourd'hui ?":
    lang==="es"?"Le damos la bienvenida a Tesla Markets. Gracias por contactarnos. Nuestro equipo está encantado de ayudarle. ¿Qué desea saber hoy?":
    lang==="de"?"Willkommen bei Tesla Markets. Vielen Dank für Ihre Nachricht. Unser Team unterstützt Sie gerne. Was möchten Sie heute wissen?":
    "Welcome to Tesla Markets. Thank you for reaching out. Our customer-relations team is pleased to assist you. What would you like to know today?";
  } else if(has(/\b(delivery|deliver|shipping|ship|livraison|expedition|entrega|envio|lieferung|versand)\b/)){
    intent="delivery"; requiresManagement=true;
    reply=lang==="fr"?"Pour préparer votre demande de livraison, veuillez indiquer votre nom complet, votre adresse e-mail, votre numéro de téléphone, le pays, la ville et l'adresse de livraison. Notre équipe confirmera les modalités.":
    lang==="es"?"Para preparar la entrega, indique su nombre completo, correo electrónico, teléfono, país, ciudad y dirección de entrega. Nuestro equipo confirmará las condiciones.":
    lang==="de"?"Bitte nennen Sie für die Lieferanfrage Ihren vollständigen Namen, Ihre E-Mail-Adresse, Telefonnummer, das Land, die Stadt und die Lieferadresse. Unser Team bestätigt anschließend die Einzelheiten.":
    "To prepare your delivery enquiry, please share your full name, email address, phone number, delivery country, city and full delivery address. Our team will confirm the delivery arrangements.";
  } else if((vehicle || conversation.vehicle_model || mentionedModel) && !has(/\b(buy|purchase|order|reserve|book|acheter|comprar|pedido|kaufen|bestellen)\b/)){
    intent="vehicle_enquiry";
    const modelKey = canonicalVehicle(mentionedModel || conversation.vehicle_model || name);
    const specs = vehicle?.specifications && typeof vehicle.specifications === "object" ? vehicle.specifications : {};
    const label = (key:string) => key.replace(/[_-]+/g," ").replace(/\b\w/g,(ch:string)=>ch.toUpperCase());
    const specLines = Object.entries(specs).filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()!=="").map(([key,value])=>label(key)+": "+(Array.isArray(value)?value.map(item=>item&&typeof item==="object"&&"name" in item&&"price" in item?String(item.name)+" ("+String(item.price)+")":typeof item==="object"?JSON.stringify(item):String(item)).join(", "):typeof value==="object"?JSON.stringify(value):String(value)));
    const description = cleanString(vehicle?.description,900);
    const availability = cleanString(vehicle?.availability,120);
    const asksPrice=has(/\b(prices?|pricing|cost|how much|usd|dollar|prix|precio|preis)\b/);
    const asksPerformance=has(/\b(performance|acceleration|speed|range|battery|charging|horsepower|torque|autonomy)\b/);
    const asksAll=has(/\b(all details|full details|everything|complete details|full specifications|specifications|specs|tell me all|more details|details about|overview)\b/);
    const specificPerformance=cleanString(specs.performance,240);
    const specificRange=cleanString(specs.range,240);
    const isPlaceholder=(value:string)=>!value||/\b(varies|variant-dependent|depends on|to be confirmed|must be confirmed|final production specification|final specification)\b/i.test(value);
    const hasDetailedPerformance=!isPlaceholder(specificPerformance);
    const hasDetailedRange=!isPlaceholder(specificRange);
    const lines:string[]=[];
    if(validPrice) lines.push("Published price: "+money(price));
    if(description) lines.push("Overview: "+description);
    if(specLines.length) lines.push(...specLines);
    if(asksPrice){
      const variants=Array.isArray(specs.variants)?specs.variants.map((item:any)=>item.name+": "+item.price).join("; "):"";
      const priceNote=cleanString(specs.price_note,260);
      if(validPrice) reply="Published pricing for the "+name+": "+(variants||money(price))+". "+(priceNote||"Final quotation and availability are confirmed individually.");
      else reply="";
    } else if(asksPerformance){
      const performanceLines=specLines.filter(line=>/performance|acceleration|top speed|speed|range|battery|charging|power|horsepower|torque|motor/i.test(line));
      reply=hasDetailedPerformance&&hasDetailedRange&&performanceLines.length?"Published performance and range details for the "+name+": "+performanceLines.join("; "):"";
    } else if(asksAll){
      reply=hasDetailedPerformance&&hasDetailedRange&&lines.length?"Complete published details for the "+name+": "+lines.join(" · "):"";
    } else {
      reply=lines.length?"Published information for the "+name+": "+lines.join(" · "):"";
    }
    if(!reply){intent="unverified_vehicle_information";requiresManagement=true;}
  } else if(has(/\b(buy|purchase|order|reserve|book|acheter|comprar|pedido|kaufen|bestellen)\b/)){
    intent="purchase_ready";
    reply=lang==="fr"?"Pour préparer votre demande, veuillez indiquer votre nom complet, votre e-mail, votre téléphone, le modèle et la configuration souhaités, ainsi que le pays, la ville et l'adresse de livraison.":
    lang==="es"?"Para preparar su solicitud, indique su nombre completo, correo electrónico, teléfono, modelo y configuración deseados, además del país, ciudad y dirección de entrega.":
    lang==="de"?"Bitte nennen Sie zur Vorbereitung Ihren vollständigen Namen, Ihre E-Mail-Adresse, Telefonnummer, das gewünschte Modell und die Konfiguration sowie Lieferland, Stadt und Adresse.":
    "To prepare your vehicle enquiry, please share your full name, email address, phone number, preferred model and configuration, delivery country, city and full delivery address.";
  } else if(Object.keys(delivery).length){
    intent="delivery_details";
    reply="Thank you. I’ve added those details to your enquiry. Is there anything else you’d like us to know?";
  } else {
    intent="unverified_or_unsupported"; requiresManagement=true;
    reply="";
  }
  return {reply,intent,requiresManagement,delivery,language:lang,vehicleModel:vehicle?.model||vehicle?.name||mentionedModel||null};
}
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

    const lastAutomatedReply = [...history].reverse().find((row: any) => row.sender_role === "management" && row.automated_type === "ai_response");
    const discount = detectDiscountRequest(customerMessage.body);
    const vehicle = matchVehicle(customerMessage.body, conversation.vehicle_model || "", catalogue || []);
    let reply = "";
    let intent = "general";
    let requiresManagement = false;
    let extractedDelivery: Record<string, string> = {};

    const local = independentReply(customerMessage.body, history, catalogue || [], vehicle, discount, conversation);
    reply = local.reply;
    intent = local.intent;
    requiresManagement = local.requiresManagement;
    extractedDelivery = local.delivery;

    // Recover customer details expressed naturally across multiple messages.
    const priorDetails = conversation.delivery_details && typeof conversation.delivery_details === "object" ? conversation.delivery_details : {};
    const mergedDetails: Record<string, any> = { ...priorDetails, ...extractedDelivery };
    const selectedVehicle = vehicle || matchVehicle("", conversation.vehicle_model || "", catalogue || []);
    const selectedSpecs = selectedVehicle?.specifications && typeof selectedVehicle.specifications === "object" ? selectedVehicle.specifications : {};
    const variants = Array.isArray(selectedSpecs.variants) ? selectedSpecs.variants : [];
    const variantMatch = variants.find((variant: any) => { const variantName=cleanString(variant?.name,100); return variantName && normalized(customerMessage.body).includes(normalized(variantName)); });
    if (variantMatch) mergedDetails.selected_variant = cleanString(variantMatch.name,100);
    if (selectedVehicle && !mergedDetails.selected_variant && variants.length === 1) mergedDetails.selected_variant = cleanString(variants[0].name,100);
    const hasPaymentIntent = /\b(payment|payment method|payment options|how do i pay|where do i pay|pay now|transfer|bank details|paiement|pago|zahlung)\b/i.test(normalized(customerMessage.body));
    const hasName = !!cleanString(mergedDetails.full_name,100);
    const hasEmail = !!cleanString(mergedDetails.email || conversation.visitor_email || user.email,200);
    const hasPhone = !!cleanString(mergedDetails.phone || conversation.contact_phone,60);
    const hasCountry = !!cleanString(mergedDetails.country,80);
    const hasCity = !!cleanString(mergedDetails.city,80);
    const hasAddress = !!cleanString(mergedDetails.address,240);
    const hasVariant = !!cleanString(mergedDetails.selected_variant,100);
    const deliveryComplete = hasName && hasEmail && hasPhone && hasCountry && hasCity && hasAddress;
    const missing: string[] = [];
    if (!hasName) missing.push("full name");
    if (!hasEmail) missing.push("email address");
    if (!hasPhone) missing.push("phone number");
    if (!hasCountry) missing.push("delivery country");
    if (!hasCity) missing.push("delivery city");
    if (!hasAddress) missing.push("full delivery address");
    if (!hasVariant && variants.length > 1) missing.push("preferred vehicle version");
    if (hasPaymentIntent) {
      intent = "payment_method_confirmation"; requiresManagement = true;
      reply = "Thank you. Your vehicle enquiry and the details shared so far have been noted. Please hold on while our management team confirms the approved payment methods and final delivery quotation for your selected vehicle. We will update you here. Your payment is not yet confirmed.";
    } else if (Object.keys(extractedDelivery).length || variantMatch) {
      intent = "customer_details_progress"; requiresManagement = true;
      if (deliveryComplete && (hasVariant || variants.length <= 1)) {
        reply = "Thank you. I have received and recorded your contact and delivery details, together with your selected vehicle version. I am preparing your order summary and pro forma invoice now. Payment will remain pending until management confirms the payment method and verifies receipt.";
      } else {
        const labels:Record<string,string>={full_name:"name",email:"email address",phone:"phone number",country:"delivery country",city:"delivery city",address:"delivery address"};
        const received=[...new Set(Object.keys(extractedDelivery).map(key=>labels[key]||key))];
        const receivedText=received.length ? " I have noted: "+received.join(", ")+"." : "";
        const next=missing.length ? " To complete your order, I still need your "+missing.join(", ")+"." : "";
        reply="Thank you. Your information has been received and added to your vehicle enquiry."+receivedText+next+" Once those details are complete, I can prepare your pro forma invoice. Please do not send card details, passwords or one-time security codes in this chat.";
      }
    }

    if (!reply.trim()) {
      await admin.from("ai_responder_runs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("message_id", messageId);
      await admin.from("admin_notifications").insert({
        type: "ai_silent_handover",
        title: "Customer question needs a verified management answer",
        body: `Customer ${conversation.visitor_email || "website visitor"} · ${intent} · No automated answer sent because verified information is unavailable.`,
        entity_type: "conversation",
        entity_id: conversationId,
        is_read: false,
      });
      return json({ ok: true, silent: true, intent }, 200, headers);
    }

    // Never emit the same automated sentence twice in a row. If the rules resolve
    // to an identical answer, mark this message handled and leave the conversation quiet.
    const canonical = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (lastAutomatedReply && canonical(lastAutomatedReply.body || "") === canonical(reply)) {
      await admin.from("ai_responder_runs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("message_id", messageId);
      return json({ ok: true, skipped: true, reason: "identical_reply_prevented" }, 200, headers);
    }

    if (local.vehicleModel && local.vehicleModel !== conversation.vehicle_model) {
      const { error: vehicleContextError } = await admin.from("support_conversations")
        .update({ vehicle_model: local.vehicleModel, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
      if (vehicleContextError) throw vehicleContextError;
    }

    if (Object.keys(extractedDelivery).length || variantMatch) {
      const { error: deliveryError } = await admin.from("support_conversations").update({
        delivery_details: mergedDetails,
        vehicle_model: selectedVehicle?.model || selectedVehicle?.name || conversation.vehicle_model,
        contact_phone: mergedDetails.phone || conversation.contact_phone,
        updated_at: new Date().toISOString()
      }).eq("id", conversationId);
      if (deliveryError) throw deliveryError;
      await admin.from("customer_profiles").update({
        display_name: mergedDetails.full_name || undefined,
        phone: mergedDetails.phone || undefined,
        email: mergedDetails.email || undefined,
        updated_at: new Date().toISOString()
      }).eq("id", user.id);
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

    if (Object.keys(extractedDelivery).length) {
      await admin.from("admin_notifications").insert({
        type: "delivery_details_received",
        title: "Customer delivery information received",
        body: `Customer ${conversation.visitor_email || "website visitor"} provided delivery information. Review the secure conversation.`,
        entity_type: "conversation",
        entity_id: conversationId,
        is_read: false,
      });
    }

    if (discount.aboveLimit) {
      await admin.from("admin_notifications").insert({
        type: "discount_approval_request",
        title: "Additional vehicle discount requires approval",
        body: `Customer ${conversation.visitor_email || "website visitor"} requested a discount above the automatic 3% limit.`,
        entity_type: "conversation",
        entity_id: conversationId,
        is_read: false,
      });
    }

    if (intent === "investment") {
      await admin.from("admin_notifications").insert({
        type: "investment_enquiry",
        title: "New investment enquiry",
        body: `Customer ${conversation.visitor_email || "website visitor"} submitted an investment-related question. Management review is required.`,
        entity_type: "conversation",
        entity_id: conversationId,
        is_read: false,
      });
    }

    if (intent === "purchase_ready" || intent === "vehicle_purchase") {
      await admin.from("admin_notifications").insert({
        type: "purchase_ready",
        title: "Customer is ready to proceed with a vehicle",
        body: `Customer ${conversation.visitor_email || "website visitor"} appears ready to proceed. Review the conversation and delivery requirements.`,
        entity_type: "conversation",
        entity_id: conversationId,
        is_read: false,
      });
    }

    if (intent === "payment" || intent === "payment_receipt" || intent === "payment_method_confirmation") {
      await admin.from("admin_notifications").insert({
        type: "payment_review",
        title: "Payment enquiry requires verification",
        body: `Customer ${conversation.visitor_email || "website visitor"} raised a payment-related question. Verify records before confirming payment.`,
        entity_type: "conversation",
        entity_id: conversationId,
        is_read: false,
      });
    }

    if (requiresManagement || intent === "complaint" || intent === "human_handover" || intent === "fraud_concern") {
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
