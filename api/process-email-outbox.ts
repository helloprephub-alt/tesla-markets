import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderTeslaEmail, type EmailTemplateKind } from './_lib/tesla-email-templates';
import { translateTeslaEmailPayload } from './_lib/tesla-email-translation';

type Request = IncomingMessage & { body?: unknown };
type OutboxRow = {
  id: string; event_key: string; event_type: string; recipient_email: string;
  recipient_name: string | null; customer_id: string | null; payload: Record<string, unknown>;
  category: string; attempts: number;
};

const kindMap: Record<string, EmailTemplateKind> = {
  order_received: 'order_received', payment_pending: 'payment_pending',
  payment_approved: 'payment_approved', payment_rejected: 'payment_rejected',
  order_processing: 'order_processing', order_shipped: 'order_shipped',
  order_delivered: 'order_delivered', order_cancelled: 'order_cancelled',
  vehicle_enquiry: 'vehicle_enquiry', investment_enquiry: 'investment_enquiry',
  support_received: 'support_received', support_reply: 'support_reply',
  password_changed: 'password_changed', profile_updated: 'profile_updated',
  email_verification: 'email_verification', password_reset: 'password_reset', account_recovery: 'account_recovery', account_closed: 'account_closed',
  order_updated: 'order_updated', invoice_ready: 'invoice_ready', refund_update: 'refund_update',
  gift_card_received: 'gift_card_received', gift_card_review: 'gift_card_review', gift_card_approved: 'gift_card_approved', gift_card_rejected: 'gift_card_rejected',
  vehicle_follow_up: 'vehicle_follow_up', vehicle_quote: 'vehicle_quote', vehicle_reservation: 'vehicle_reservation',
  investment_follow_up: 'investment_follow_up', investment_information: 'investment_information', investment_status: 'investment_status',
  chat_received: 'chat_received', ticket_updated: 'ticket_updated', ticket_resolved: 'ticket_resolved', feedback_request: 'feedback_request',
  getting_started: 'getting_started', post_purchase: 'post_purchase', review_request: 'review_request', reengagement: 'reengagement',
  product_announcement: 'product_announcement', vehicle_promotion: 'vehicle_promotion', discount_announcement: 'discount_announcement',
  limited_offer: 'limited_offer', newsletter: 'newsletter', admin_alert: 'admin_alert', daily_summary: 'daily_summary', system_alert: 'system_alert'
};

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, 500) : value == null ? fallback : String(value).slice(0, 500);
}

