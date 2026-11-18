import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';

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
  const senderName = process.env.BREVO_SENDER_NAME || 'Tesla Markets';
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey || !senderEmail || !supabaseUrl || !supabaseAnonKey) {
    return send(503, { error: 'Email service is not fully configured. A verified BREVO_SENDER_EMAIL and Supabase settings are required.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return send(401, { error: 'Authentication required' });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return send(401, { error: 'Invalid session' });

  const user = data.user;
  const email = user.email;
  if (!email) return send(400, { error: 'Customer email is unavailable' });
  const metadata = user.user_metadata || {};
  const name = String(metadata.name || 'there').trim().slice(0, 100);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name }],
        subject: 'Welcome to Tesla Markets',
        textContent: `Hello ${name},\n\nWelcome to Tesla Markets. Your customer account has been created successfully. You can now explore our vehicle marketplace and contact our team whenever you need assistance.\n\nThank you,\nTesla Markets Support`,
        htmlContent: `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#171717"><div style="max-width:600px;margin:32px auto;background:#fff;padding:40px 32px"><div style="font-size:18px;font-weight:700;letter-spacing:3px">TESLA MARKETS</div><h1 style="font-size:28px;margin:36px 0 16px">Welcome, ${escapeHtml(name)}.</h1><p style="line-height:1.7;color:#555">Your customer account has been created successfully. You can now explore our vehicle marketplace and contact our team whenever you need assistance.</p><p style="margin-top:32px;color:#555">Thank you,<br><strong>Tesla Markets Support</strong></p></div></body></html>`
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return send(response.status >= 500 ? 502 : response.status, { error: 'Brevo could not accept the welcome email.', providerStatus: response.status, details: result.message || result.code || 'Provider rejected the request' });
    return send(200, { ok: true, messageId: result.messageId || null });
  } catch {
    return send(502, { error: 'Could not connect to Brevo.' });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}
