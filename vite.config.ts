import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { storeProducts, getDiscountedPrice } from './src/marketplace-catalog';
import { productAssetUrl } from './src/product-assets.generated';

const htmlEscape = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function generateShopProductPages(): Plugin {
  return {
    name: 'generate-shop-product-pages',
    apply: 'build',
    async closeBundle() {
      const outputDir = resolve(process.cwd(), process.env.APPDEPLOY_VITE_OUT_DIR || 'dist');
      const indexPath = resolve(outputDir, 'index.html');
      const template = await readFile(indexPath, 'utf8');
      const siteOrigin = 'https://teslamarketsofficial.com';

      await Promise.all(storeProducts.map(async product => {
        const id = encodeURIComponent(product.id);
        const canonicalUrl = siteOrigin + '/shop/product/' + id + '/';
        const title = product.name + ' | Tesla Markets';
        const description = product.description || product.name + ' from the Tesla Markets shop.';
        const imageUrl = siteOrigin + productAssetUrl(product.image);
        const salePrice = getDiscountedPrice(product);
        const productSchema = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description,
          image: [imageUrl, ...(product.gallery || []).map(src => siteOrigin + productAssetUrl(src))],
          category: product.category,
          ...(product.brandType === 'Tesla Shop listing' ? { brand: { '@type': 'Brand', name: 'Tesla' } } : {}),
          offers: salePrice === null ? undefined : {
            '@type': 'Offer',
            url: canonicalUrl,
            priceCurrency: 'USD',
            price: salePrice,
            seller: { '@type': 'Organization', name: 'Tesla Markets' }
          },
          ...(product.discountPercent > 0 ? {
            additionalProperty: {
              '@type': 'PropertyValue',
              name: 'Displayed discount',
              value: product.discountPercent + '%'
            }
          } : {})
        };
        const schemaJson = JSON.stringify(productSchema).replace(/</g, '\\u003c');
        const titleTag = '<title>' + htmlEscape(title) + '</title>';
        const metadata = [
          '<meta name="description" content="' + htmlEscape(description) + '" />',
          '<link rel="canonical" href="' + canonicalUrl + '" />',
          '<meta name="robots" content="index,follow" />',
          '<meta property="og:type" content="product" />',
          '<meta property="og:title" content="' + htmlEscape(title) + '" />',
          '<meta property="og:description" content="' + htmlEscape(description) + '" />',
          '<meta property="og:url" content="' + canonicalUrl + '" />',
          '<meta property="og:image" content="' + htmlEscape(imageUrl) + '" />',
          '<meta property="product:price:amount" content="' + (salePrice === null ? '' : String(salePrice)) + '" />',
          '<meta property="product:price:currency" content="USD" />',
          '<meta name="twitter:card" content="summary_large_image" />',
          '<meta name="twitter:title" content="' + htmlEscape(title) + '" />',
          '<meta name="twitter:description" content="' + htmlEscape(description) + '" />',
          '<meta name="twitter:image" content="' + htmlEscape(imageUrl) + '" />',
          '<script type="application/ld+json">' + schemaJson + '</script>'
        ].join('\n    ');
        const html = template
          .replace(/<title>[\s\S]*?<\/title>/i, titleTag)
          .replace('</head>', '    ' + metadata + '\n  </head>');
        const targetPath = resolve(outputDir, 'shop', 'product', product.id, 'index.html');
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, html, 'utf8');
      }));

      const sitemapEntries = storeProducts.map(product =>
        '  <url><loc>' + siteOrigin + '/shop/product/' + encodeURIComponent(product.id) + '/</loc><changefreq>weekly</changefreq></url>'
      ).join('\\n');
      const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n' +
        sitemapEntries + '\\n</urlset>\\n';
      await writeFile(resolve(outputDir, 'sitemap.xml'), sitemap, 'utf8');
      await writeFile(
        resolve(outputDir, 'robots.txt'),
        'User-agent: *\\nAllow: /\\nSitemap: ' + siteOrigin + '/sitemap.xml\\n',
        'utf8'
      );
    }
  };
}

export default defineConfig({
  plugins: [react(), generateShopProductPages()],
  base: '/',
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        admin: resolve(process.cwd(), 'admin.html'),
      },
      maxParallelFileOps: 128,
    },
  },
});
