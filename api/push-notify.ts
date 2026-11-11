import webpush from 'web-push';

type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const expected = process.env.TESLA_PUSH_WEBHOOK_SECRET;
  const supplied = request.headers.get('x-tesla-push-secret');
  if (!expected || !supplied || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const publicKey = process.env.TESLA_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.TESLA_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return Response.json({ error: 'Push keys are not configured' }, { status: 503 });

  const payload = await request.json().catch(() => null) as {
    record?: { id?: string; body?: string; conversation_id?: string };
    subscriptions?: PushSubscriptionRecord[];
  } | null;
  if (!payload?.record || !Array.isArray(payload.subscriptions)) {
    return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }

  webpush.setVapidDetails('mailto:oyejideoluwatobi7@gmail.com', publicKey, privateKey);
  const body = (payload.record.body || 'A customer sent a new message.').replace(/\\s+/g, ' ').slice(0, 180);
  const message = JSON.stringify({
    title: 'New Tesla Markets customer message',
    body,
    tag: payload.record.id || 'tesla-customer-message',
    url: '/#admin',
    conversationId: payload.record.conversation_id
  });

  const results = await Promise.allSettled(payload.subscriptions.map(subscription =>
    webpush.sendNotification(subscription, message, { TTL: 60 * 60, urgency: 'high' })
  ));
  const sent = results.filter(result => result.status === 'fulfilled').length;
  const failed = results.length - sent;
  return Response.json({ ok: true, sent, failed }, { status: 200 });
}
