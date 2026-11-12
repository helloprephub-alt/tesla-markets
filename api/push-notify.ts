import webpush from 'web-push';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type IncomingRequest = IncomingMessage & { body?: unknown };

export default async function handler(request: IncomingRequest, response: ServerResponse) {
  const send = (status: number, data: Record<string, unknown>) => {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(data));
  };

  if (request.method !== 'POST') return send(405, { error: 'Method not allowed' });
  const expected = process.env.TESLA_PUSH_WEBHOOK_SECRET || '';
  const header = request.headers['x-tesla-push-secret'];
  const supplied = Array.isArray(header) ? header[0] || '' : header || '';
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (!expected || !supplied || expectedBytes.length !== suppliedBytes.length ||
      !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return send(401, { error: 'Unauthorized' });
  }

  const publicKey = process.env.TESLA_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.TESLA_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return send(503, { error: 'Push keys are not configured' });

  let payload: {
    record?: { id?: string; body?: string; conversation_id?: string; customer_name?: string; customer_email?: string };
    subscriptions?: PushSubscriptionRecord[];
  } | null = null;
  try {
    payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body as typeof payload;
  } catch {
    return send(400, { error: 'Invalid JSON body' });
  }
  if (!payload?.record || !Array.isArray(payload.subscriptions)) {
    return send(400, { error: 'Invalid webhook payload' });
  }

  webpush.setVapidDetails('mailto:oyejideoluwatobi7@gmail.com', publicKey, privateKey);
  const body = (payload.record.body || 'A customer sent a new message.').replace(/\s+/g, ' ').slice(0, 180);
  const message = JSON.stringify({
    title: `New message · ${payload.record.customer_name || 'Customer'}`,
    body,
    tag: payload.record.id || 'tesla-customer-message',
    url: `/#admin?conversation=${encodeURIComponent(payload.record.conversation_id || '')}`,
    conversationId: payload.record.conversation_id
  });

  const results = await Promise.allSettled(payload.subscriptions.map(subscription =>
    webpush.sendNotification(subscription, message, { TTL: 60 * 60 * 24 * 28, urgency: 'high' })
  ));
  const sent = results.filter(result => result.status === 'fulfilled').length;
  const failed = results.length - sent;
  return send(200, { ok: true, sent, failed });
}
