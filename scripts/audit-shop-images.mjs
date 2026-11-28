import fs from 'node:fs';
import assert from 'node:assert/strict';

const catalog = fs.readFileSync(new URL('../src/marketplace-catalog.ts', import.meta.url), 'utf8');
const allowed = src =>
  src.startsWith('https://digitalassets-shop.tesla.com/') ||
  src.startsWith('https://digitalassets-shop.tesla.cn/') ||
  src.startsWith('https://www.eco-worthy.com/cdn/shop/files/');

const imageOwners = new Map();
const productsWithoutPrimaryImage = [];
for (const line of catalog.split(/\r?\n/).filter(value => /^\s*\{id:/.test(value))) {
  const id = line.match(/^\s*\{id:'([^']+)'/)?.[1] || 'unknown-product';
  const name = line.match(/\bname:'([^']+)'/)?.[1] || id;
  const image = line.match(/\bimage:'([^']+)'/)?.[1];
  if (!image) productsWithoutPrimaryImage.push({ id, name });
  const gallery = line.match(/\bgallery:\[([^\]]*)\]/)?.[1] || '';
  const sources = [image, ...[...gallery.matchAll(/'([^']+)'/g)].map(match => match[1])]
    .filter(value => typeof value === 'string' && Boolean(value) && allowed(value));
  for (const source of sources) {
    const owners = imageOwners.get(source) || [];
    owners.push(id);
    imageOwners.set(source, owners);
  }
}

const sources = [...imageOwners.keys()];
assert.ok(sources.length, 'No approved product image URLs were found in the catalogue.');
const queue = [...sources];
const results = [];
const concurrency = 4;

async function worker() {
  while (queue.length) {
    const source = queue.shift();
    if (!source) return;
    const proxyUrl = 'https://teslamarketsofficial.com/api/tesla-image?v=20261118-3&url=' + encodeURIComponent(source);
    try {
      const response = await fetch(proxyUrl, {
        headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
        signal: AbortSignal.timeout(20000)
      });
      const contentType = response.headers.get('content-type') || '';
      const contentLength = Number(response.headers.get('content-length') || 0);
      const result = {
        source,
        products: imageOwners.get(source),
        status: response.status,
        contentType,
        contentLength
      };
      if (!response.ok || !contentType.toLowerCase().startsWith('image/') || contentLength <= 0) {
        result.error = 'Expected a successful image response with a non-empty body.';
      }
      results.push(result);
      await response.body?.cancel();
    } catch (error) {
      results.push({ source, products: imageOwners.get(source), error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
results.sort((a, b) => a.source.localeCompare(b.source));
const failed = results.filter(result => result.error);
console.log(JSON.stringify({
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  productsWithoutPrimaryImage,
  productsWithoutPrimaryImageCount: productsWithoutPrimaryImage.length,
  failures: failed
}, null, 2));
if (failed.length) process.exitCode = 1;
