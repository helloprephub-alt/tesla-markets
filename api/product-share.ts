import { storeProducts, getDiscountedPrice } from '../src/marketplace-catalog';

type Request = { method?: string; query?: Record<string, string | string[] | undefined>; headers?: Record<string, string | string[] | undefined> };
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; send(body: string): void };

const PRODUCTION_SITE = 'https://teslamarketsofficial.com';
const getSite = (req: Request) => {
  const rawHost = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  const host = (Array.isArray(rawHost) ? rawHost[0] || '' : rawHost).split(',')[0].trim().toLowerCase();
  if (host === 'teslamarketsofficial.com' || host === 'www.teslamarketsofficial.com') return PRODUCTION_SITE;
  if (/^[a-z0-9.-]+\\.vercel\\.app$/.test(host)) return 'https://' + host;
  return PRODUCTION_SITE;
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char);
const getOne = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';

export default function handler(req: Request, res: Response): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send('Method not allowed');
    return;
  }
  const SITE = getSite(req);
  const id = getOne(req.query?.productId);
  const product = storeProducts.find(item => item.id === id);
  if (!product) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(404).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Product not found | Tesla Markets</title></head><body><h1>Product not found</h1><a href="/">Visit Tesla Markets</a></body></html>');
    return;
  }

  const canonical = SITE + '/product/' + encodeURIComponent(product.id);
  const target = SITE + '/?page=shop&product=' + encodeURIComponent(product.id);
  const price = getDiscountedPrice(product);
  const descriptionText = [product.description, price !== null ? 'Listed price: $' + price.toLocaleString('en-US') + '.' : 'Price on request.'].filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 220);
  const title = product.name + ' | Tesla Markets';
  const image = product.image || SITE + '/icons/tesla-app-icon-512.png';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(title) + '</title>' +
    '<meta name="description" content="' + escapeHtml(descriptionText) + '">' +
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">' +
    '<meta property="og:type" content="product"><meta property="og:site_name" content="Tesla Markets">' +
    '<meta property="og:title" content="' + escapeHtml(product.name) + '">' +
    '<meta property="og:description" content="' + escapeHtml(descriptionText) + '">' +
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">' +
    '<meta property="og:image" content="' + escapeHtml(image) + '">' +
    '<meta property="og:image:alt" content="' + escapeHtml(product.name + ' product photo') + '">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + escapeHtml(product.name) + '">' +
    '<meta name="twitter:description" content="' + escapeHtml(descriptionText) + '"><meta name="twitter:image" content="' + escapeHtml(image) + '">' +
    '<meta http-equiv="refresh" content="1;url=' + escapeHtml(target) + '">' +
    '<script>window.setTimeout(function(){window.location.replace(' + JSON.stringify(target) + ')},150);</script>' +
    '</head><body><main><h1>' + escapeHtml(product.name) + '</h1><p>' + escapeHtml(descriptionText) + '</p><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" style="max-width:100%;height:auto"><p><a href="' + escapeHtml(target) + '">Open product details</a></p></main></body></html>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(html);
}
