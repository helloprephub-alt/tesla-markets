import { Buffer } from 'node:buffer';

type Request = { method?: string; query?: Record<string, string | string[] | undefined> };
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; send(body: string | Buffer): void };

const allowedImagePaths: Record<string, string> = {
  'digitalassets-shop.tesla.com': '/image/upload/',
  'digitalassets-shop.tesla.cn': '/image/upload/',
  'www.eco-worthy.com': '/cdn/shop/files/',
};

export default async function handler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send('Method not allowed');
    return;
  }

  const raw = typeof req.query?.url === 'string' ? req.query.url : '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    res.status(400).send('Invalid image URL');
    return;
  }

  const allowedPath = allowedImagePaths[target.hostname];
  if (target.protocol !== 'https:' || !allowedPath || !target.pathname.startsWith(allowedPath)) {
    res.status(403).send('Image source not allowed');
    return;
  }

  try {
    const referer = target.hostname === 'www.eco-worthy.com' ? 'https://www.eco-worthy.com/' : 'https://shop.tesla.com/';
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        Referer: referer,
        'User-Agent': 'Mozilla/5.0 TeslaMarketsImageProxy',
      },
    });

    if (!upstream.ok) {
      res.status(502).send('Image source returned ' + upstream.status);
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      res.status(502).send('Source did not return an image');
      return;
    }

    const imageBytes = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(imageBytes.byteLength));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(req.method === 'HEAD' ? Buffer.alloc(0) : imageBytes);
  } catch {
    res.status(502).send('Image could not be loaded');
  }
}
