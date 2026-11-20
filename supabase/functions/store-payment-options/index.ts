import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.0";

const allowedOrigins = new Set([
  "https://teslamarketsofficial.com",
  "https://www.teslamarketsofficial.com",
  "https://tesla-markets.vercel.app",
]);

function corsHeaders(origin: string | null) {
  const previewOrigin = /^https:\/\/tesla-markets-[a-z0-9-]+-tesla-5c9c\.vercel\.app$/i;
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
  if (origin && (allowedOrigins.has(origin) || previewOrigin.test(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max = 500): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
}

type MethodConfig = {
  key: string;
  label: string;
  settingsKey: string;
  identifiers: Array<"email" | "phone" | "username">;
  kind: "manual";
};

const manualMethods: MethodConfig[] = [
  { key: "paypal", label: "PayPal", settingsKey: "PayPal", identifiers: ["email", "username"], kind: "manual" },
  { key: "zelle", label: "Zelle", settingsKey: "Zelle", identifiers: ["email", "phone"], kind: "manual" },
  { key: "apple_pay", label: "Apple Pay (management-assisted)", settingsKey: "Apple Pay", identifiers: ["email", "phone", "username"], kind: "manual" },
  { key: "chime", label: "Chime", settingsKey: "Chime", identifiers: ["username", "phone", "email"], kind: "manual" },
];

const giftCardMethods = [
  { key: "amazon_gift_card", label: "Amazon Gift Card" },
  { key: "apple_gift_card", label: "Apple Gift Card" },
  { key: "google_play_gift_card", label: "Google Play Gift Card" },
  { key: "razor_gold_gift_card", label: "Razer Gold Gift Card" },
];

function configuredMethods(settings: Record<string, any>) {
  const methods: Array<{ key: string; label: string; kind: "manual" | "gift_card" }> = [];
  for (const method of manualMethods) {
    const details = settings[method.settingsKey] && typeof settings[method.settingsKey] === "object"
      ? settings[method.settingsKey]
      : {};
    const hasRecipient = method.identifiers.some((field) => clean(details[field], 200).length > 0);
    if (details.enabled === true && hasRecipient) {
      methods.push({ key: method.key, label: method.label, kind: "manual" });
    }
  }
  if (settings.giftCardEnabled === true) {
    for (const method of giftCardMethods) methods.push({ ...method, kind: "gift_card" });
  }
  return methods;
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

  try {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required." }, 401, headers);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Server configuration is unavailable.");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your secure session could not be verified." }, 401, headers);
    const user = authData.user;

    const body = await req.json();
    const orderId = clean(body?.order_id, 80);
    const selectedMethod = clean(body?.payment_method, 80);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: "A valid order is required." }, 400, headers);
    }

    const { data: order, error: orderError } = await admin
      .from("store_orders")
      .select("id,customer_id,status,payment_method")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found." }, 404, headers);

    const allowedStatuses = ["awaiting_payment", "payment_proof_rejected", "proof_submitted"];
    if (!allowedStatuses.includes(String(order.status))) {
      return json({ error: "Payment instructions are unavailable for this order status." }, 409, headers);
    }

    const { data: settingsRow, error: settingsError } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "payment_account_details")
      .maybeSingle();
    if (settingsError) throw settingsError;
    const settings = settingsRow?.value && typeof settingsRow.value === "object" ? settingsRow.value : {};
    const methods = configuredMethods(settings);

    if (!selectedMethod) {
      return json({
        ok: true,
        methods,
        selected_method: order.payment_method || null,
      }, 200, headers);
    }

    const method = methods.find((item) => item.key === selectedMethod);
    if (!method) return json({ error: "That payment method is not currently enabled. Choose an available option or contact management." }, 409, headers);

    if (order.status === "proof_submitted" && order.payment_method !== selectedMethod) {
      return json({ error: "A payment submission is already linked to this order. Contact management before changing methods." }, 409, headers);
    }

    if (order.status !== "proof_submitted") {
      const { error: updateError } = await admin
        .from("store_orders")
        .update({
          payment_method: selectedMethod,
          payment_method_selected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("customer_id", user.id);
      if (updateError) throw updateError;
    }

    if (method.kind === "gift_card") {
      return json({
        ok: true,
        selected_method: selectedMethod,
        instructions: {
          method: selectedMethod,
          label: method.label,
          kind: "gift_card",
          note: "Upload a clear purchase receipt or transaction confirmation. Hide all gift-card redemption codes and PINs before uploading. Tesla Markets Management must verify the evidence; this submission does not confirm payment.",
        },
      }, 200, headers);
    }

    const config = settings[manualMethods.find((item) => item.key === selectedMethod)!.settingsKey] || {};
    const methodConfig = manualMethods.find((item) => item.key === selectedMethod)!;
    const recipientField = methodConfig.identifiers.find((field) => clean(config[field], 200).length > 0)!;
    const recipientLabels: Record<string, string> = {
      email: "Recipient email",
      phone: "Recipient phone",
      username: "Recipient handle",
    };
    const applePayNote = selectedMethod === "apple_pay"
      ? "This is a management-assisted Apple Pay arrangement, not a native Apple Pay wallet sheet or automated Apple Pay gateway integration."
      : "This is a management-assisted payment instruction, not an automated payment gateway checkout.";

    return json({
      ok: true,
      selected_method: selectedMethod,
      instructions: {
        method: selectedMethod,
        label: method.label,
        kind: "manual",
        accountName: clean(config.accountName, 120) || null,
        recipientLabel: recipientLabels[recipientField],
        recipient: clean(config[recipientField], 200),
        additionalInstructions: clean(config.instructions, 600) || null,
        note: applePayNote + " Payment remains pending until management verifies receipt. Never share passwords, one-time passcodes, full card numbers, CVV/security codes, bank login details, gift-card PINs or redemption codes.",
      },
    }, 200, headers);
  } catch (error) {
    console.error("store-payment-options failed:", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "We could not load payment instructions. Please contact Tesla Markets Management." }, 500, headers);
  }
});
