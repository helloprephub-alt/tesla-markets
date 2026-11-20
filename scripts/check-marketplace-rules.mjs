import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const giftCardMigration = read('supabase/migrations/20261120121625_restrict_promo_gift_cards_to_approved_methods.sql');
const discountMigration = read('supabase/migrations/20261120121809_restrict_store_discount_range.sql');
const paymentMigration = read('supabase/migrations/20261120204842_enable_management_assisted_store_payment_methods.sql');
const paymentOptionsSource = read('supabase/functions/store-payment-options/index.ts');
const marketplaceSource = read('src/Marketplace.tsx');
const adminSource = read('src/AdminConsole.tsx');
const appSource = read('src/App.tsx');
const chatSource = read('src/ChatWorkspace.tsx');
const aiSource = read('supabase/functions/tesla-markets-ai-responder/index.ts');

const approvedGiftCards = ['amazon_gift_card','apple_gift_card','google_play_gift_card','razor_gold_gift_card'];
const migrationGiftCards = [...giftCardMigration.matchAll(/'([a-z_]+_gift_card)'/g)].map((match) => match[1]).sort();
assert.deepEqual(migrationGiftCards, [...approvedGiftCards].sort(), 'Only the four approved promotional gift-card methods may be accepted.');
assert.doesNotMatch(giftCardMigration, /visa_gift_card/, 'Visa gift cards are not an approved promotional method.');
assert.match(discountMigration, /discount_percent\s*=\s*0/i, 'A product must be allowed to have no discount.');
assert.match(discountMigration, /discount_percent\s+between\s+25\s+and\s+70/i, 'Applied discounts must remain between 25% and 70%.');
for (const method of approvedGiftCards) assert.ok(marketplaceSource.includes(method), 'Shop checkout is missing approved gift-card choice: ' + method);
assert.match(aiSource, /pct>=25&&pct<=70/, 'AI vehicle promotions must enforce the approved discount range.');

const managementMethods = ['paypal','zelle','apple_pay','chime'];
for (const method of managementMethods) {
  assert.ok(paymentMigration.includes("'" + method + "'"), 'Payment migration is missing method: ' + method);
  assert.ok(paymentOptionsSource.includes('"' + method + '"'), 'Owner-scoped payment function is missing method: ' + method);
}
assert.match(paymentMigration, /is_store_payment_method_enabled/, 'Proof submissions must be checked against admin-enabled methods.');
assert.match(paymentMigration, /o\.payment_method\s*=\s*public\.store_payment_submissions\.payment_method/, 'Payment evidence must match the method selected for its order.');
assert.match(paymentOptionsSource, /\.eq\("customer_id", user\.id\)/, 'Payment instructions must be restricted to the authenticated order owner.');
assert.match(paymentOptionsSource, /settings\.giftCardEnabled === true/, 'Gift-card options must remain optional.');
assert.match(marketplaceSource, /store-payment-options/, 'Shop checkout must load methods and selected instructions from the secure function.');
assert.match(marketplaceSource, /provider_reference/, 'Shop checkout must link an optional transaction reference to payment evidence.');
assert.match(adminSource, /paymentAccountDetails\[method\]\?\.enabled===true/, 'Admin must be able to enable or disable each payment method.');
assert.match(aiSource, /details\.enabled === true/, 'AI payment choices must respect admin enablement.');
assert.match(aiSource, /paymentAccountSettings\.giftCardEnabled === true/, 'AI must offer optional gift cards only when enabled.');
assert.match(paymentMigration, /payment_verified/, 'Shop orders must have an explicit payment-verified state.');
assert.match(paymentMigration, /payment_method is null/, 'Customers must not self-select or pre-verify payment during order creation.');
assert.match(paymentMigration, /enforce_store_order_payment_verification/, 'Database must enforce payment verification before new fulfilment transitions.');
assert.match(appSource, /Payment verified/, 'Customers must see payment verification in order tracking.');
assert.match(adminSource, /Confirm funds received/, 'Management must explicitly verify funds before fulfilment.');
assert.match(paymentMigration, /review_store_payment_proof/, 'Proof acceptance and payment verification must be atomic.');
assert.match(adminSource, /rpc\('review_store_payment_proof'/, 'Admin review must use the atomic verification function.');
assert.match(adminSource, /Confirm receipt of the payment from the recipient account/, 'Fulfilment must be blocked until payment is verified.');
assert.match(chatSource, /selectedPaymentLock/, 'Admin chat payment instructions must be tied to the customer's selected method.');
const customerChatSource = chatSource.split('export function AdminInbox()')[0];
assert.doesNotMatch(customerChatSource, /supabase\.from\('site_settings'\).*payment_account_details/, 'Customer chat must not read private recipient settings directly.');

console.log(JSON.stringify({
  status: 'passed',
  approvedGiftCardMethods: approvedGiftCards.length,
  managementAssistedMethods: managementMethods.length,
  optionalGiftCards: true,
  orderOwnerScopedInstructions: true,
  optionalDiscounts: true,
  minimumDiscountPercent: 25,
  maximumDiscountPercent: 70
}, null, 2));
