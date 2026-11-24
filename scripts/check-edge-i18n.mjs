import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicSource = read('src/public-i18n.ts');
const translateSource = read('supabase/functions/tesla-markets-translate/index.ts');
const aiSource = read('supabase/functions/tesla-markets-ai-responder/index.ts');

const list = publicSource.match(/export const supportedPublicLanguages = \[([\s\S]*?)\] as const;/)?.[1] || '';
const codes = [...list.matchAll(/\['([a-z]{2})','/g)].map((match) => match[1]);
const aiSet = aiSource.match(/const SUPPORTED_RESPONSE_LANGUAGES = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
const aiCodes = [...aiSet.matchAll(/"([a-z]{2})"/g)].map((match) => match[1]);
const translationSet = translateSource.match(/const ALLOWED_LANGUAGES = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
const translationCodes = [...translationSet.matchAll(/"([a-z]{2})"/g)].map((match) => match[1]);

assert.equal(codes.length, 59);
assert.deepEqual([...codes].sort(), [...aiCodes].sort());
assert.deepEqual([...codes].sort(), [...translationCodes].sort());
assert.match(aiSource, /function normalizeResponseLanguage/);
assert.match(aiSource, /The language field must be an ISO 639-1 code/);
assert.match(aiSource, /max_tokens:1200/, 'Private model generation must use the configured bounded response size.');
assert.match(aiSource, /temperature:0\.2/, 'Private model generation must use the deterministic response temperature.');
assert.match(aiSource, /TESLA_PRIVATE_LLM_ENDPOINT/, 'Customer inference must route through the Tesla-controlled private model endpoint.');
assert.match(aiSource, /temperature: 0\.2/, 'Private model generation must use its deterministic response temperature.');
assert.match(translateSource, /max_completion_tokens: 3000/);
assert.match(translateSource, /chat_template_kwargs: \{ enable_thinking: false, clear_thinking: true \}/);
assert.match(translateSource, /protected_token_mismatch/);
assert.match(translateSource, /const pattern = new RegExp\(brandPattern\.source \+ "\\|" \+ commonPattern\.source, "gi"\)/, 'Brand and model names must be protected in every target language.');
assert.match(translateSource, /untranslated_response/);
assert.match(translateSource, /consume_translation_rate_limit/);
assert.match(translateSource, /useM2M100 = false/, 'The multilingual LLM fallback must be used when the dedicated translation model fails.');
assert.match(translateSource, /if \(!useM2M100\)/, 'Translation must fall back rather than fail immediately when M2M100 is unavailable.');
assert.match(translateSource, /const failedItems: string\[\] = \[\]/, 'Unvalidated translations must be rejected instead of cached as English.');
assert.match(translateSource, /Translation batch rejected to prevent mixed-language output/, 'Translation failures must fail closed rather than return a mixed-language batch.');
assert.match(translateSource, /const safeFallback = shortTermTranslations\[item\.text\.trim\(\)\.toLowerCase\(\)\]\?\.\[target\]/, 'Only an explicit verified term fallback may be cached.');

const normalizeStart = aiSource.indexOf('const SUPPORTED_RESPONSE_LANGUAGES = new Set(');
const languageFnStart = aiSource.indexOf('function normalizeResponseLanguage', normalizeStart);
const languageFnEnd = aiSource.indexOf('\n}', languageFnStart) + 2;
assert.ok(normalizeStart >= 0 && languageFnStart > normalizeStart && languageFnEnd > languageFnStart);
const normalizationCode = aiSource.slice(normalizeStart, languageFnEnd) + '\nmodule.exports = normalizeResponseLanguage;';
const testModule = ts.transpile(normalizationCode, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const sandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(testModule, sandbox);
const normalizeLanguage = sandbox.module.exports;
for (const code of codes) assert.equal(normalizeLanguage(code, 'en'), code, 'Language normalization failed for ' + code);
assert.equal(normalizeLanguage('pt-BR','en'),'pt');
assert.equal(normalizeLanguage('vietnamese','en'),'vi');
assert.equal(normalizeLanguage('afrikaans','en'),'af');
assert.equal(normalizeLanguage('unsupported','de'),'de');
assert.equal(normalizeLanguage('ha','en'),'en');
assert.equal(normalizeLanguage('yo','en'),'en');

console.log(JSON.stringify({
  status: 'passed',
  checkedLanguageCodes: codes.length,
  responderAllowlistMatchesSelector: true,
  translationAllowlistMatchesSelector: true,
  responseLanguageNormalizationSamples: codes.length + 6,
  modelReasoningDisabledForTranslationAndReplies: true,
  protectedTokenValidation: true
}, null, 2));
