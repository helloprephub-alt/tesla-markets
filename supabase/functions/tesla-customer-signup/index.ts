import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
const siteUrl = "https://teslamarketsofficial.com";
const sender = "Tesla Markets <support@teslamarketsofficial.com>";
const allowedOrigins = new Set([
  "https://teslamarketsofficial.com",
  "https://www.teslamarketsofficial.com",
  "https://tesla-markets.vercel.app",
  "https://tesla-markets-git-resend-logo-hardening-20261119-tesla-5c9c.vercel.app",
  "https://tesla-markets-7gdhklq1j-tesla-5c9c.vercel.app",
]);
const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
const json = (status: number, body: unknown, origin: string) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.startsWith("tesla-markets-") &&
      url.hostname.endsWith("-tesla-5c9c.vercel.app");
  } catch { return false; }
}
function otpEmail(name: string, token: string, recovery: boolean) {
  const title = recovery ? "Reset your password securely." : "Verify your email address.";
  const subject = recovery ? "Your Tesla Markets password reset code" : "Verify your Tesla Markets account";
  const body = recovery
    ? "Use this six-digit code on the Tesla Markets password recovery screen to verify your request and choose a new password."
    : "Thank you for registering with Tesla Markets. Enter this six-digit code on the website to confirm your email address and activate your account.";
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:28px 12px;background:#f2f3f4;color:#17191c;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden">' +
    '<tr><td style="padding:26px 32px;background:#090b0d;border-bottom:3px solid #b89a58"><div style="font-size:18px;color:#fff;font-weight:700;letter-spacing:2px">TESLA MARKETS</div><div style="margin-top:7px;font-size:9px;color:#c6c9cc;letter-spacing:2px">SECURE CUSTOMER ACCESS</div></td></tr>' +
    '<tr><td style="padding:42px 38px"><div style="font-size:10px;color:#a68b52;font-weight:700;letter-spacing:2px">ACCOUNT SECURITY</div><h1 style="font-size:28px;line-height:1.2;color:#111418;margin:16px 0">' + title + '</h1>' +
    '<p style="font-size:15px;line-height:1.8;color:#555d65">Hello ' + esc(name || "there") + ',</p><p style="font-size:15px;line-height:1.8;color:#555d65">' + body + '</p>' +
    '<div style="margin:30px 0;padding:24px 12px;text-align:center;background:#f7f7f6;border:1px solid #e7e3d9;border-radius:9px"><div style="font-size:10px;letter-spacing:2px;color:#777;font-weight:700">YOUR SIX-DIGIT CODE</div><div style="margin-top:12px;font-size:36px;letter-spacing:10px;font-weight:700;color:#111418">' + esc(token) + '</div></div>' +
    '<p style="font-size:12px;line-height:1.7;color:#737981">This code expires according to the account security settings. For your protection, never share it with anyone. If you did not request this, you can ignore this email.</p><p style="margin-top:30px;font-size:13px;line-height:1.7;color:#343a40">Kind regards,<br><strong>Tesla Markets Management</strong></p></td></tr>' +
    '<tr><td style="padding:22px 32px;background:#090b0d;color:#b8bdc3"><div style="font-size:11px;letter-spacing:2px;color:#fff;font-weight:700">TESLA MARKETS</div><p style="font-size:10px;line-height:1.7">Secure account communication · <a href="mailto:support@teslamarketsofficial.com" style="color:#fff">support@teslamarketsofficial.com</a></p><a href="' + siteUrl + '" style="font-size:10px;color:#c9b27b;text-decoration:none">teslamarketsofficial.com</a></td></tr>' +
    '</table></td></tr></table></body></html>';
  return { subject, html, text: title + "\n\n" + body + "\n\nYour six-digit code: " + token + "\n\nNever share this code with anyone. If you did not request it, ignore this email." };
}
Deno.serve(async (req) => {
  if (req.method === "GET") {
    const configured = { supabaseUrl: Boolean(supabaseUrl), serviceRole: Boolean(serviceRoleKey), resend: Boolean(resendKey) };
    let rateLimitStore = false;
    if (configured.supabaseUrl && configured.serviceRole) {
      try {
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
        const check = await admin.from("customer_signup_rate_limits").select("id", { count: "exact", head: true });
        rateLimitStore = !check.error;
      } catch { rateLimitStore = false; }
    }
    const ready = configured.supabaseUrl && configured.serviceRole && configured.resend && rateLimitStore;
    return new Response(JSON.stringify({ ok: Boolean(ready), configured, rateLimitStore }), {
      status: ready ? 200 : 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }
  if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." }, origin);
  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    console.error("Customer signup OTP service is missing a required server secret.");
    return json(503, { error: "Account registration is temporarily unavailable. Please try again shortly." }, origin);
  }
  let input: any;
  try { input = await req.json(); } catch { return json(400, { error: "Please check the account details and try again." }, origin); }
  const action = input?.action === "recovery" ? "recovery" : "signup";
  const recovery = action === "recovery";
  const email = String(input?.email || "").trim().toLowerCase();
  const password = String(input?.password || "");
  const firstName = String(input?.firstName || "").trim().slice(0, 80);
  const lastName = String(input?.lastName || "").trim().slice(0, 80);
  const country = String(input?.country || "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(400, { error: "Enter a valid email address." }, origin);
  if (!recovery && (password.length < 8 || password.length > 72 || !firstName || !lastName)) {
    return json(400, { error: "Enter both names and a password of at least 8 characters." }, origin);
  }
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [emailHash, ipHash] = await Promise.all([sha256(email + "|" + serviceRoleKey), sha256(ip + "|" + serviceRoleKey)]);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [emailCount, ipCount] = await Promise.all([
    admin.from("customer_signup_rate_limits").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gt("created_at", since),
    admin.from("customer_signup_rate_limits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("created_at", since),
  ]);
  if (emailCount.error || ipCount.error) {
    console.error("Customer signup rate-limit check failed.");
    return json(503, { error: "Account security checks are temporarily unavailable. Please try again shortly." }, origin);
  }
  if ((emailCount.count || 0) >= 5 || (ipCount.count || 0) >= 15) return json(429, { error: "Too many attempts. Please try again later." }, origin);
  const rateInsert = await admin.from("customer_signup_rate_limits").insert({ email_hash: emailHash, ip_hash: ipHash });
  if (rateInsert.error) {
    console.error("Customer signup rate-limit audit insert failed.");
    return json(503, { error: "Account security checks are temporarily unavailable. Please try again shortly." }, origin);
  }
  const metadata = { name: (firstName + " " + lastName).trim(), first_name: firstName, last_name: lastName, country };
  const generated = recovery
    ? await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: siteUrl + "/?page=login" } })
    : await admin.auth.admin.generateLink({ type: "signup", email, password, options: { data: metadata, redirectTo: siteUrl + "/?page=dashboard" } });
  if (generated.error) {
    if (recovery) return json(200, { ok: true, message: "If this address is registered, a six-digit password recovery code has been sent." }, origin);
    const msg = String(generated.error.message || "").toLowerCase();
    if (generated.error.status === 422 || generated.error.code === "email_exists" ||
      generated.error.code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
      return json(409, { error: "An account already exists for this email address. Please sign in or use Forgot Password." }, origin);
    }
    console.error("Supabase did not generate a signup OTP:", generated.error.code || generated.error.status || "auth_error");
    return json(400, { error: "We could not prepare email verification. Please check your details or try again." }, origin);
  }
  const token = generated.data.properties?.email_otp;
  if (typeof token !== "string" || !/^\d{6}$/.test(token)) {
    console.error("Supabase did not return a six-digit email OTP.");
    return json(503, { error: "We could not prepare a verification code. Please try again shortly." }, origin);
  }
  const mail = otpEmail(metadata.name, token, recovery);
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from: sender, to: [email], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!sent.ok) {
    const providerError = await sent.json().catch(() => ({}));
    console.error("Resend rejected a customer OTP email:", sent.status, providerError?.name || "provider_error");
    return json(502, { error: "We could not send your verification code right now. Please try again shortly." }, origin);
  }
  void admin.from("customer_signup_rate_limits").delete()
    .lt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .then(({ error }) => { if (error) console.error("Signup rate-limit cleanup failed."); });
  return json(200, {
    ok: true,
    message: recovery
      ? "If this address is registered, a six-digit password recovery code has been sent."
      : "A six-digit verification code has been sent to your email address.",
  }, origin);
});
