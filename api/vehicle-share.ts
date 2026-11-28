type Request = { method?: string; query?: Record<string, string | string[] | undefined>; headers?: Record<string, string | string[] | undefined> };
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; send(body: string): void };

const PRODUCTION_SITE = 'https://teslamarketsofficial.com';
const getSite = (req: Request) => {
  const rawHost = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  const host = (Array.isArray(rawHost) ? rawHost[0] || '' : rawHost).split(',')[0].trim().toLowerCase();
  if (host === 'teslamarketsofficial.com' || host === 'www.teslamarketsofficial.com') return PRODUCTION_SITE;
  if (/^[a-z0-9.-]+\.vercel\.app$/.test(host)) return 'https://' + host;
  return PRODUCTION_SITE;
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char);
const getOne = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
const vehicles: Record<string, { name: string; subtitle: string; price: string; image: string; description: string }> = {
  'model-3': { name: 'Tesla Model 3', subtitle: 'Electric sedan', price: '$36,990', image: '/resources/model-3-1.jpg', description: 'Explore Model 3 versions, features and vehicle enquiry details at Tesla Markets.' },
  'model-y': { name: 'Tesla Model Y', subtitle: 'Electric SUV', price: '$39,990', image: '/resources/model-y-1.jpg', description: 'Explore Model Y versions, features and vehicle enquiry details at Tesla Markets.' },
  cybertruck: { name: 'Tesla Cybertruck', subtitle: 'All-electric utility vehicle', price: '$74,990', image: '/resources/cybertruck-1.jpg', description: 'Explore Cybertruck versions, features and vehicle enquiry details at Tesla Markets.' },
  roadster: { name: 'Tesla Roadster', subtitle: 'Next-generation electric sports car', price: '$45,000', image: '/resources/roadster-2.jpg', description: 'Explore Roadster information and vehicle enquiry details at Tesla Markets.' },
  semi: { name: 'Tesla Semi', subtitle: 'All-electric heavy-duty truck', price: '$260,000', image: '/resources/semi-1.jpg', description: 'Explore Tesla Semi information and commercial vehicle enquiry details at Tesla Markets.' },
};

export default function handler(req: Request, res: Response): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send('Method not allowed');
    return;
  }
  const SITE = getSite(req);
  const id = getOne(req.query?.modelId);
  const vehicle = vehicles[id];
  if (!vehicle) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(404).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Vehicle not found | Tesla Markets</title></head><body><h1>Vehicle not found</h1><a href="/">Visit Tesla Markets</a></body></html>');
    return;
  }
  const canonical = SITE + '/vehicle/' + encodeURIComponent(id);
  const target = SITE + '/?page=' + encodeURIComponent(id);
  const image = SITE + vehicle.image;
  const descriptionText = vehicle.description + ' Listed starting price: ' + vehicle.price + '.';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(vehicle.name) + ' | Tesla Markets</title>' +
    '<meta name="description" content="' + escapeHtml(descriptionText) + '">' +
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Tesla Markets">' +
    '<meta property="og:title" content="' + escapeHtml(vehicle.name) + '">' +
    '<meta property="og:description" content="' + escapeHtml(descriptionText) + '">' +
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">' +
    '<meta property="og:image" content="' + escapeHtml(image) + '">' +
    '<meta property="og:image:alt" content="' + escapeHtml(vehicle.name + ' vehicle photo') + '">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + escapeHtml(vehicle.name) + '">' +
    '<meta name="twitter:description" content="' + escapeHtml(descriptionText) + '"><meta name="twitter:image" content="' + escapeHtml(image) + '">' +
    '<meta http-equiv="refresh" content="1;url=' + escapeHtml(target) + '">' +
    '<script>window.setTimeout(function(){window.location.replace(' + JSON.stringify(target) + ')},150);</script>' +
    '</head><body><main><h1>' + escapeHtml(vehicle.name) + '</h1><p>' + escapeHtml(descriptionText) + '</p><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(vehicle.name) + '" style="max-width:100%;height:auto"><p><a href="' + escapeHtml(target) + '">Open vehicle details</a></p></main></body></html>';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(html);
}
