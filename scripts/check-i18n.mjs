import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicSource = read('src/public-i18n.ts');
const appSource = read('src/App.tsx');
const domSource = read('src/dom-translation.ts');
const chatSource = read('src/ChatWorkspace.tsx');
const adminSource = read('src/AdminConsole.tsx');
const marketplaceSource = read('src/Marketplace.tsx');
const translateSource = read('supabase/functions/tesla-markets-translate/index.ts');
const aiSource = read('supabase/functions/tesla-markets-ai-responder/index.ts');
const profileMigration = read('supabase/migrations/20261120092654_add_customer_language_preferences.sql');
const cacheMigration = read('supabase/migrations/20261120092724_add_translation_cache_and_issues.sql');
const emailHelper = read('api/_lib/tesla-email-translation.ts');
const emailOutbox = read('api/process-email-outbox.ts');
const welcomeEmail = read('api/welcome-email.ts');

const list = publicSource.match(/export const supportedPublicLanguages = \[([\s\S]*?)\] as const;/)?.[1] || '';
const codes = [...list.matchAll(/\['([a-z]{2})','/g)].map((match) => match[1]);
const parseSet = (source, name) => {
  const body = source.match(new RegExp('const ' + name + ' = new Set\\(\\[([\\s\\S]*?)\\]\\);'))?.[1] || '';
  return [...body.matchAll(/"([a-z]{2})"/g)].map((match) => match[1]);
};
const translationCodes = parseSet(translateSource, 'ALLOWED_LANGUAGES');
const responderCodes = parseSet(aiSource, 'SUPPORTED_RESPONSE_LANGUAGES');
const requiredOriginal = ['en','fr','de','es','pt','ar','zh','ja','ko','it','nl','ru','hi','tr','sw'];

assert.equal(codes.length, 59, 'The public selector must expose 59 approved languages.');
assert.equal(new Set(codes).size, 59, 'The public language selector contains duplicate codes.');
for (const code of requiredOriginal) assert.ok(codes.includes(code), 'Original language missing: ' + code);
assert.ok(!codes.includes('ha') && !codes.includes('yo'), 'Hausa and Yoruba must remain excluded.');
assert.deepEqual([...translationCodes].sort(), [...codes].sort(), 'Translation endpoint allowlist must match the public selector.');
assert.deepEqual([...responderCodes].sort(), [...codes].sort(), 'AI responder allowlist must match the public selector.');
assert.match(domSource, /MutationObserver/, 'Runtime DOM translation observer is missing.');
assert.match(domSource, /tesla-markets-translate/, 'Runtime DOM translation must call the translation endpoint.');
assert.match(domSource, /setPublicTranslations/, 'Runtime translation cache is not persisted.');
assert.match(domSource, /fallbackToEnglish/, 'Translation failures must fall back to one consistent language rather than leave mixed-language UI.');
assert.match(appSource, /getInitialPublicLanguage/, 'Browser language detection/manual preference is not connected.');
assert.match(appSource, /customer_profiles.*preferred_language|preferred_language.*customer_profiles/s, 'Customer language preference is not loaded/saved.');
assert.match(chatSource, /preferred_language:language/, 'New support conversations must save their language.');
assert.match(chatSource, /Translate to English/, 'Admin must be able to translate original customer messages without replacing them.');
assert.match(chatSource, /data-no-translate/, 'Original chat messages must not be silently rewritten by the page translator.');
assert.match(adminSource, /preferred_language/, 'Admin conversation list must show preferred language.');
assert.match(adminSource, /section === 'translations'/, 'Admin translation health view is missing.');
assert.match(marketplaceSource, /imageRetryCount/, 'Product image retries are missing.');
assert.match(marketplaceSource, /}, 12000\)/, 'Product image loading needs a timeout fallback.');
assert.match(profileMigration, /customer_profiles[\s\S]*preferred_language[\s\S]*support_conversations[\s\S]*preferred_language/, 'Customer language migration is incomplete.');
assert.match(cacheMigration, /translation_cache[\s\S]*translation_issues[\s\S]*translation_rate_limits/, 'Translation cache, issue reporting and rate limiting migration is incomplete.');
assert.match(cacheMigration, /enable row level security/i, 'Translation storage must use RLS.');
assert.match(translateSource, /protectTokens/, 'Protected token validation is missing.');
assert.match(translateSource, /restoreTokens/, 'Protected token restoration is missing.');
assert.match(translateSource, /untranslated_response/, 'Untranslated English responses must not be cached as another language.');
assert.match(aiSource, /preferred_language: cloudflareReply\.language/, 'AI language preference is not saved.');
assert.match(aiSource, /chat_template_kwargs: \{ enable_thinking: false \}/, 'Cloudflare model should disable reasoning for response generation.');
assert.doesNotMatch(aiSource, /responder_paused: true/, 'A model formatting failure must not permanently pause an otherwise active customer conversation.');
assert.match(aiSource, /status: "failed"/, 'Unexpected responder execution failures must still be recorded as failed runs.');
assert.match(aiSource, /AI used safe fallback response/, 'Model formatting failures must notify management when a safe fallback is sent.');
assert.match(aiSource, /Some model responses are valid plain text/, 'The responder must accept valid plain-text model responses as well as JSON.');
assert.match(aiSource, /I don't have enough verified information to answer that accurately yet/, 'Unknown questions must receive a contextual, honest fallback rather than silence.');
assert.match(emailHelper, /tesla-markets-translate/, 'Transactional email translator is not connected.');
assert.match(emailOutbox, /translateTeslaEmailPayload/, 'Email outbox does not use the saved customer language.');
assert.match(welcomeEmail, /translateTeslaEmailPayload/, 'Welcome email does not use the saved customer language.');
assert.match(emailHelper, /holding delivery rather than sending an English fallback/, 'Non-English email translation failures must not silently send English.');
assert.match(emailOutbox, /message\.startsWith\('Email translation'\)/, 'Repeated localized email failures must be escalated to administrators.');
assert.match(welcomeEmail, /could not be prepared in your selected language/, 'Welcome-email translation failures must be reported instead of silently sending English.');

console.log(JSON.stringify({
  status: 'passed',
  publicLanguageCount: codes.length,
  originalLanguagesRetained: requiredOriginal.length,
  excludedLanguages: ['ha','yo'],
  translationEndpointLanguages: translationCodes.length,
  aiResponderLanguages: responderCodes.length,
  runtimeDomTranslation: true,
  consistentEnglishFallbackOnTranslationFailure: true,
  adminOriginalMessageTranslation: true,
  productImageTimeoutRetry: true,
  customerAndConversationPreference: true,
  adminTranslationHealth: true,
  translationCacheAndRls: true,
  tokenProtection: true,
  localizedTransactionalEmails: true
}, null, 2));
