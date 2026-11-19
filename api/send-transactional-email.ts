import type { IncomingMessage, ServerResponse } from 'node:http';

type Request = IncomingMessage & { body?: unknown };
type EmailBody = {
  to?: unknown;
  subject?: unknown;
  html?: unknown;
  text?: unknown;
  eventKey?: unknown;
  eventType?: unknown;
};

function respond(res: ServerResponse, status: number, value: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function constantTimeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export default async function handler(req: Request, res: ServerResponse) {
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed' });

  const expected = process.env.TESLA_EMAIL_WORKER_SECRET || '';
  const supplied = typeof req.headers['x-cron-secret'] === 'string' ? req.headers['x-cron-secret'] : '';
  if (!constantTimeEqual(supplied, expected)) return respond(res, 401, { error: 'Unauthorized' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return respond(res, 503, { error: 'Resend is not configured on this deployment.' });

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as EmailBody;
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body.html === 'string' ? body.html : '';
  const text = typeof body.text === 'string' ? body.text : '';
  const eventKey = typeof body.eventKey === 'string' ? body.eventKey.slice(0, 220) : '';

  if (!to || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(to) || !subject || (!html && !text)) {
    return respond(res, 400, { error: 'A valid recipient, subject and message body are required.' });
  }

  const fromEmail = process.env.TESLA_MARKETS_EMAIL_FROM || 'support@teslamarketsofficial.com';
  const fromName = process.env.TESLA_MARKETS_EMAIL_SENDER_NAME || 'Tesla Markets';
  const suppliedIdempotency = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : '';
  const idempotencyKey = (suppliedIdempotency || (eventKey ? `tesla-${eventKey}` : '')).slice(0, 250);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        tags: [
          { name: 'source', value: 'tesla-markets-outbox' },
          { name: 'event', value: (typeof body.eventType === 'string' ? body.eventType : 'notification').slice(0, 50) }
        ]
      }),
      signal: controller.signal
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return respond(res, response.status, {
        error: typeof result.message === 'string' ? result.message : 'Resend rejected the email request.',
        code: result.name || result.statusCode || null
      });
    }
    return respond(res, 200, { ok: true, provider: 'resend', id: result.id || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resend request failed';
    return respond(res, 502, {
      error: message === 'This operation was aborted' ? 'Resend request timed out.' : 'Could not connect to Resend.'
    });
  } finally {
    clearTimeout(timeout);
  }
}
