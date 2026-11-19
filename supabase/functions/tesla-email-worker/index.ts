import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendRelayUrl = (Deno.env.get("TESLA_MARKETS_SITE_URL") || "https://teslamarketsofficial.com").replace(/\\/+$/, "") + "/api/send-transactional-email";
const senderEmail = Deno.env.get("TESLA_MARKETS_EMAIL_FROM") || "support@teslamarketsofficial.com";
const senderName = Deno.env.get("TESLA_MARKETS_EMAIL_SENDER_NAME") || "Tesla Markets";
const siteUrl = Deno.env.get("TESLA_MARKETS_SITE_URL") || "https://teslamarketsofficial.com";
const logoUrl = Deno.env.get("TESLA_MARKETS_LOGO_URL") || "https://teslamarketsofficial.com/tesla-markets-logo.jpg";
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const titles: Record<string,string> = {
  welcome:"Welcome to Tesla Markets", registration_confirmation:"Confirm your Tesla Markets account",
  email_verification:"Verify your email address", password_reset:"Reset your password",
  password_changed:"Your password was changed", security_alert:"A security update for your account",
  profile_updated:"Your profile was updated", account_recovery:"Account recovery update",
  account_closed:"Your account has been closed",
  order_received:"We have received your order", order_confirmation:"Your order is confirmed",
  order_updated:"Your order has been updated", payment_pending:"Your payment submission is under review",
  payment_received:"We have received your payment", payment_approved:"Your payment proof was approved",
  payment_rejected:"Your payment proof needs attention", order_processing:"Your order is being prepared",
  order_shipped:"Your order has been dispatched", order_delivered:"Your order has been delivered",
  order_cancelled:"Your order was cancelled", refund_update:"An update about your refund",
  invoice_ready:"Your invoice is ready", cart_reminder:"A reminder about your shopping cart",
  abandoned_checkout:"You left items at checkout",
  gift_card_received:"We received your gift-card submission", gift_card_review:"Your gift-card submission is under review",
  gift_card_approved:"Your gift-card submission was approved", gift_card_rejected:"Your gift-card submission needs attention",
  vehicle_enquiry:"We received your vehicle enquiry", vehicle_follow_up:"Following up on your vehicle enquiry",
  vehicle_quote:"Your vehicle quote is ready", vehicle_reservation:"Your vehicle reservation update",
  vehicle_availability:"An update about vehicle availability", vehicle_delivery:"Your vehicle delivery update",
  investment_enquiry:"We received your investment enquiry", investment_follow_up:"Following up on your investment enquiry",
  investment_information:"Information about your investment enquiry", investment_status:"Your enquiry status has changed",
  investment_application:"We received your application", portfolio_notification:"A portfolio notification",
  support_received:"We received your support message", support_reply:"There is a reply to your support message",
  chat_received:"We received your chat enquiry", missed_chat:"Following up on your chat",
  ticket_updated:"Your support ticket has been updated", ticket_resolved:"Your support ticket was resolved",
  feedback_request:"We would appreciate your feedback", complaint_received:"We received your complaint",
  support_escalated:"Your support request has been escalated",
  getting_started:"Getting started with Tesla Markets", post_purchase:"Thank you for your purchase",
  review_request:"Tell us about your experience", reengagement:"It has been a while",
  product_announcement:"A Tesla Markets product announcement", vehicle_promotion:"A vehicle promotion from Tesla Markets",
  discount_announcement:"A special offer from Tesla Markets", limited_offer:"A limited-time Tesla Markets offer",
  seasonal_campaign:"A seasonal update from Tesla Markets", newsletter:"Tesla Markets newsletter",
  category_announcement:"An update from Tesla Markets", campaign_follow_up:"A follow-up from Tesla Markets",
  admin_alert:"Tesla Markets admin notification", daily_summary:"Tesla Markets daily summary",
  weekly_summary:"Tesla Markets weekly summary", system_alert:"Tesla Markets system alert",
  delivery_alert:"A delivery update", bounce_alert:"Email delivery alert",
  unsubscribe_confirmation:"Your email preferences were updated", abandoned_cart:"You left items in your Tesla Markets cart"
};


