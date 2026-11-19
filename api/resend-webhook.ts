import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Request = IncomingMessage;
export const config = { api: { bodyParser: false } };

function respond(res: ServerResponse, status: number, value: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function header(req: IncomingMessage, key: string): string {
  const value = req.headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function verifySvix(secret: string, id: string, timestamp: string, signatureHeader: string, rawBody: string) {
  if (!secret.startsWith('whsec_') || !id || !timestamp || !signatureHeader) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const key = Buffer.from(secret.slice(6), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
  return signatureHeader.split(' ').some(part => {
    const [version, candidate] = part.split(',', 2);
    if (version !== 'v1' || !candidate) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(candidate);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export default async function handler(req: Request, res: ServerResponse) {
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed' });

  const signingSecret = process.env.RESEND_WEBHOOK_SECRET || '';
  const workerSecret = process.env.TESLA_EMAIL_WORKER_SECRET || '';
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!signingSecret || !workerSecret || !supabaseUrl || !supabaseAnonKey) {
    return respond(res, 503, { error: 'Webhook forwarding is not configured.' });
  }

  try {
    const rawBody = await readRawBody(req);
    const valid = verifySvix(
      signingSecret,
      header(req, 'svix-id'),
      header(req, 'svix-timestamp'),
      header(req, 'svix-signature'),
      rawBody
    );
    if (!valid) return respond(res, 401, { error: 'Invalid webhook signature.' });

    const event = JSON.parse(rawBody);
    const response = await fetch(`${supabaseUrl}/functions/v1/tesla-email-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'x-cron-secret': workerSecret
      },
      body: JSON.stringify({ kind: 'resend-webhook', event }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return respond(res, 502, { error: 'The delivery event could not be recorded.' });
    return respond(res, 200, { received: true });
  } catch {
    return respond(res, 400, { error: 'The webhook payload could not be processed.' });
  }
}
