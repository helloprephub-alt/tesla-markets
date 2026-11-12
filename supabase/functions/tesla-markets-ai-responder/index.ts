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
function extractDelivery(text: string, pendingSlot = "") {
  const out: Record<string,string> = {};
  const email=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone=text.match(/(?:\+?\d[\d ()-]{7,}\d)/);
  if(email)out.email=email[0].slice(0,200);
  if(phone)out.phone=phone[0].trim().slice(0,60);
  const nameMatch=text.match(/\b(?:my full name is|my name is|name is|full name|name|i am|i\x27m|this is|nom est|me llamo|mein name ist)\s*[:,-]?\s+([\p{L}][\p{L} .’'-]{1,98}?)(?=\s+(?:and\s+)?(?:email|e-mail|phone|telephone|country|from|based in|located in|my email|my phone)\b|[,;\n]|$)/iu);
  if(nameMatch?.[1])out.full_name=nameMatch[1].trim().replace(/[.!?]+$/,"").slice(0,100);
  const addressMatch=text.match(/(?<!email )\b(?:my delivery address|delivery address|my address|address|adresse|direccion|anschrift)\s*(?:is|:|=)?\s*(.+)$/i);
  if(addressMatch?.[1] && addressMatch[1].trim().length>=5)out.address=addressMatch[1].trim().replace(/[.!?]+$/,"").slice(0,240);
  const labelled:Record<string,RegExp>={country:/\b(?:country|pays|pais|land)\s*[:=-]\s*([^,.;\n]{2,80})/i,city:/\b(?:city|ville|ciudad|stadt)\s*[:=-]\s*([^,.;\n]{2,80})/i,preferred_delivery_date:/\b(?:delivery date|preferred date|date de livraison|fecha de entrega|lieferdatum)\s*[:=-]\s*([^,.;\n]{2,60})/i,instructions:/\b(?:instructions|notes|instrucciones)\s*[:=-]\s*([^.;\n]{3,160})/i};
  for(const [key,pattern] of Object.entries(labelled)){const m=text.match(pattern);if(m?.[1])out[key]=m[1].trim().slice(0,240);}
  // If the assistant previously asked for one specific field, accept a natural,
  // unlabelled answer instead of asking the customer to repeat the label.
  const plain=text.trim().replace(/[.!?]+$/,"");
  if(pendingSlot==="full_name" && !out.full_name && plain.split(/\s+/).length>=2 && plain.split(/\s+/).length<=5 && /^[\p{L}][\p{L} .’'-]{2,98}$/u.test(plain) && !/^(yes|no|okay|ok|sure|hello|hi|thanks|thank you|i need|i want|can you|please|actually|what about|how about)/i.test(plain)) out.full_name=plain;
  if(pendingSlot==="country" && !out.country && /^(united states|united states of america|usa|u\.s\.a\.|united kingdom|uk|nigeria|canada|france|germany|australia|ireland|spain|italy|netherlands|south africa|united arab emirates|uae)$/i.test(plain)) out.country=plain;
  if(pendingSlot==="city" && !out.city && plain.split(/\s+/).length<=4 && /^[\p{L} .'-]{2,70}$/u.test(plain) && !/^(yes|no|okay|ok|sure|thanks|thank you|i need|i want|can you|please|actually|what about|how about)/i.test(plain)) out.city=plain;
  if(pendingSlot==="address" && !out.address && plain.length>=6 && /[0-9]/.test(plain)) out.address=plain.slice(0,240);
  if(pendingSlot==="phone" && !out.phone && /(?:\+?\d[\d ()-]{7,}\d)/.test(plain)) out.phone=plain.match(/(?:\+?\d[\d ()-]{7,}\d)/)?.[0]?.trim().slice(0,60)||"";

  if(pendingSlot==="email" && !out.email && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(plain)) out.email=plain.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||"";

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
  const lang=languageOf(text), t=normalized(text), delivery=extractDelivery(text, cleanString(conversation.ai_memory?.pending_slot,40));
  const has=(r:RegExp)=>r.test(t);
  const previousAiReply=cleanString(conversation.ai_memory?.last_ai_response,1200) || String([...history].reverse().find((row:any)=>row.sender_role==="management" && row.automated_type==="ai_response")?.body || "");
  const affirmative=has(/^\\s*(yes|yeah|yep|sure|okay|ok|please do|go ahead|sounds good|alright|all right)\\b/);
  const acceptsFullInfo=affirmative && /available versions and prices|performance details|delivery information|all the details|full information/i.test(previousAiReply);
  const acceptsPurchase=affirmative && /would you like to proceed|ready to order|next steps/i.test(previousAiReply);
  const asksOfficial=has(/\\b(is this (the )?official|are you official|official website|is tesla markets official|is this legitimate|is this real|are you genuine)\\b/);
  const asksIdentity=has(/\\b(who are you|what are you|are you (a )?(bot|ai|human)|are you real)\\b/);
  const asksAddAnother=has(/\\b(add another|another car|one more car|also order|also buy|add (a )?car|include another|second car)\\b/);
  const asksGeneralKnowledge=has(/\\b(what is|who is|where is|when is|why is|how does|how do|can you explain|tell me about)\\b/);


  const modelPattern=/\b(model\s*[3ysx]|cyber\s*truck|roadster|tesla\s*semi|semi)\b/i;
  const explicitModel=text.match(modelPattern)?.[0];
  const priorModel=[...history].reverse().filter((row:any)=>row.sender_role==="customer").map((row:any)=>String(row.body||"").match(modelPattern)?.[0]).find(Boolean);
  const rawModel=explicitModel||conversation.vehicle_model||priorModel||null;
  const mentionedModel=rawModel ? (/cyber\s*truck/i.test(rawModel)?"Cybertruck":/roadster/i.test(rawModel)?"Roadster":/semi/i.test(rawModel)?"Tesla Semi":rawModel.replace(/\s+/g," ").replace(/\bmodel\s*([3ysx])\b/i,(_,v)=>"Model "+String(v).toUpperCase())) : undefined;
  const name=vehicle?.name||vehicle?.model||mentionedModel||"your selected vehicle";
  const specsForVariant = vehicle?.specifications && typeof vehicle.specifications === "object" ? vehicle.specifications : {};
  const listedVariants = Array.isArray(specsForVariant.variants) ? specsForVariant.variants : [];
  const requestedVariant = listedVariants.find((item:any) => {
    const variantName=cleanString(item?.name,100);
    return variantName && normalized(text).includes(normalized(variantName));
  }) || null;
  const requestedVariantPriceText=cleanString(requestedVariant?.price,80);
  const requestedVariantPrice=requestedVariantPriceText ? Number(requestedVariantPriceText.replace(/[^0-9.]/g,"")) : NaN;
  const price=Number.isFinite(requestedVariantPrice)&&requestedVariantPrice>0 ? requestedVariantPrice : Number(vehicle?.price_usd), validPrice=Number.isFinite(price)&&price>0;
  const money=(n:number)=>new Intl.NumberFormat(lang==="fr"?"fr-FR":lang==="es"?"es-ES":lang==="de"?"de-DE":"en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
  let intent="general", requiresManagement=false, reply="";
  if(asksOfficial){
    intent="official_status";
    reply="This is the Tesla Markets website enquiry channel. Tesla Markets is a separate business and is not Tesla, Inc.’s official factory sales channel. We can help with vehicle and investment-related enquiries. What would you like to know?";
  } else if(asksIdentity){
    intent="assistant_identity";
    reply="I'm the Tesla Markets virtual assistant. I can help with general questions, vehicle enquiries, investment enquiries and the services offered by Tesla Markets.";
  } else if(asksAddAnother){
    intent="add_vehicle_to_order";
    const model=explicitModel ? (canonicalVehicle(explicitModel) || explicitModel) : "";
    reply=model
      ? "Absolutely. I can note the "+model+" as an additional vehicle of interest alongside your current enquiry. Would you prefer both vehicles on one order summary or handled as separate enquiries?"
      : "Absolutely. You can enquire about more than one vehicle. Which model would you like to add? I'll keep your existing vehicle enquiry in context.";
  } else if(discount.mentionsDiscount){
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
  } else if(has(/\b(explain|explain to me|how does|how do|what is|tell me about|understand)\b.{0,70}\b(tesla investment|investing in tesla|tesla shares|tesla stock|investment in tesla|tesla)\b|\b(tesla investment|investing in tesla|tesla shares|tesla stock|investment in tesla)\b/)){
    intent="investment_explanation"; requiresManagement=true;
    reply="Tesla is a publicly traded company listed on the Nasdaq under the ticker TSLA. Buying a share means buying a small ownership interest in the company; the share price changes with the market. I’m checking the latest available TSLA quote so I can show an estimated share calculation for your chosen amount.";
  } else if(has(/\b(invest|investment|investing|shares|stock|portfolio|profit|return|roi|investissement|inversion|acciones|anlage|aktien|rendite)\b/)){
    intent="investment"; requiresManagement=true;
    reply="I can help record your Tesla Markets investment enquiry. Please share your full name, email address, phone number and country. If you already have an amount in mind, include that too.";
  } else if(has(/\b(payment|payment method|payment options|paid|pay|transfer|receipt|refund|charge|paiement|remboursement|pago|zahlung)\b/)){
    intent="payment"; requiresManagement=true;
    // Payment instructions are never guessed or repeated by the automatic responder.
    reply="";
  } else if(has(/\b(human|person|agent|manager|representative|real person|speak to someone|conseiller|personne|persona|mitarbeiter)\b/)){
    intent="human_handover"; requiresManagement=true;
    reply=lang==="fr"?"Bien entendu. Notre équipe prendra le relais dans ce chat.":
    lang==="es"?"Por supuesto. Nuestro equipo continuará con usted en este chat.":
    lang==="de"?"Selbstverständlich. Unser Team übernimmt die weitere Betreuung in diesem Chat.":
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
  } else if((vehicle || conversation.vehicle_model || mentionedModel) && (requestedVariant || has(/\b(price|prices|pricing|cost|how much|usd|dollar|performance|acceleration|speed|range|battery|charging|horsepower|torque|autonomy|specification|specifications|features|colours?|colors?|wheels?|details|information|overview|delivery|availability|available|version|variants?|warranty|guarantee|insurance|financing|finance|test drive|servicing|maintenance|trade in|trade-in)\b/)) && !has(/\b(buy|purchase|order|reserve|book|acheter|comprar|pedido|kaufen|bestellen)\b/)){
    intent="vehicle_enquiry";
    const modelKey = canonicalVehicle(mentionedModel || conversation.vehicle_model || name);
    const specs = vehicle?.specifications && typeof vehicle.specifications === "object" ? vehicle.specifications : {};
    const label = (key:string) => key.replace(/[_-]+/g," ").replace(/\b\w/g,(ch:string)=>ch.toUpperCase());
    const specLines = Object.entries(specs).filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()!=="").map(([key,value])=>label(key)+": "+(Array.isArray(value)?value.map(item=>item&&typeof item==="object"&&"name" in item&&"price" in item?String(item.name)+" ("+String(item.price)+")":typeof item==="object"?JSON.stringify(item):String(item)).join(", "):typeof value==="object"?JSON.stringify(value):String(value)));
    const description = cleanString(vehicle?.description,900);
    const availability = cleanString(vehicle?.availability,120);
    const asksPrice=has(/\b(prices?|pricing|cost|how much|usd|dollar|prix|precio|preis)\b/);
    const asksPerformance=has(/\b(performance|acceleration|speed|range|battery|charging|horsepower|torque|autonomy)\b/);
    const asksAll=has(/\b(all details|all information|yes all|everything|full details|complete details|full specifications|specifications|specs|tell me all|more details|details about|overview)\b/) || acceptsFullInfo;
    const specificPerformance=cleanString(specs.performance,240);
    const specificRange=cleanString(specs.range,240);
    const isPlaceholder=(value:string)=>!value||/\b(varies|variant-dependent|depends on|to be confirmed|must be confirmed|final production specification|final specification)\b/i.test(value);
    const hasDetailedPerformance=!isPlaceholder(specificPerformance);
    const hasDetailedRange=!isPlaceholder(specificRange);
    const lines:string[]=[];
    if(validPrice) lines.push("Published price: "+money(price));
    if(description) lines.push("Overview: "+description);
    if(specLines.length) lines.push(...specLines);
    if (requestedVariant && !asksPrice && !asksPerformance && !asksAll && !discount.mentionsDiscount) {
      intent="vehicle_variant_selected";
      const variantPrice=cleanString(requestedVariant.price,80);
      reply="Understood — you are interested in the "+cleanString(requestedVariant.name,100)+" version of the "+name+"."+(variantPrice ? " The published starting price supplied for this version is "+variantPrice+"." : " Its final price still needs management confirmation.")+" Would you like to proceed with this version?";
    } else if(asksPrice){
      const variants=Array.isArray(specs.variants)?specs.variants.map((item:any)=>item.name+": "+item.price).join("; "):"";
      const priceNote=cleanString(specs.price_note,260);
      if(validPrice) reply="Published pricing for the "+name+": "+(variants||money(price))+". "+(priceNote||"Final quotation and availability are confirmed individually.");
      else reply="";
    } else if(asksPerformance){
      const performanceLines=specLines.filter(line=>/performance|acceleration|top speed|speed|range|battery|charging|power|horsepower|torque|motor/i.test(line));
      reply=hasDetailedPerformance&&hasDetailedRange&&performanceLines.length?"Published performance and range details for the "+name+": "+performanceLines.join("; "):"";
    } else if(asksAll){
      if (lines.length) {
        const sections:string[] = ["TESLA MARKETS — "+name.toUpperCase()];
        if(description) sections.push("OVERVIEW\n"+description);
        if(validPrice) sections.push("PRICING\n"+(Array.isArray(specs.variants)?specs.variants.map((item:any)=>"• "+cleanString(item?.name,100)+": "+cleanString(item?.price,60)).join("\n"):"Starting price: "+money(price)));
        if(cleanString(specs.performance,240) && !isPlaceholder(specificPerformance)) sections.push("PERFORMANCE\n"+specificPerformance);
        if(cleanString(specs.range,240) && !isPlaceholder(specificRange)) sections.push("DRIVING RANGE\n"+specificRange);
        if(cleanString(specs.drivetrain,240)) sections.push("DRIVETRAIN\n"+cleanString(specs.drivetrain,240));
        if(Array.isArray(specs.features)&&specs.features.length) sections.push("FEATURES\n"+specs.features.map((item:any)=>"• "+String(item)).join("\n"));
        if(Array.isArray(specs.colors)&&specs.colors.length) sections.push("COLOUR OPTIONS\n"+specs.colors.join(", "));
        if(Array.isArray(specs.wheels)&&specs.wheels.length) sections.push("WHEEL OPTIONS\n"+specs.wheels.join(", "));
        if(cleanString(specs.lease,120)) sections.push("FINANCING INDICATION\n"+cleanString(specs.lease,120));
        sections.push("AVAILABILITY & DELIVERY\nFinal availability, exact performance/range figures where not published, taxes and delivery costs are confirmed by management for your destination.");
        reply=sections.join("\n\n");
      } else reply="";
    } else {
      reply=description ? "Thank you for your interest in the "+name+". "+description+" Would you like the available versions and prices, performance details, or delivery information?" : "";
    }
    if(!reply){intent="unverified_vehicle_information";requiresManagement=true;reply="Thank you for your question. I do not have a verified specification for that detail yet. Please hold while our management team confirms it for you."; }
  } else if(has(/\b(buy|purchase|order|reserve|book|acheter|comprar|pedido|kaufen|bestellen)\b/) || acceptsPurchase){
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
    intent="unverified_or_unsupported";
    requiresManagement=true;
    reply="";
  }
  return {reply,intent,requiresManagement,delivery,language:lang,vehicleModel:vehicle?.model||vehicle?.name||mentionedModel||null,additionalVehicleModel:intent==="add_vehicle_to_order" ? (explicitModel ? canonicalVehicle(explicitModel) : null) : null};
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
    const { data: memoryRow, error: memoryError } = await admin
      .from("ai_conversation_memory")
      .select("memory")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (memoryError) throw memoryError;
    const aiMemory = memoryRow?.memory && typeof memoryRow.memory === "object" ? memoryRow.memory : {};
    conversation.ai_memory = aiMemory;


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
      .select("name,model,slug,description,price_usd,availability,images,specifications")
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
    if (local.intent === "investment_explanation") {
      try {
        const quoteResponse = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/TSLA?range=1d&interval=1m", { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 TeslaMarketsEnquiry/1.0" }, signal: AbortSignal.timeout(6000) });
        if (!quoteResponse.ok) throw new Error("Market quote unavailable");
        const quotePayload = await quoteResponse.json();
        const quote = quotePayload?.chart?.result?.[0];
        const price = Number(quote?.meta?.regularMarketPrice);
        const quoteTime = Number(quote?.meta?.regularMarketTime);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quoteTime)) throw new Error("Invalid market quote");
        const amountMatch = customerMessage.body.match(/(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)|\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:usd|dollars?)\b/i);
        const amount = amountMatch ? Number((amountMatch[1] || amountMatch[2]).replace(/,/g, "")) : 0;
        const quoteDate = new Date(quoteTime * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
        const shareCount = amount > 0 ? amount / price : 0;
        reply = "Tesla (NASDAQ: TSLA) designs and manufactures electric vehicles, energy generation and storage products, and related software and services. A share represents a small ownership interest in Tesla; its market price moves with trading and company and market developments.\n\nLatest reported company performance (Q3 2026, reported October 21, 2026): revenue was $28.046 billion and GAAP net income attributable to common stockholders was $787 million; diluted GAAP earnings per share were $0.22. For the first nine months of 2026, revenue was $78.669 billion and GAAP net income attributable to common stockholders was $2.378 billion. These are Tesla company results, not a return earned by an individual shareholder. Source: Tesla Q3 2026 financial results.\\n\\nLatest available TSLA quote: $" + price.toFixed(2) + " USD per share (quote timestamp: " + quoteDate + "; source: Yahoo Finance market data).";
        if (amount > 0) reply += "\n\nAt $" + amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " USD, the estimate is " + shareCount.toFixed(4) + " shares before brokerage fees and other charges. Fractional shares depend on the broker. This is an estimate, not a trade or guaranteed return.";
        else reply += "\n\nIf you tell me the amount you are considering, I can estimate how many shares it represents at this quote.";
        reply += "\n\nTesla Markets collects investment enquiries; this chat does not execute share purchases. Management must confirm any available arrangement before an investment is made.";
      } catch (_quoteError) {
        reply = "";
        local.requiresManagement = true;
      }
    }
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
    const nextPendingSlot = !hasName ? "full_name" : !hasEmail ? "email" : !hasPhone ? "phone" : !hasCountry ? "country" : !hasCity ? "city" : !hasAddress ? "address" : !hasVariant && variants.length > 1 ? "selected_variant" : "";
    const priorInvestmentStage = cleanString(aiMemory.conversation_stage, 80);
    const investmentStages = ["investment_awaiting_amount","investment_collecting_details","investment_confirming_details"];
    const investmentFlow = intent === "investment" || investmentStages.includes(priorInvestmentStage);
    const investmentAmountMatch = customerMessage.body.match(/(?:\\$|usd\\s*)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)|\\b([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(?:usd|dollars?)\\b/i) || (priorInvestmentStage === "investment_awaiting_amount" && /^\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?\\s*$/.test(customerMessage.body) ? [customerMessage.body.trim(), customerMessage.body.trim().replace(/,/g,""), undefined] as any : null);
    const startingNewInvestment = intent === "investment" && priorInvestmentStage === "investment_submitted";
    const investmentAmount = investmentAmountMatch ? Number((investmentAmountMatch[1] || investmentAmountMatch[2]).replace(/,/g,"")) : startingNewInvestment ? 0 : Number(aiMemory.investment_amount_usd || 0);
    const investmentName = cleanString(mergedDetails.full_name,100);
    const investmentEmail = cleanString(mergedDetails.email || conversation.visitor_email || user.email,200);
    const investmentPhone = cleanString(mergedDetails.phone || conversation.contact_phone,60);
    const investmentCountry = cleanString(mergedDetails.country,80);
    const investmentCity = cleanString(mergedDetails.city,80);
    const investmentAddress = cleanString(mergedDetails.address,240);
    const investmentDetailsComplete = !!(investmentName && investmentEmail && investmentPhone && investmentCountry && investmentAddress);
    const saysConfirm = /^(yes|yeah|yep|sure|okay|ok|please do|go ahead|confirm|confirmed|proceed|submit|send it|that's correct|that is correct)[.!\\s]*$/i.test(customerMessage.body.trim());
    const saysCorrectDetails = /\\b(correct|update|change|new email|new phone|wrong|not correct)\\b/i.test(customerMessage.body);
    let investmentEnquiryCreated = false;
    let investmentShareEstimate: number | null = null;
    let investmentSharePrice: number | null = null;
    let investmentQuoteTime = "";

    if (investmentFlow) {
      requiresManagement = true;
      if (!(investmentAmount > 0) || !Number.isFinite(investmentAmount)) {
        intent = "investment_awaiting_amount";
        reply = "I can explain how Tesla shares work and show you the latest available TSLA market information. How much would you like to invest in USD? For example, you can enter $1,000.";
      } else if (!investmentDetailsComplete) {
        intent = "investment_collecting_details";
        const missingInvestment = !investmentName ? "your full legal name" : !investmentEmail ? "your email address" : !investmentPhone ? "your phone number" : !investmentCountry ? "your country of residence" : "your full residential address";
        reply = "Thank you. I have noted your intended investment amount of $" + investmentAmount.toLocaleString("en-US") + " USD. To prepare your investment enquiry record, please provide " + missingInvestment + ".";
      } else {
        try {
          const quoteResponse = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/TSLA?range=1d&interval=1m", { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 TeslaMarketsEnquiry/1.0" }, signal: AbortSignal.timeout(6000) });
          if (quoteResponse.ok) {
            const quotePayload = await quoteResponse.json();
            const quote = quotePayload?.chart?.result?.[0];
            const price = Number(quote?.meta?.regularMarketPrice);
            const quoteTime = Number(quote?.meta?.regularMarketTime);
            if (Number.isFinite(price) && price > 0 && Number.isFinite(quoteTime)) {
              investmentSharePrice = price;
              investmentShareEstimate = investmentAmount / price;
              investmentQuoteTime = new Date(quoteTime * 1000).toISOString();
            }
          }
        } catch (_quoteError) { /* Enquiry can still be recorded without a live share estimate. */ }
        const summary = {
          full_name: investmentName,
          email: investmentEmail,
          phone: investmentPhone,
          country: investmentCountry,
          city: investmentCity,
          residential_address: investmentAddress,
          amount_usd: investmentAmount,
          estimated_shares: investmentShareEstimate,
          share_price_usd: investmentSharePrice,
          quote_timestamp: investmentQuoteTime || null,
          status: "Payment pending"
        };
        const { error: profileError } = await admin.from("customer_profiles").upsert({
          id: user.id, display_name: investmentName, email: investmentEmail, phone: investmentPhone, is_admin: false, updated_at: new Date().toISOString()
        }, { onConflict: "id" });
        if (profileError) throw profileError;
        const { error: conversationUpdateError } = await admin.from("support_conversations").update({
          visitor_email: investmentEmail, contact_phone: investmentPhone, delivery_details: { ...mergedDetails, investment_enquiry: summary }, updated_at: new Date().toISOString()
        }).eq("id", conversationId);
        if (conversationUpdateError) throw conversationUpdateError;
        const { error: investmentInsertError } = await admin.from("investment_enquiries").insert({
          customer_id: user.id,
          opportunity: "Tesla Markets investment enquiry — $" + investmentAmount.toLocaleString("en-US") + " USD",
          category: "investment",
          customer_question: JSON.stringify(summary),
          status: "payment_pending"
        });
        if (investmentInsertError) throw investmentInsertError;
        investmentEnquiryCreated = true;
        intent = "investment_submitted";
        reply = "Your investment enquiry has been recorded and sent to Tesla Markets Management. The summary card below is your enquiry record, not an invoice or payment receipt. Its status is PAYMENT PENDING. Management will review your details and contact you with the approved next steps. No payment has been requested or confirmed.";
      }
    } else if (hasPaymentIntent) {
      intent = "payment_method_confirmation"; requiresManagement = true;
      reply = "Thank you. Your vehicle enquiry and the details shared so far have been noted. Please hold on while our management team confirms the approved payment methods and final delivery quotation for your selected vehicle. We will update you here. Your payment is not yet confirmed.";
    } else if (/^\\s*(okay|ok|yes|yeah|sure|proceed|continue|go ahead|sounds good|alright|all right|yes please)\\b/i.test(customerMessage.body) && selectedVehicle) {
      intent = "customer_details_progress";
      const needs = missing.length ? missing.join(", ") : "confirmation of your preferred vehicle version";
      reply = "Certainly. I have kept your " + selectedVehicle.name + " enquiry open. To move to the next step, please provide your " + needs + ". I will prepare the pro forma invoice once the required details are complete.";
    } else if (((Object.keys(extractedDelivery).length > 0) && ["general","delivery_details","unverified_or_unsupported","greeting"].includes(intent)) || (variantMatch && !discount.mentionsDiscount)) {
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

    if (Object.keys(extractedDelivery).length && reply.trim() && !["customer_details_progress","payment_method_confirmation"].includes(intent)) {
      const savedLabels:Record<string,string>={full_name:"your name",email:"your email address",phone:"your phone number",address:"your delivery address",country:"your delivery country",city:"your delivery city"};
      const saved=Object.keys(extractedDelivery).map(key=>savedLabels[key]||key);
      reply += "\n\nI have also noted " + saved.join(", ") + " on your enquiry.";
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
    if (history.some((row:any)=>row.sender_role==="management" && row.automated_type==="ai_response" && canonical(row.body||"")===canonical(reply))) {
      await admin.from("ai_responder_runs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("message_id", messageId);
      return json({ ok: true, silent: true, duplicate_reply: true, intent }, 200, headers);
    }

    if (local.vehicleModel && local.vehicleModel !== conversation.vehicle_model) {
      const { error: vehicleContextError } = await admin.from("support_conversations")
        .update({ vehicle_model: local.vehicleModel, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
      if (vehicleContextError) throw vehicleContextError;
    }


    // Persist structured conversational memory so the next message is interpreted
    // against the question just asked, selected car, chosen trim and collected facts.
    const memoryNext = {
      ...aiMemory,
      selected_vehicle: local.vehicleModel || conversation.vehicle_model || null,
      vehicle_interests: (() => { const existing = Array.isArray(aiMemory.vehicle_interests) ? aiMemory.vehicle_interests : []; const extra = cleanString(local.additionalVehicleModel, 80); if (!extra) return existing; return [...existing.filter((item:any) => cleanString(item?.model,80).toLowerCase() !== extra.toLowerCase()), { model: extra, status: "additional_interest", added_at: new Date().toISOString() }]; })(),
      selected_variant: mergedDetails.selected_variant || aiMemory.selected_variant || null,
      last_intent: intent,
      pending_slot: investmentFlow ? (!(investmentAmount > 0) ? "investment_amount" : !investmentName ? "full_name" : !investmentEmail ? "email" : !investmentPhone ? "phone" : !investmentCountry ? "country" : !investmentAddress ? "address" : "") : nextPendingSlot,
      investment_amount_usd: investmentAmount > 0 && Number.isFinite(investmentAmount) ? investmentAmount : aiMemory.investment_amount_usd || null,
      last_customer_message: cleanString(customerMessage.body,500),
      last_customer_message_at: customerMessage.created_at,
      last_ai_response: cleanString(reply,1200),
      last_ai_response_at: new Date().toISOString(),
      known_fields: {
        full_name: !!cleanString(mergedDetails.full_name,100),
        email: !!cleanString(mergedDetails.email || conversation.visitor_email || user.email,200),
        phone: !!cleanString(mergedDetails.phone || conversation.contact_phone,60),
        country: !!cleanString(mergedDetails.country,80),
        city: !!cleanString(mergedDetails.city,80),
        address: !!cleanString(mergedDetails.address,240),
        selected_variant: !!cleanString(mergedDetails.selected_variant,100)
      },
      conversation_stage: investmentFlow ? (investmentEnquiryCreated ? "investment_submitted" : intent === "investment_awaiting_amount" ? "investment_awaiting_amount" : "investment_collecting_details") : hasPaymentIntent ? "awaiting_payment_method_confirmation" : deliveryComplete ? "details_complete" : hasName || hasEmail || hasPhone || hasAddress ? "collecting_delivery_details" : intent === "purchase_ready" ? "collecting_delivery_details" : intent
    };
    const { error: memoryWriteError } = await admin.from("ai_conversation_memory").upsert({
      conversation_id: conversationId,
      customer_id: user.id,
      memory: memoryNext,
      last_customer_message_at: customerMessage.created_at,
      last_ai_response_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "conversation_id" });
    if (memoryWriteError) throw memoryWriteError;

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

    let proformaInvoice: { reference: string; amount: number; variant: string } | null = null;
    if (["purchase_ready","customer_details_progress","vehicle_purchase"].includes(intent) && deliveryComplete && selectedVehicle && (hasVariant || variants.length <= 1)) {
      const selectedVariant = variants.find((variant: any) => cleanString(variant?.name,100) === cleanString(mergedDetails.selected_variant,100)) || variants[0];
      const variantPriceText = cleanString(selectedVariant?.price,80);
      const parsedVariantPrice = Number(variantPriceText.replace(/[^0-9.]/g,""));
      const finalAmount = variantPriceText ? (Number.isFinite(parsedVariantPrice) && parsedVariantPrice > 0 ? parsedVariantPrice : NaN) : Number(selectedVehicle.price_usd);
      if (Number.isFinite(finalAmount) && finalAmount > 0) {
        const { data: existingOrder, error: existingOrderError } = await admin.from("business_orders")
          .select("id,order_reference,agreed_amount,item_description,status")
          .eq("conversation_id", conversationId)
          .neq("status","cancelled")
          .order("created_at",{ascending:false})
          .limit(1)
          .maybeSingle();
        if (existingOrderError) throw existingOrderError;
        if (existingOrder) {
          proformaInvoice = {
            reference: existingOrder.order_reference,
            amount: Number(existingOrder.agreed_amount),
            variant: existingOrder.item_description
          };
        } else {
          const { error: profileUpsertError } = await admin.from("customer_profiles").upsert({
            id: user.id,
            display_name: mergedDetails.full_name,
            email: mergedDetails.email || user.email || null,
            phone: mergedDetails.phone,
            is_admin: false,
            updated_at: new Date().toISOString()
          },{onConflict:"id"});
          if (profileUpsertError) throw profileUpsertError;

          const { data: vehicleEnquiry, error: enquiryError } = await admin.from("vehicle_enquiries").insert({
            customer_id: user.id,
            vehicle_model: selectedVehicle.name,
            configuration: {
              selected_variant: cleanString(selectedVariant?.name,100),
              selected_price_usd: finalAmount,
              delivery_details: mergedDetails
            },
            customer_note: "Customer completed vehicle and delivery details through the Tesla Markets independent chat responder.",
            status: "new"
          }).select("id").single();
          if (enquiryError) throw enquiryError;

          const orderReference = "TM-PRO-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + crypto.randomUUID().slice(0,6).toUpperCase();
          const itemDescription = selectedVehicle.name + " · " + cleanString(selectedVariant?.name,100);
          const { data: order, error: orderError } = await admin.from("business_orders").insert({
            order_reference: orderReference,
            customer_id: user.id,
            conversation_id: conversationId,
            vehicle_enquiry_id: vehicleEnquiry.id,
            item_type: "vehicle",
            item_description: itemDescription,
            currency: "USD",
            agreed_amount: finalAmount,
            status: "awaiting_payment",
            internal_notes: "Pro forma only. Payment method, taxes, delivery charges and final availability require management confirmation."
          }).select("id,order_reference,agreed_amount,item_description,status").single();
          if (orderError) throw orderError;
          proformaInvoice = {
            reference: order.order_reference,
            amount: Number(order.agreed_amount),
            variant: order.item_description
          };
          await admin.from("admin_notifications").insert({
            type: "proforma_invoice_created",
            title: "Vehicle pro forma invoice ready",
            body: "A draft vehicle order is awaiting payment-method confirmation. Reference: " + orderReference + ". Review customer delivery details and confirm the final quotation.",
            entity_type: "conversation",
            entity_id: conversationId,
            is_read: false
          });
        }
      } else {
        intent = "proforma_price_requires_confirmation";
        requiresManagement = true;
        reply = "Thank you. Your details have been received. Please hold while our management team confirms the exact price for this configuration and prepares your pro forma invoice. No payment is due until the final quotation and approved payment method are confirmed.";
      }
    }

    if (proformaInvoice && !hasPaymentIntent) {
      const amount = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(proformaInvoice.amount);
      reply = [
        "TESLA MARKETS — PRO FORMA INVOICE",
        "Reference: " + proformaInvoice.reference,
        "Customer: " + cleanString(mergedDetails.full_name,100),
        "Vehicle: " + proformaInvoice.variant,
        "Delivery: " + [mergedDetails.address,mergedDetails.city,mergedDetails.country].filter(Boolean).join(", "),
        "Contact: " + [mergedDetails.email || user.email,mergedDetails.phone].filter(Boolean).join(" · "),
        "Vehicle subtotal: " + amount + " USD",
        "Taxes, delivery and other charges: To be confirmed by management.",
        "PAYMENT STATUS: PENDING",
        "Payment method: Awaiting management confirmation.",
        "This is a pro forma invoice, not a payment receipt or confirmation of vehicle availability. Please wait for the official payment instructions from Tesla Markets Management."
      ].join("\n");
      intent = "proforma_invoice_created";
      requiresManagement = true;
    }

    let messageType = "text";
    let structuredData: Record<string, any> | null = null;
    if (investmentEnquiryCreated) {
      messageType = "investment_summary";
      structuredData = {
        title: "Investment enquiry summary",
        subtitle: "CUSTOMER ENQUIRY · NOT AN INVOICE",
        status: "Payment pending",
        amount_label: "INTENDED INVESTMENT AMOUNT",
        amount: "$" + investmentAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD",
        fields_title: "Customer information",
        fields: [
          { label: "Full legal name", value: investmentName },
          { label: "Email address", value: investmentEmail },
          { label: "Phone number", value: investmentPhone },
          { label: "Country of residence", value: investmentCountry },
          { label: "City", value: investmentCity || "Not provided" },
          { label: "Residential address", value: investmentAddress }
        ],
        sections: [{
          title: "Investment details",
          rows: [
            { label: "Intended amount", value: "$" + investmentAmount.toLocaleString("en-US") + " USD" },
            { label: "Estimated shares", value: investmentShareEstimate !== null ? investmentShareEstimate.toFixed(4) : "Unavailable — current quote could not be verified" },
            { label: "Share price", value: investmentSharePrice !== null ? "$" + investmentSharePrice.toFixed(2) + " USD" : "Not available" },
            { label: "Quote timestamp", value: investmentQuoteTime || "Not available" },
            { label: "Enquiry status", value: "Payment pending" }
          ]
        }],
        disclaimer: "This record confirms an enquiry only. It is not a share purchase, payment request, payment receipt or guaranteed investment return."
      };
    } else if (selectedVehicle && ["vehicle_enquiry","vehicle_information","vehicle_specs","general"].includes(intent) && (vehicle || /\\b(cybertruck|roadster|model ?[3ysx]|tesla semi|semi)\\b/i.test(customerMessage.body))) {
      const specs = selectedVehicle.specifications && typeof selectedVehicle.specifications === "object" ? selectedVehicle.specifications : {};
      const variants = Array.isArray(specs.variants) ? specs.variants : [];
      const colours = Array.isArray(specs.colors) ? specs.colors.join(", ") : cleanString(specs.colors,300);
      const features = Array.isArray(specs.features) ? specs.features.join(" · ") : cleanString(specs.features,500);
      const images = Array.isArray(selectedVehicle.images) ? selectedVehicle.images : [];
      const metrics = [
        specs.acceleration_0_60 ? { label: "0–60 mph", value: String(specs.acceleration_0_60) } : null,
        specs.top_speed ? { label: "Top speed", value: String(specs.top_speed) } : null,
        specs.range ? { label: "Estimated range", value: String(specs.range) } : null,
        specs.power ? { label: "Power", value: String(specs.power) } : null
      ].filter(Boolean);
      messageType = "vehicle_card";
      structuredData = {
        title: cleanString(selectedVehicle.name,100),
        subtitle: cleanString(specs.subtitle,160) || cleanString(selectedVehicle.description,220),
        image_url: typeof images[0] === "string" ? images[0] : null,
        metrics,
        sections: [
          { title: "Pricing and versions", rows: [
            { label: "Starting listed price", value: selectedVehicle.price_usd ? "$" + Number(selectedVehicle.price_usd).toLocaleString("en-US") + " USD" : "Contact management" },
            ...variants.map((v:any) => ({ label: cleanString(v?.name,80), value: cleanString(v?.price,80) })).filter((v:any)=>v.label&&v.value),
            { label: "Price basis", value: cleanString(specs.price_note,240) || "Confirm current quotation with management" }
          ]},
          { title: "Performance and range", rows: [
            { label: "Performance", value: cleanString(specs.performance,220) || "Not yet verified for this configuration" },
            { label: "Range", value: cleanString(specs.range,220) || "Not yet verified for this configuration" },
            { label: "Drivetrain", value: cleanString(specs.drivetrain,160) || "Configuration dependent" }
          ]},
          { title: "Colours and equipment", rows: [
            { label: "Exterior colours", value: colours || "Confirm available colours for your market" },
            { label: "Wheels", value: Array.isArray(specs.wheels) ? specs.wheels.join(", ") : cleanString(specs.wheels,220) || "Confirm with management" },
            { label: "Key features", value: features || "Contact management for full equipment details" }
          ]},
          { title: "Availability", rows: [
            { label: "Listing status", value: cleanString(selectedVehicle.availability,80) || "To be confirmed" },
            { label: "Availability note", value: cleanString(specs.availability_note,220) || "Management must confirm current market availability and delivery" }
          ]}
        ],
        disclaimer: "Specifications, prices, colours and availability depend on model year, trim and market. Items marked as preferences or management-supplied listings are not represented as confirmed factory specifications."
      };
    } else if (investmentFlow && investmentDetailsComplete && !investmentEnquiryCreated) {
      messageType = "customer_details";
      structuredData = {
        title: "Investment enquiry details",
        subtitle: "INFORMATION COLLECTED SO FAR",
        fields: [
          { label: "Full legal name", value: investmentName },
          { label: "Email address", value: investmentEmail },
          { label: "Phone number", value: investmentPhone },
          { label: "Country of residence", value: investmentCountry },
          { label: "Residential address", value: investmentAddress }
        ],
        amount_label: "INTENDED INVESTMENT AMOUNT",
        amount: "$" + investmentAmount.toLocaleString("en-US") + " USD",
        disclaimer: "Review the details before submission. This is not an invoice or proof of payment."
      };
    }

    const { data: responseMessage, error: responseInsertError } = await admin
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: managementProfile.id,
        sender_role: "management",
        body: reply,
        automated_type: "ai_response",
        message_type: messageType,
        structured_data: structuredData,
      })
      .select("id").single();
    if (responseInsertError) {
      if (responseInsertError.code === "PGRST116" || /duplicate_management_reply_blocked/i.test(responseInsertError.message || "")) {
        await admin.from("ai_responder_runs").update({ status: "completed", updated_at: new Date().toISOString() }).eq("message_id", messageId);
        return json({ ok: true, silent: true, duplicate_reply: true, intent }, 200, headers);
      }
      throw responseInsertError;
    }

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

    if (intent === "investment" || intent === "investment_submitted") {
      await admin.from("admin_notifications").insert({
        type: "investment_enquiry",
        title: intent === "investment_submitted" ? "Investment enquiry submitted — $" + investmentAmount.toLocaleString("en-US") + " USD" : "New investment enquiry",
        body: `Customer ${conversation.visitor_email || investmentEmail || "website visitor"} · ${intent === "investment_submitted" ? "Amount: $" + investmentAmount.toLocaleString("en-US") + " USD" : "Investment details are being collected."}`,
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