const emailCopy: Record<string,{subject:string;eyebrow:string;headline:string;body:string}> = {
welcome:{subject:"Welcome to Tesla Markets",eyebrow:"YOUR JOURNEY STARTS HERE",headline:"Welcome to Tesla Markets.",body:"Your customer account is ready. Explore the marketplace, review vehicle collections and contact our team whenever you need assistance."},
registration_confirmation:{subject:"Confirm your Tesla Markets account",eyebrow:"ACCOUNT VERIFICATION",headline:"Confirm your email address.",body:"We received a request to create an account using this email address. Complete the verification step to confirm your address."},
email_verification:{subject:"Verify your Tesla Markets email",eyebrow:"ACCOUNT VERIFICATION",headline:"Confirm your email address.",body:"Please verify your email address to complete your account setup. If you did not create this account, you can ignore this message."},
password_reset:{subject:"Reset your Tesla Markets password",eyebrow:"ACCOUNT SECURITY",headline:"Password reset requested.",body:"A password reset was requested for your account. Use the secure reset link provided by the website. If you did not request this, contact support."},
password_changed:{subject:"Your password was changed",eyebrow:"ACCOUNT SECURITY",headline:"Your password was updated.",body:"This is a security notification confirming that your account password was changed. If you did not make this change, contact support immediately."},
security_alert:{subject:"A security update for your account",eyebrow:"ACCOUNT SECURITY",headline:"Please review this account alert.",body:"We recorded a security-related event on your account. Review your account activity and contact support if anything looks unfamiliar."},
profile_updated:{subject:"Your account details were updated",eyebrow:"ACCOUNT UPDATE",headline:"Your profile was updated.",body:"This is a confirmation that your account details were updated."},
account_recovery:{subject:"Account recovery information",eyebrow:"ACCOUNT SECURITY",headline:"Let's help you recover access.",body:"We received a request for help accessing your account. Follow only the secure instructions provided through the official website."},
account_closed:{subject:"Your account closure request",eyebrow:"ACCOUNT UPDATE",headline:"Your account closure is confirmed.",body:"Your account closure request has been processed. If you believe this is a mistake, contact our support team."},
order_received:{subject:"We received your order",eyebrow:"ORDER UPDATE",headline:"Your order has been received.",body:"Thank you. We have received your order request. This acknowledgement does not mean payment has been confirmed."},
order_confirmation:{subject:"Your order is confirmed",eyebrow:"ORDER UPDATE",headline:"Your order is confirmed.",body:"Your order has been confirmed in our system. Review the order details below and keep the reference for your records."},
order_updated:{subject:"There is an update to your order",eyebrow:"ORDER UPDATE",headline:"Your order details have changed.",body:"There has been an update to your order. Review the latest details below or contact our team if you need assistance."},
payment_pending:{subject:"Your payment submission is being reviewed",eyebrow:"PAYMENT UPDATE",headline:"Your submission is under review.",body:"We have received your payment submission. Our team will review it and update your order status. This is not confirmation of settlement."},
payment_received:{subject:"We have received your payment",eyebrow:"PAYMENT UPDATE",headline:"Payment receipt recorded.",body:"Our system has recorded a payment-received event. Please refer to the order status for the latest fulfilment information."},
payment_approved:{subject:"Your payment submission was accepted",eyebrow:"PAYMENT REVIEW",headline:"Your submission was accepted.",body:"Our team has reviewed your submission and marked it as accepted. Any fulfilment updates will follow separately."},
payment_rejected:{subject:"Action required for your payment submission",eyebrow:"PAYMENT REVIEW",headline:"Your submission needs attention.",body:"Our team could not approve the submitted payment proof. Review the management note below and contact support if you need help."},
order_processing:{subject:"Your order is being processed",eyebrow:"FULFILMENT UPDATE",headline:"Your order is in progress.",body:"Your order has moved into processing. We will share another update when its status changes."},
order_shipped:{subject:"Your order has been shipped",eyebrow:"FULFILMENT UPDATE",headline:"Your order is on its way.",body:"Your order has been marked as shipped. Use the tracking details below when available."},
order_delivered:{subject:"Your order has been marked delivered",eyebrow:"FULFILMENT UPDATE",headline:"Delivery update.",body:"Your order has been marked as delivered. If you need assistance, our support team is here to help."},
order_cancelled:{subject:"Your order has been cancelled",eyebrow:"ORDER UPDATE",headline:"Your order was cancelled.",body:"The order status has been updated to cancelled. Contact our team if you believe this was unexpected."},
refund_update:{subject:"Your refund status has been updated",eyebrow:"PAYMENT UPDATE",headline:"There is an update on your refund.",body:"The status of your refund request has changed. Refer to the details below for the latest information."},
invoice_ready:{subject:"Your Tesla Markets invoice is ready",eyebrow:"ORDER DOCUMENT",headline:"Your invoice is ready.",body:"Your order invoice is available. Keep this message for your records."},
cart_reminder:{subject:"A reminder about your Tesla Markets cart",eyebrow:"YOUR MARKETPLACE CART",headline:"Your selected items are still here.",body:"You recently saved items in your cart. You can return to the marketplace whenever you are ready."},
abandoned_cart:{subject:"You left items in your Tesla Markets cart",eyebrow:"YOUR MARKETPLACE CART",headline:"Would you like to continue?",body:"Your cart still contains items from your recent visit. This is a friendly reminder, not a reservation or guarantee of availability."},
abandoned_checkout:{subject:"You left items at checkout",eyebrow:"CHECKOUT REMINDER",headline:"Your checkout was not completed.",body:"It looks like you did not complete checkout. Return to your account to review your cart and current availability."},
gift_card_received:{subject:"We received your payment submission",eyebrow:"PAYMENT REVIEW",headline:"Your submission has arrived.",body:"We have received your payment proof for review. This is an acknowledgement only, not confirmation of payment or settlement."},
gift_card_review:{subject:"Your payment proof is under review",eyebrow:"PAYMENT REVIEW",headline:"Our team is reviewing your submission.",body:"Your submitted payment proof is being checked. We will email you when the review is complete."},
gift_card_approved:{subject:"Your payment proof was approved",eyebrow:"PAYMENT REVIEW",headline:"Your submission was approved.",body:"Our team approved the submitted payment proof. Order fulfilment will be communicated separately."},
gift_card_rejected:{subject:"Your payment proof needs attention",eyebrow:"PAYMENT REVIEW",headline:"We could not approve your submission.",body:"Please review the management note below and contact support if you need assistance. Never email gift-card codes or passwords."},
vehicle_enquiry:{subject:"We received your vehicle enquiry",eyebrow:"VEHICLE COLLECTION",headline:"Your vehicle enquiry is received.",body:"Thank you for your interest. Our team will review your selected model and preferences and follow up with relevant details."},
vehicle_follow_up:{subject:"Following up on your vehicle enquiry",eyebrow:"VEHICLE COLLECTION",headline:"Can we help with your vehicle research?",body:"We are following up on your recent vehicle enquiry. Reply to this email if you would like more information."},
vehicle_quote:{subject:"Your vehicle quotation is ready",eyebrow:"VEHICLE COLLECTION",headline:"Your requested quotation is ready.",body:"The team has prepared an update for your selected vehicle. Review the details and contact us with any questions."},
vehicle_reservation:{subject:"Your vehicle reservation update",eyebrow:"VEHICLE COLLECTION",headline:"There is an update to your reservation.",body:"Your vehicle reservation details have been updated. Please review the information below."},
vehicle_availability:{subject:"An update about vehicle availability",eyebrow:"VEHICLE COLLECTION",headline:"There is an availability update.",body:"Our team has recorded an update about the vehicle you asked about. Confirm current availability with our team before making plans."},
vehicle_delivery:{subject:"Your vehicle delivery update",eyebrow:"VEHICLE COLLECTION",headline:"There is an update about delivery.",body:"We have an update relating to your vehicle delivery. Please review the details below or contact your Tesla Markets representative."},
investment_enquiry:{subject:"We received your investment enquiry",eyebrow:"INVESTMENT INFORMATION",headline:"Your enquiry is with our team.",body:"Thank you for reaching out. Our team will review your request and respond with relevant information. This acknowledgement is not an investment offer or confirmation."},
investment_follow_up:{subject:"Following up on your information request",eyebrow:"INVESTMENT INFORMATION",headline:"We are following up on your enquiry.",body:"Our team is checking in about your request for investment information. This message is informational and is not an investment offer."},
investment_information:{subject:"The information you requested",eyebrow:"INVESTMENT INFORMATION",headline:"Your requested information is available.",body:"We have an update to the information you requested. Please review the details and consider seeking independent professional advice."},
investment_status:{subject:"Your enquiry status has changed",eyebrow:"INVESTMENT ENQUIRY",headline:"There is an update to your enquiry.",body:"The status of your enquiry has changed. This is an administrative update, not a financial transaction or investment performance statement."},
investment_application:{subject:"We received your application",eyebrow:"INVESTMENT ENQUIRY",headline:"Your application has been received.",body:"We have recorded receipt of your application. Our team will review it and communicate any next steps. Receipt is not approval."},
portfolio_notification:{subject:"A portfolio notification",eyebrow:"ACCOUNT INFORMATION",headline:"There is an account update.",body:"A portfolio-related notification is available in your account. Sign in securely to review the actual account information."},
support_received:{subject:"We received your support request",eyebrow:"CUSTOMER CARE",headline:"Your message is with our team.",body:"Thank you for contacting Tesla Markets. A member of our team will review your message and respond as soon as possible."},
support_reply:{subject:"Tesla Markets support has replied",eyebrow:"CUSTOMER CARE",headline:"There is an update to your conversation.",body:"Our team has replied to your support conversation. Sign in to continue securely."},
chat_received:{subject:"We received your message",eyebrow:"CUSTOMER CARE",headline:"Your message is with Tesla Markets.",body:"Thank you for contacting our team. We have received your message and will follow up as soon as possible."},
missed_chat:{subject:"Following up on your chat",eyebrow:"CUSTOMER CARE",headline:"We are here if you still need help.",body:"We noticed your chat enquiry may not have been completed. Reply to this email if you would like our team to follow up."},
ticket_updated:{subject:"Your support request has an update",eyebrow:"CUSTOMER CARE",headline:"Your support request was updated.",body:"There is a new update to your support request. Sign in to view the conversation securely."},
ticket_resolved:{subject:"Your support request was resolved",eyebrow:"CUSTOMER CARE",headline:"Your support request is marked resolved.",body:"Our team has marked your support request as resolved. If you still need help, contact our team."},
feedback_request:{subject:"How was your Tesla Markets experience?",eyebrow:"CUSTOMER FEEDBACK",headline:"We would value your feedback.",body:"Your feedback helps us improve the experience. Share a few thoughts about your recent interaction."},
complaint_received:{subject:"We received your complaint",eyebrow:"CUSTOMER CARE",headline:"Your complaint has been recorded.",body:"We have received your complaint and will review it through the appropriate support process."},
support_escalated:{subject:"Your support request has been escalated",eyebrow:"CUSTOMER CARE",headline:"Your request has been escalated.",body:"Your support request has been referred for further review. Our team will share an update when available."},
getting_started:{subject:"Getting started with Tesla Markets",eyebrow:"GETTING STARTED",headline:"A few helpful next steps.",body:"Explore the marketplace, review available vehicle information and contact our team whenever you need assistance."},
post_purchase:{subject:"Thank you for choosing Tesla Markets",eyebrow:"CUSTOMER CARE",headline:"Thank you for your order.",body:"We appreciate your business. Keep your order reference handy and contact our team if you need support."},
review_request:{subject:"Tell us about your experience",eyebrow:"CUSTOMER FEEDBACK",headline:"Would you share a review?",body:"If you have a moment, we would appreciate an honest review of your experience with Tesla Markets."},
reengagement:{subject:"It has been a while",eyebrow:"A NOTE FROM TESLA MARKETS",headline:"Would you like to explore again?",body:"There may be new information and marketplace updates to explore. You are receiving this only because you opted in to updates."},
product_announcement:{subject:"New additions to Tesla Markets",eyebrow:"MARKETPLACE UPDATE",headline:"Something new has arrived.",body:"Explore the latest additions to the marketplace and review product information before making a decision."},
vehicle_promotion:{subject:"A vehicle update from Tesla Markets",eyebrow:"VEHICLE COLLECTION",headline:"Explore this vehicle feature.",body:"We are sharing a vehicle update you may find useful. Availability and pricing can change; confirm current details with our team."},
discount_announcement:{subject:"A selected marketplace offer",eyebrow:"SELECTED OFFER",headline:"A limited selection is on offer.",body:"Selected items may have promotional pricing. Discounts vary by product and campaign and are subject to availability."},
limited_offer:{subject:"A limited-time Tesla Markets offer",eyebrow:"LIMITED-TIME OFFER",headline:"Explore the current offer.",body:"This offer is available only during the stated campaign period and may be subject to eligibility and availability."},
seasonal_campaign:{subject:"A seasonal update from Tesla Markets",eyebrow:"MARKETPLACE UPDATE",headline:"A seasonal note from our team.",body:"Here is a seasonal update from Tesla Markets. Review current details and availability before making a decision."},
newsletter:{subject:"Tesla Markets update",eyebrow:"THE TESLA MARKETS EDIT",headline:"News, information and marketplace updates.",body:"Here is your latest opted-in update from Tesla Markets. You can manage your email preferences at any time."},
category_announcement:{subject:"An update from Tesla Markets",eyebrow:"MARKETPLACE UPDATE",headline:"There is news in a category you follow.",body:"We have an update about marketplace information you may find useful."},
campaign_follow_up:{subject:"A follow-up from Tesla Markets",eyebrow:"MARKETPLACE UPDATE",headline:"Following up on our recent update.",body:"We are following up on a recent opted-in update. Review the current information and manage your preferences at any time."},
admin_alert:{subject:"Tesla Markets admin notification",eyebrow:"MANAGEMENT NOTIFICATION",headline:"A new item needs attention.",body:"A new customer or operational event has been recorded. Sign in to the management console to review it."},
daily_summary:{subject:"Tesla Markets daily summary",eyebrow:"DAILY OPERATIONS",headline:"Your daily activity summary.",body:"The latest operational activity summary is ready for review."},
weekly_summary:{subject:"Tesla Markets weekly summary",eyebrow:"WEEKLY OPERATIONS",headline:"Your weekly activity summary.",body:"The latest weekly operational activity summary is ready for review."},
system_alert:{subject:"Tesla Markets system alert",eyebrow:"SYSTEM MONITORING",headline:"A system event needs attention.",body:"An automated system check recorded an issue. Review the management console and relevant logs."},
delivery_alert:{subject:"A delivery update",eyebrow:"DELIVERY MONITORING",headline:"There is a delivery update.",body:"A delivery status update has been recorded. Review the related order details."},
bounce_alert:{subject:"Email delivery alert",eyebrow:"EMAIL MONITORING",headline:"An email could not be delivered.",body:"The email system recorded a delivery issue. Review the recipient and provider event details."},
unsubscribe_confirmation:{subject:"Your email preferences were updated",eyebrow:"EMAIL PREFERENCES",headline:"Your preferences have been updated.",body:"Your email preference change has been recorded. Transactional account and order messages may still be sent when necessary."}
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const safeSite = /^https:\/\//i.test(siteUrl) ? siteUrl : "https://teslamarketsofficial.com";
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{"content-type":"application/json","cache-control":"no-store"}});


