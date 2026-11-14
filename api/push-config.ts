export default function handler(request: { method?: string }, response: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void }) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Origin', '*');
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET');
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const publicKey = process.env.TESLA_PUSH_VAPID_PUBLIC_KEY || '';
  if (!publicKey) {
    response.statusCode = 503;
    response.end(JSON.stringify({ error: 'Push notifications are not configured' }));
    return;
  }
  response.statusCode = 200;
  response.end(JSON.stringify({ publicKey }));
}
