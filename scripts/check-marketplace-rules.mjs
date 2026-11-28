import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const giftCardMigration = read('supabase/migrations/20261120121625_restrict_promo_gift_cards_to_approved_methods.sql');
const discountMigration = read('supabase/migrations/20261120121809_restrict_store_discount_range.sql');
const marketplaceSource = read('src/Marketplace.tsx');
const catalogSource = read('src/marketplace-catalog.ts');
const aiSource = read('supabase/functions/tesla-markets-ai-responder/index.ts');

const approvedGiftCards = ['amazon_gift_card','apple_gift_card','google_play_gift_card','razor_gold_gift_card'];
const migrationGiftCards = [...giftCardMigration.matchAll(/'([a-z_]+_gift_card)'/g)].map((match) => match[1]).sort();
assert.deepEqual(migrationGiftCards, [...approvedGiftCards].sort(), 'Only the four approved promotional gift-card methods may be accepted.');
assert.doesNotMatch(giftCardMigration, /visa_gift_card/, 'Visa gift cards are not an approved promotional method.');
assert.match(discountMigration, /discount_percent\s*=\s*0/i, 'A product must be allowed to have no discount.');
assert.match(discountMigration, /discount_percent\s+between\s+25\s+and\s+70/i, 'Applied discounts must remain between 25% and 70%.');
for (const method of approvedGiftCards) assert.ok(marketplaceSource.includes(method), 'Shop checkout is missing approved gift-card choice: ' + method);
assert.match(aiSource, /pct>=25&&pct<=70/, 'AI vehicle promotions must enforce the approved discount range.');
assert.match(marketplaceSource, /searchParams\.set\('product', product\.id\)/, 'Opening a product must write its stable product ID into the shareable URL.');
assert.match(marketplaceSource, /get\('product'\)/, 'The shop must restore product details from a direct product URL.');
assert.match(marketplaceSource, /directImageFallback/, 'Tesla image proxy failures must attempt the original approved image URL before showing an unavailable state.');
assert.doesNotMatch(marketplaceSource, /Boolean\(product\.image\)\s*&&/, 'Products without a primary image field must remain visible in the catalogue.');
const productIds = [...catalogSource.matchAll(/\{id:'([^']+)'/g)].map((match) => match[1]);
assert.ok(productIds.length >= 250, 'The full product catalogue must remain included in the marketplace.');
assert.equal(new Set(productIds).size, productIds.length, 'Every product must have a unique ID for its stable product URL.');
assert.ok(productIds.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)), 'Product IDs must be URL-safe slugs.');

console.log(JSON.stringify({
  status: 'passed',
  approvedGiftCardMethods: approvedGiftCards.length,
  optionalDiscounts: true,
  minimumDiscountPercent: 25,
  maximumDiscountPercent: 70
}, null, 2));