function renderEmail(row: any) {
  const p = row.payload || {};
  const t = emailCopy[row.event_type] || {
    subject: "An update from Tesla Markets",
    eyebrow: "CUSTOMER UPDATE",
    headline: "There is an update from our team.",
    body: "This is an update from Tesla Markets regarding your recent activity."
  };
  const details: Array<[string, unknown]> = [
    ["Reference",p.order_reference || p.reference],
    ["Vehicle",p.vehicle_model],
    ["Enquiry",p.opportunity],
    ["Category",p.category],
    ["Status",p.status],
    ["Payment method",p.payment_method],
    ["Tracking number",p.tracking_number],
    ["Tracking link",p.tracking_url],
    ["Notification",p.title],
    ["Message",p.body || p.review_note || p.customer_question || p.customer_note],
    ["Amount",p.amount != null ? String(p.currency || "USD") + " " + String(p.amount) : null]
  ].filter((x) => x[1] !== null && x[1] !== undefined && String(x[1]).trim() !== "");
  const detailHtml = details.length ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0;background:#f7f8fa;border:1px solid #e6e8eb;border-collapse:separate;border-radius:10px">' +
    details.map(([k,v]) => '<tr><td style="padding:13px 16px;color:#73777d;font-size:12px;line-height:1.45;border-bottom:1px solid #e6e8eb;width:36%">'+esc(k)+'</td><td style="padding:13px 16px;color:#17191c;font-size:13px;line-height:1.45;font-weight:700;border-bottom:1px solid #e6e8eb;text-align:right">'+esc(v)+'</td></tr>').join("") + '</table>' : "";
  const preview = esc(p.message_preview || "");
  const testBanner = p.test === true
    ? '<div style="margin:0 0 22px;padding:11px 14px;background:#fff5e8;border:1px solid #f3d3a8;border-radius:6px;color:#85520a;font-size:11px;font-weight:700;letter-spacing:1px">TEST MESSAGE · NO TRANSACTION CREATED</div>'
    : "";
  const logo = /^https:\/\//i.test(logoUrl)
    ? '<img src="'+esc(logoUrl)+'" alt="Tesla" width="94" style="display:block;width:94px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none">'
    : '';
  const ctaLabels: Record<string,string> = {
    welcome:"Explore Tesla Markets", order_received:"View order details", order_processing:"View order details",
    order_shipped:"Track your order", order_delivered:"View order details", order_cancelled:"Contact support",
    vehicle_enquiry:"Explore vehicles", investment_enquiry:"View your enquiry", support_reply:"Open support",
    support_received:"Visit Tesla Markets", admin_alert:"Open management console",
  };
  const cta = '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:29px 0 4px"><tr><td bgcolor="#e82127" style="border-radius:5px"><a href="'+esc(safeSite)+'" style="display:inline-block;padding:15px 25px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.4px;border-radius:5px">'+esc(ctaLabels[row.event_type] || "Open Tesla Markets")+' &nbsp; &#8594;</a></td></tr></table>';
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body bgcolor="#f0f1f3" style="margin:0;padding:28px 12px;background-color:#f0f1f3;font-family:Arial,Helvetica,sans-serif;color:#17191c;-webkit-text-size-adjust:100%"><span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden">'+esc(t.eyebrow)+' — Tesla Markets customer update.</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f0f1f3"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;width:100%;border-collapse:separate;border-spacing:0;background:#fff;border-radius:12px;overflow:hidden"><tr><td bgcolor="#090a0c" style="padding:25px 30px 23px;background-color:#090a0c;border-bottom:3px solid #e82127"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="112" valign="middle" style="width:112px;padding-right:18px">'+logo+'</td><td valign="middle"><div style="font-size:18px;line-height:1.25;font-weight:700;letter-spacing:2.4px;color:#fff">TESLA MARKETS</div><div style="margin-top:7px;font-size:9px;line-height:1.5;letter-spacing:2.1px;color:#c3c5c8">INVEST&nbsp;&nbsp;·&nbsp;&nbsp;SHOP&nbsp;&nbsp;·&nbsp;&nbsp;OWN TESLA</div></td></tr></table></td></tr><tr><td style="height:7px;line-height:7px;font-size:0;background:#f5f5f5">&nbsp;</td></tr><tr><td style="padding:42px 42px 40px;background:#fff">'+testBanner+'<div style="font-size:10px;line-height:1.5;font-weight:700;letter-spacing:2.3px;color:#d71920;text-transform:uppercase">'+esc(t.eyebrow)+'</div><h1 style="margin:15px 0 20px;font-size:32px;line-height:1.16;letter-spacing:-.7px;font-weight:700;color:#111418">'+esc(t.headline)+'</h1><p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#22262b">Hello '+esc(row.recipient_name || "there")+',</p><p style="margin:0;font-size:15px;line-height:1.85;color:#555b62">'+esc(t.body)+'</p>'+detailHtml+(preview ? '<p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#555b62">'+preview+'</p>' : '')+cta+'<p style="margin:34px 0 0;font-size:13px;line-height:1.75;color:#626870">If you need assistance, reply to this email or contact our support team.</p><p style="margin:21px 0 0;font-size:14px;line-height:1.7;color:#282d33">Kind regards,<br><strong style="color:#111418">Tesla Markets</strong></p></td></tr><tr><td bgcolor="#090a0c" style="padding:25px 32px;background-color:#090a0c;border-top:1px solid #26292d"><div style="font-size:11px;line-height:1.5;font-weight:700;letter-spacing:2.2px;color:#fff">TESLA MARKETS</div><p style="margin:9px 0 0;font-size:11px;line-height:1.7;color:#b7bbc0">Customer communication from <a href="mailto:'+esc(senderEmail)+'" style="color:#fff;text-decoration:none">'+esc(senderEmail)+'</a></p><p style="margin:9px 0 0;font-size:10px;line-height:1.6;color:#858b92">This message relates to your account, order or enquiry. Never share passwords, payment card details or gift-card codes by email.</p><p style="margin:14px 0 0;font-size:10px;line-height:1.5;color:#777e86"><a href="'+esc(safeSite)+'" style="color:#b9bec5;text-decoration:none">teslamarketsofficial.com</a></p></td></tr></table><div style="padding:15px 12px;font-size:10px;line-height:1.5;color:#868b91;text-align:center">TESLA MARKETS &nbsp;·&nbsp; CUSTOMER EXPERIENCE</div></td></tr></table></body></html>';
  const text = t.subject + "\n\n" + t.headline + "\n\nHello " + (row.recipient_name || "there") + ",\n\n" + t.body + "\n\n" +
    details.map(([k,v]) => k + ": " + String(v)).join("\n") + "\n\n" + "Tesla Markets: " + safeSite + "\n\nKind regards,\nTesla Markets";
  return { title:t.subject, html, text };
}