export default async function handler(req: Request, res: ServerResponse) {
  const send = (status: number, body: Record<string, unknown>) => {
    res.statusCode = status; res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
  const workerSecret = process.env.TESLA_EMAIL_WORKER_SECRET || process.env.CRON_SECRET;
  const supplied = req.headers.authorization?.replace(/^Bearer\\s+/i, '') || '';
  if (!workerSecret || supplied !== workerSecret) return send(401, { error: 'Unauthorized' });

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!url || !serviceKey || !apiKey || !senderEmail) return send(503, { error: 'Email worker configuration is incomplete.' });

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await db.from('email_notification_outbox')
    .select('id,event_key,event_type,recipient_email,recipient_name,customer_id,payload,category,attempts')
    .in('status', ['queued','failed']).lte('scheduled_at', new Date().toISOString())
    .lt('attempts', 5).order('created_at', { ascending: true }).limit(20);
  if (error) return send(500, { error: 'Could not load queued email events.' });

  let sent = 0, failed = 0, suppressed = 0;
  for (const row of (rows || []) as OutboxRow[]) {
    const { data: claimed } = await db.from('email_notification_outbox').update({
      status: 'processing', attempts: row.attempts + 1, updated_at: new Date().toISOString()
    }).eq('id', row.id).in('status', ['queued','failed']).select('id').maybeSingle();
    if (!claimed) continue;

    try {
      if (row.category === 'marketing') {
        const { data: prefs } = row.customer_id
          ? await db.from('email_notification_preferences').select('marketing_opt_in,product_updates_opt_in,unsubscribed_at').eq('customer_id', row.customer_id).maybeSingle()
          : { data: null };
        if (!prefs || prefs.unsubscribed_at || !prefs.marketing_opt_in) {
          await db.from('email_notification_outbox').update({ status: 'suppressed', updated_at: new Date().toISOString() }).eq('id', row.id);
          await db.from('email_notification_events').insert({ outbox_id: row.id, event_type: 'suppressed', event_data: { reason: 'No active marketing consent' } });
          suppressed++; continue;
        }
      }

      const kind = kindMap[row.event_type];
      if (!kind) throw new Error('Unsupported email event type: ' + row.event_type);
      const p = row.payload || {};
      const reference = safeString(p.order_reference || p.reference || p.enquiry_id || p.order_id);
      const status = safeString(p.status);
      const amount = p.subtotal == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: safeString(p.currency, 'USD') }).format(Number(p.subtotal));
      const detailParts = [
        p.review_note ? 'Review note: ' + safeString(p.review_note) : '',
        p.vehicle_model ? 'Vehicle: ' + safeString(p.vehicle_model) : '',
        p.opportunity ? 'Enquiry: ' + safeString(p.opportunity) : '',
        p.tracking_number ? 'Tracking number: ' + safeString(p.tracking_number) : '',
        p.tracking_url ? 'Tracking: ' + safeString(p.tracking_url) : ''
      ].filter(Boolean);
      const detail = detailParts.join(' | ');
      const { data: languageProfile } = row.customer_id
        ? await db.from('customer_profiles').select('preferred_language').eq('id', row.customer_id).maybeSingle()
        : { data: null };
      const preferredLanguage = safeString(languageProfile?.preferred_language, 'en');
      const localized = await translateTeslaEmailPayload(db, preferredLanguage, kind, { status, detail });
      const message = renderTeslaEmail({
        kind, customerName: row.recipient_name || 'there', reference, status, amount,
        detail,
        localizedCopy: localized?.localizedCopy,
        localizedDetail: localized?.localizedDetail,
        localizedStatus: localized?.localizedStatus,
        actionUrl: process.env.TESLA_MARKETS_SITE_URL || 'https://teslamarketsofficial.com'
      });
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: process.env.BREVO_SENDER_NAME || 'Tesla', email: senderEmail },
          to: [{ email: row.recipient_email, name: row.recipient_name || undefined }],
          subject: message.subject, textContent: message.text, htmlContent: message.html,
          headers: { 'X-Tesla-Event-Key': row.event_key }
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(safeString(result.message, 'Brevo rejected email (' + response.status + ')'));
      await db.from('email_notification_outbox').update({
        status: 'sent', provider_message_id: result.messageId || null,
        sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString()
      }).eq('id', row.id);
      await db.from('email_notification_events').insert({
        outbox_id: row.id, provider_event_id: result.messageId || null,
        event_type: 'sent', event_data: { provider: 'brevo' }
      });
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown email delivery error';
      await db.from('email_notification_outbox').update({
        status: 'failed', last_error: message.slice(0, 1000), updated_at: new Date().toISOString()
      }).eq('id', row.id);
      await db.from('email_notification_events').insert({
        outbox_id: row.id, event_type: 'send_failed', event_data: { message: message.slice(0, 500) }
      });
      if (message.startsWith('Email translation') && row.attempts + 1 >= 5) {
        const { error: noticeError } = await db.from('admin_notifications').insert({
          type: 'email_translation_failure',
          title: 'Multilingual email held after repeated translation failures',
          body: ('The ' + row.event_type + ' email could not be prepared in the customer\'s saved language after five attempts. Review the translation service and retry the email.').slice(0, 240),
          entity_type: 'email_outbox',
          entity_id: row.id,
          is_read: false
        });
        if (noticeError) console.error('Could not create email translation failure notification:', noticeError.message);
      }
      failed++;
    }
  }
  return send(200, { ok: true, processed: sent + failed + suppressed, sent, failed, suppressed });
}
