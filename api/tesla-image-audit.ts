import { storeProducts } from '../src/marketplace-catalog';

type Request = { method?: string; query?: Record<string, string | string[] | undefined> };
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; json(body: unknown): void };

export default async function handler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
  const images = [...new Set(storeProducts.flatMap(product => [product.image, ...(product.gallery || [])]).filter((value): value is string => Boolean(value)))];
  const batch = Math.max(0, Number.parseInt(String(req.query?.batch || '0'), 10) || 0);
  const size = 12;
  const slice = images.slice(batch * size, (batch + 1) * size);
  const results = await Promise.all(slice.map(async source => {
    try {
      const host = new URL(source).hostname;
      const referer = host === 'www.eco-worthy.com' ? 'https://www.eco-worthy.com/' : 'https://shop.tesla.com/';
      const response = await fetch(source, { headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8', Referer: referer, 'User-Agent': 'Mozilla/5.0 TeslaMarketsImageAudit' } });
      const type = response.headers.get('content-type') || '';
      const bytes = await response.arrayBuffer();
      return { source, status: response.status, contentType: type, bytes: bytes.byteLength, ok: response.ok && type.toLowerCase().startsWith('image/') && bytes.byteLength > 0 };
    } catch (error) {
      return { source, status: 0, contentType: '', bytes: 0, ok: false, error: error instanceof Error ? error.message : 'Fetch failed' };
    }
  }));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ total: images.length, batch, batchCount: Math.ceil(images.length / size), checked: results.length, passed: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok) });
}