async function handleResendWebhook(event: any) {
  if (!event || typeof event.type !== "string" || typeof event.id !== "string") {
    return reply({error:"Invalid Resend event"},400);
  }
  const {data:duplicate} = await db.from("email_notification_events")
    .select("id").eq("provider_event_id",event.id).maybeSingle();
  if (duplicate) return reply({ok:true,duplicate:true});

  const payload = event.data || {};
  const emailId = payload.email_id || payload.id || null;
  let matched: {id:string;customer_id:string|null} | null = null;
  if (emailId) {
    const {data:outbox} = await db.from("email_notification_outbox")
      .select("id,customer_id").eq("provider_message_id",emailId).maybeSingle();
    matched = outbox || null;
  }

  const statusByEvent: Record<string,string> = {
    "email.sent":"sent",
    "email.delivered":"delivered",
    "email.delivery_delayed":"delayed",
    "email.bounced":"bounced",
    "email.complained":"complained",
    "email.failed":"failed",
    "email.suppressed":"suppressed"
  };
  const nextStatus = statusByEvent[event.type];
  if (matched && nextStatus) {
    const errorText = event.type === "email.bounced" || event.type === "email.failed" || event.type === "email.complained"
      ? JSON.stringify(payload).slice(0,900)
      : null;
    await db.from("email_notification_outbox").update({
      status:nextStatus,
      last_error:errorText,
      updated_at:new Date().toISOString()
    }).eq("id",matched.id);
  }
  if (matched?.customer_id && event.type === "email.complained") {
    await db.from("email_notification_preferences").update({
      unsubscribed_at:new Date().toISOString(),
      marketing_opt_in:false,
      product_updates_opt_in:false,
      abandoned_cart_opt_in:false,
      updated_at:new Date().toISOString()
    }).eq("customer_id",matched.customer_id);
  }

  const occurredAt = typeof event.created_at === "string" && !Number.isNaN(Date.parse(event.created_at))
    ? event.created_at : new Date().toISOString();
  const {error:insertError} = await db.from("email_notification_events").insert({
    outbox_id:matched?.id || null,
    provider_event_id:event.id,
    event_type:event.type,
    event_data:payload,
    occurred_at:occurredAt
  });
  if (insertError) return reply({error:"Could not record Resend delivery event"},500);
  return reply({ok:true,recorded:true});
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({error:"POST required"},405);
  const supplied = req.headers.get("x-cron-secret") || "";
  const {data:expected,error:secretError} = await db.rpc("get_tesla_email_cron_secret");
  if (secretError || !expected || supplied !== expected) return reply({error:"Unauthorized"},401);
  const requestBody = await req.json().catch(() => ({}));
  if (requestBody?.kind === "resend-webhook") return handleResendWebhook(requestBody.event);
  if (!senderEmail || !resendRelayUrl) return reply({error:"Transactional email relay is not configured."},503);

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  // Recover jobs abandoned by a crashed worker. Attempts remain capped at five.
  await db.from("email_notification_outbox").update({
    status:"queued", scheduled_at:now.toISOString(), updated_at:now.toISOString(),
    last_error:"Recovered stale processing job"
  }).eq("status","processing").lt("attempts",5).lt("updated_at",staleBefore);
  await db.from("email_notification_outbox").update({
    status:"failed", last_error:"Maximum attempts reached after worker interruption", updated_at:now.toISOString()
  }).eq("status","processing").gte("attempts",5).lt("updated_at",staleBefore);

  // Resend's free daily allowance is 100. Keep ten sends in reserve for operational tests.
  const utcDayStart = new Date();
  utcDayStart.setUTCHours(0,0,0,0);
  const {count:sentToday,error:countError} = await db.from("email_notification_outbox")
    .select("id",{count:"exact",head:true}).gte("sent_at",utcDayStart.toISOString());
  if (countError) return reply({error:"Unable to check the daily email allowance"},500);
  const remainingDaily = Math.max(0,90-(sentToday || 0));
  if (remainingDaily === 0) return reply({ok:true,processed:0,sent:0,failed:0,suppressed:0,dailyCapReached:true});

  const {data:rows,error} = await db.from("email_notification_outbox")
    .select("id,event_key,event_type,recipient_email,recipient_name,customer_id,payload,category,attempts")
    .eq("status","queued").lte("scheduled_at",now.toISOString()).lt("attempts",5)
    .order("created_at",{ascending:true}).limit(Math.min(10,remainingDaily));
  if (error) return reply({error:"Unable to load email queue"},500);

  let sent=0,failed=0,suppressed=0;
  for (const row of rows || []) {
    const nextAttempt = (row.attempts || 0) + 1;
    const {data:claimed,error:claimError} = await db.from("email_notification_outbox")
      .update({status:"processing",attempts:nextAttempt,updated_at:new Date().toISOString()})
      .eq("id",row.id).eq("status","queued").select("id").maybeSingle();
    if (claimError || !claimed) continue;
    try {
      const marketingOnlyKinds = new Set(["abandoned_cart","cart_reminder","abandoned_checkout","reengagement","product_announcement","vehicle_promotion","discount_announcement","limited_offer","seasonal_campaign","newsletter","campaign_follow_up","feedback_request","review_request"]);
      if (marketingOnlyKinds.has(row.event_type) && row.category !== "marketing") {
        await db.from("email_notification_outbox").update({status:"suppressed",updated_at:new Date().toISOString(),last_error:"Marketing event requires explicit marketing consent"}).eq("id",row.id);
        await db.from("email_notification_events").insert({outbox_id:row.id,event_type:"suppressed",event_data:{reason:"Marketing event must not use transactional category"}});
        suppressed++; continue;
      }
      if (row.category === "marketing") {
        const {data:prefs} = row.customer_id ? await db.from("email_notification_preferences")
          .select("marketing_opt_in,abandoned_cart_opt_in,unsubscribed_at").eq("customer_id",row.customer_id).maybeSingle() : {data:null};
        if (!prefs || (row.event_type === "abandoned_cart" ? !prefs.abandoned_cart_opt_in : !prefs.marketing_opt_in) || prefs.unsubscribed_at) {
          await db.from("email_notification_outbox").update({status:"suppressed",updated_at:new Date().toISOString()}).eq("id",row.id);
          await db.from("email_notification_events").insert({outbox_id:row.id,event_type:"suppressed",event_data:{reason:"No active marketing consent"}});
          suppressed++; continue;
        }
      }
      const {title,html,text} = renderEmail(row);
      const resp = await fetch(resendRelayUrl,{
        method:"POST",
        headers:{
          "content-type":"application/json",
          "accept":"application/json",
          "x-cron-secret":supplied,
          "idempotency-key":"tesla-" + row.event_key
        },
        body:JSON.stringify({
          to:row.recipient_email,
          subject:title,
          text,
          html,
          eventKey:row.event_key,
          eventType:row.event_type
        })
      });
      const result = await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error((result.error || result.message || "Resend relay rejected email") + " (HTTP " + resp.status + ")");
      await db.from("email_notification_outbox").update({
        status:"sent",provider_message_id:result.id || null,sent_at:new Date().toISOString(),
        last_error:null,updated_at:new Date().toISOString()
      }).eq("id",row.id);
      await db.from("email_notification_events").insert({
        outbox_id:row.id,event_type:"sent",
        event_data:{provider:"resend",provider_message_id:result.id || null}
      });
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Email send failed";
      const permanentClientError = /HTTP 4(?!29)\\d{2}/.test(message);
      const retry = nextAttempt < 5 && !permanentClientError;
      const delayMinutes = Math.min(60, 2 ** nextAttempt);
      await db.from("email_notification_outbox").update({
        status:retry ? "queued" : "failed",
        scheduled_at:retry ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString() : row.scheduled_at,
        last_error:message.slice(0,900),updated_at:new Date().toISOString()
      }).eq("id",row.id);
      await db.from("email_notification_events").insert({
        outbox_id:row.id,event_type:retry ? "retry_scheduled" : "send_failed",
        event_data:{message:message.slice(0,500),attempt:nextAttempt,retry_in_minutes:retry ? delayMinutes : null}
      });
      failed++;
    }
  }
  return reply({ok:true,processed:sent+failed+suppressed,sent,failed,suppressed});
});