import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const catalog = read('src/marketplace-catalog.ts');
const app = read('src/App.tsx');
const marketplace = read('src/Marketplace.tsx');
const vite = read('vite.config.ts');
const vercel = read('vercel.json');

const approvedAsset = src =>
  src.startsWith('https://digitalassets-shop.tesla.com/') ||
  src.startsWith('https://digitalassets-shop.tesla.cn/') ||
  src.startsWith('https://www.eco-worthy.com/cdn/shop/files/');

const usedImageUrls = new Set();
const published = [];
const ids = new Set();

for (const line of catalog.split(/\r?\n/).filter(value => /^\s*\{id:/.test(value))) {
  const id = line.match(/^\s*\{id:'([^']+)'/)?.[1];
  assert.ok(id, 'Every catalog record must have a stable product id.');
  assert.ok(!ids.has(id), 'Duplicate product id in catalogue: ' + id);
  ids.add(id);

  const namePresent = /\bname\s*:/.test(line);
  const image = line.match(/\bimage:'([^']+)'/)?.[1];
  const price = Number(line.match(/\boriginalPrice:(\d+(?:\.\d+)?)/)?.[1] || 0);
  const hasRangePrice = /\bpriceRange:/.test(line);
  if (!namePresent || !image || !approvedAsset(image) || price <= 0 || hasRangePrice) continue;

  const gallery = line.match(/\bgallery:\[([^\]]*)\]/)?.[1] || '';
  const photos = [image, ...[...gallery.matchAll(/'([^']+)'/g)].map(match => match[1])];
  const uniquePhotos = [...new Set(photos)];
  if (uniquePhotos.length !== photos.length || uniquePhotos.some(src => !approvedAsset(src))) continue;
  if (uniquePhotos.some(src => usedImageUrls.has(src))) continue;
  uniquePhotos.forEach(src => usedImageUrls.add(src));
  published.push({ id, photos: uniquePhotos });
}

assert.ok(published.length > 0, 'At least one image-verified product must have a generated page.');
assert.match(vite, /generateShopProductPages/, 'Vite must generate static product landing pages.');
assert.match(vite, /application\/ld\+json/, 'Generated product pages must include Product structured data.');
assert.match(vite, /og:image/, 'Generated product pages must include a social preview image.');
assert.match(app, /shop\/product\//, 'The app must recognize direct product URLs.');
assert.match(marketplace, /pushState\(\{ marketplaceProductId:/, 'Opening a product must update the browser URL.');
assert.match(marketplace, /copyProductLink/, 'Product details must expose a shareable product link.');
assert.match(vercel, /shop\/product\//, 'The SPA catch-all must not swallow static product pages.');

const outputDir = path.resolve(process.cwd(), process.env.APPDEPLOY_VITE_OUT_DIR || 'dist');
const productRoot = path.join(outputDir, 'shop', 'product');
assert.ok(fs.existsSync(productRoot), 'Static product pages were not emitted to ' + productRoot);
const generatedIds = fs.readdirSync(productRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(productRoot, entry.name, 'index.html')))
  .map(entry => entry.name)
  .sort();
const expectedIds = published.map(item => item.id).sort();
assert.deepEqual(generatedIds, expectedIds, 'Every image-verified, priced shop product must have exactly one static URL page.');

const sitemapPath = path.join(outputDir, 'sitemap.xml');
const robotsPath = path.join(outputDir, 'robots.txt');
assert.ok(fs.existsSync(sitemapPath), 'The product sitemap must be generated.');
assert.ok(fs.existsSync(robotsPath), 'The crawler policy file must be generated.');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const robots = fs.readFileSync(robotsPath, 'utf8');
for (const product of published) {
  assert.ok(sitemap.includes('/shop/product/' + product.id + '/'), 'Missing sitemap URL for ' + product.id);
}
assert.ok(robots.includes('Sitemap: https://teslamarketsofficial.com/sitemap.xml'), 'robots.txt must advertise the sitemap.');

for (const product of published) {
  const html = fs.readFileSync(path.join(productRoot, product.id, 'index.html'), 'utf8');
  assert.ok(html.includes('/shop/product/' + product.id + '/'), 'Missing canonical URL for ' + product.id);
  assert.ok(html.includes('property="og:image"'), 'Missing product preview image for ' + product.id);
  assert.ok(html.includes('product:price:amount'), 'Missing product price metadata for ' + product.id);
  assert.ok(html.includes('application/ld+json'), 'Missing Product structured data for ' + product.id);
}

console.log(JSON.stringify({
  status: 'passed',
  catalogRecords: ids.size,
  productPagesGenerated: generatedIds.length,
  uniqueProductAndGalleryImages: usedImageUrls.size
}, null, 2));
