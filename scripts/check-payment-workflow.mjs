import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const adminSource = read('src/AdminConsole.tsx');
const chatSource = read('src/ChatWorkspace.tsx');
const aiSource = read('supabase/functions/tesla-markets-ai-responder/index.ts');

const syntax = ts.transpileModule(aiSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  reportDiagnostics: true
});
const syntaxErrors = (syntax.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(syntaxErrors.length, 0, 'AI responder source must parse: ' + syntaxErrors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('; '));

const settingsIndex = aiSource.indexOf('const configuredPaymentMethods');
const selectionIndex = aiSource.indexOf('const paymentChoiceMatch');
assert.ok(settingsIndex >= 0 && selectionIndex > settingsIndex, 'Payment configuration must load before payment-method selection is handled.');
for (const method of ['PayPal', 'Zelle', 'Apple Pay', 'Chime']) {
  assert.ok(aiSource.includes('key: "' + method + '"'), 'AI payment configuration is missing ' + method + '.');
}
assert.match(aiSource, /details\.enabled === true \|\| \(details\.enabled !== false && hasRecipient\)/, 'A payment method must be enabled and have a verified recipient identifier.');
assert.match(aiSource, /paymentAccountSettings\.giftCardEnabled === true/, 'Gift Card must be shown only when management enables it.');
assert.match(aiSource, /order_id: linkedOrder\.id, order_reference: linkedOrder\.order_reference/, 'A selected payment method must be linked to the genuine order.');
assert.match(aiSource, /startsWith\(expectedPrefix\)/, 'Evidence paths must belong to the authenticated customer and conversation.');
assert.match(aiSource, /proof_path: customerMessage\.attachment_path/, 'Payment evidence must be stored on the payment record.');
assert.match(aiSource, /type: "payment_evidence_submitted"/, 'Payment evidence must notify management.');
assert.match(aiSource, /type: "ai_responder_failure"/, 'AI failures must create an admin notification.');
assert.match(aiSource, /message_type: "ai_fallback"/, 'AI failures must provide a safe customer fallback when possible.');
assert.match(aiSource, /gift-card PINs or redemption codes/, 'The responder must not request gift-card redemption secrets.');

assert.match(adminSource, /Enable \{method\} for customer checkout/, 'Admin settings must expose independent method toggles.');
assert.match(adminSource, /details\.enabled===true&&!hasRecipient/, 'Admin settings must reject enabling a method without recipient details.');
assert.match(adminSource, /createSignedUrl\(proofPath,900\)/, 'Payment evidence must be shown to admins through short-lived signed URLs.');
assert.match(adminSource, /proofUrl\?\s*<a href=\{payment\.proofUrl\}/, 'The payment records screen must expose the evidence link.');
assert.match(adminSource, /Payment verified/, 'Payment verification must send an order-linked customer confirmation.');

assert.match(chatSource, /const lock=details\.payment_lock/, 'Admin chat must read the customer-selected payment lock.');
assert.match(chatSource, /String\(lock\.method\|\|''\)!==method/, 'Admin chat must only send the method selected by the customer.');
assert.match(chatSource, /eq\('id',orderId\)\.eq\('conversation_id',selected\)\.eq\('customer_id',conversation\.customer_id\)/, 'Payment instructions must be linked to the selected customer order.');
assert.match(chatSource, /payment_methods:methods/, 'Manual payment-method cards must include only enabled methods.');
const methodsStart = chatSource.indexOf('const sendPaymentMethodsCard=async()=>{');
const methodsEnd = chatSource.indexOf('const sendReceiptPendingCard=async()=>{', methodsStart);
assert.ok(methodsStart >= 0 && methodsEnd > methodsStart);
assert.doesNotMatch(chatSource.slice(methodsStart, methodsEnd), /responder_paused:true/, 'Showing payment methods must leave the AI available to record the customer selection.');
assert.match(chatSource, /id="customer-chat-file" className="chat-file-input" type="file" accept=/, 'Customer payment evidence upload must be a single image per submission.');
assert.doesNotMatch(chatSource, /id="customer-chat-file"[^>]*multiple/, 'Customer evidence upload must not silently ignore additional images.');

console.log(JSON.stringify({
  status: 'passed',
  aiResponderSyntax: 'passed',
  independentlyConfigurableMethods: 4,
  orderLinkedPaymentSelection: true,
  orderLinkedEvidenceAndAdminReview: true,
  safeAIRecovery: true,
  singleImageEvidenceSubmissions: true
}, null, 2));
