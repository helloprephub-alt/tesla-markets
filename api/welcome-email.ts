import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderTeslaEmail } from './_lib/tesla-email-templates.js';
import { translateTeslaEmailPayload } from './_lib/tesla-email-translation.js';

type Request = IncomingMessage & { body?: unknown };

export default async function handler(req: Request, res: ServerResponse) {
  const send = (status: number, body: Record<string, unknown>) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Tesla';
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey || !senderEmail || !supabaseUrl || !supabaseAnonKey) {
    return send(503, { error: 'Email service is not fully configured.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return send(401, { error: 'Authentication required' });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return send(401, { error: 'Invalid session' });

  const email = data.user.email;
  if (!email) return send(400, { error: 'Customer email is unavailable' });
  const metadata = data.user.user_metadata || {};
  const name = String(metadata.name || metadata.full_name || 'there').trim().slice(0, 100);

  try {
    const { data: profile } = await supabase.from('customer_profiles')
      .select('preferred_language').eq('id', data.user.id).maybeSingle();
    const preferredLanguage = String(profile?.preferred_language || 'en');
    const localized = await translateTeslaEmailPayload(
      supabase,
      preferredLanguage,
      'welcome',
      {},
      'Bearer ' + token
    );
    const message = renderTeslaEmail({
      kind: 'welcome',
      customerName: name,
      localizedCopy: localized?.localizedCopy,
      localizedDetail: localized?.localizedDetail,
      localizedStatus: localized?.localizedStatus,
      actionUrl: process.env.TESLA_MARKETS_SITE_URL || 'https://teslamarketsofficial.com'
    });
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return send(response.status >= 500 ? 502 : response.status, {
        error: 'Brevo could not accept the welcome email.',
        providerStatus: response.status,
        details: result.message || result.code || 'Provider rejected the request'
      });
    }
    return send(200, { ok: true, messageId: result.messageId || null });
  } catch {
    return send(502, { error: 'Could not connect to Brevo.' });
  }
}
