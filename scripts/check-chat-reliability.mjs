import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isConversationalReply,
  looksLikePersonName,
  isSmallTalkMessage,
  isGreetingMessage,
  isVehicleFollowUpMessage,
  isKnownCountry,
  looksLikeCity,
  looksLikeAddress,
  isValidPhoneNumber,
  isInvestmentTopic
} from "../supabase/functions/_shared/chat-intelligence.mjs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const chat = read("src/ChatWorkspace.tsx");
const admin = read("src/AdminConsole.tsx");
const responder = read("supabase/functions/tesla-markets-ai-responder/index.ts");
const takeoverMigration = read("supabase/migrations/20261123120000_block_ai_replies_during_human_takeover.sql");
const orderMigration = read("supabase/migrations/20261123133000_atomic_vehicle_draft_order_idempotency.sql");

assert.equal(isConversationalReply("How are you doing?"), true);
assert.equal(looksLikePersonName("How are you doing", true), false);
assert.equal(looksLikePersonName("I'm doing well", true), false);
assert.equal(looksLikePersonName("Good morning", true), false);
assert.equal(looksLikePersonName("John Smith", true), true);
assert.equal(looksLikePersonName("john smith", true), true);
assert.equal(isSmallTalkMessage("How are you doing?"), true);
assert.equal(isGreetingMessage("Hi"), true);
assert.equal(isVehicleFollowUpMessage("What is the price?"), true);
assert.equal(isVehicleFollowUpMessage("How are you doing?"), false);
assert.equal(isVehicleFollowUpMessage("I like it"), false, "A casual mention of it must not inherit a stale vehicle.");
assert.equal(isKnownCountry("Nigeria"), true);
assert.equal(isKnownCountry("How are you"), false);
assert.equal(looksLikeCity("Ile-Ife"), true);
assert.equal(looksLikeCity("How are you doing today"), false);
assert.equal(looksLikeAddress("10 Downing Street"), true);
assert.equal(looksLikeAddress("How are you doing today"), false);
assert.equal(isValidPhoneNumber("+234 803 925 4732"), true);
assert.equal(isValidPhoneNumber("How are you doing"), false);
assert.equal(isInvestmentTopic("I want to invest in Tesla"), true);
assert.equal(isInvestmentTopic("What is the TSLA stock price?"), true);
assert.equal(isInvestmentTopic("I want to buy Tesla stock"), true);
assert.equal(isInvestmentTopic("I want to buy Tesla shares"), true);
assert.equal(isInvestmentTopic("Is the Model Y in stock?"), false);
assert.equal(isInvestmentTopic("How many Model 3 are in stock?"), false);

assert.doesNotMatch(chat, /investmentCheckout|submitInvestmentCheckout/, "Investment enquiries must not open a checkout form.");
assert.match(chat, /context\.trim\(\)&&\(createdNewConversation\|\|!!intent\)/, "A new pre-filled enquiry must save or safely retry its opening message.");
assert.match(chat, /\.eq\('body',initialBody\)/, "Opening messages must be deduplicated before retrying.");
assert.match(chat, /await invokeCustomerResponder\(id,initialMessageId\)/, "A pre-filled opening message must trigger the AI responder.");
assert.match(chat, /initializedIntentRef\.current/, "Re-renders must not create duplicate enquiry conversations.");
assert.match(chat, /await invokeCustomerResponder\(threadId,messageId\)/, "Typed customer messages must use the same responder invocation helper.");
assert.match(responder, /looksLikePersonName\(nameMatch\[1\],true\)/, "Explicit name candidates must pass name validation.");
assert.match(responder, /looksLikePersonName\(plain,true\)/, "Unlabelled names must pass strict pending-slot validation.");
assert.match(responder, /const selectedVehicle = investmentFlowMessage \? null : vehicle;/, "Unrelated and investment messages must not inherit a previous vehicle.");
assert.match(responder, /\.eq\("is_published", true\)[\s\S]*?\.eq\("verification_status", "verified"\)/, "The AI must only use published, verified vehicle records.");
assert.match(chat, /\.eq\('is_published',true\)\.eq\('verification_status','verified'\)/, "Management chat cards must only show published, verified vehicles.");
assert.match(responder, /isSmallTalkMessage\(customerMessage\.body\) \|\| isGreetingMessage\(customerMessage\.body\)/, "Greetings and small talk must not inherit stale vehicle context.");
assert.match(responder, /"investment_payment_restricted"/, "Investment payment requests must be rejected as payment workflows.");
assert.match(responder, /const investmentFlow = intent\.startsWith\("investment"\) \|\| incomingInvestmentTopic;/, "Investment intent must be based on the current message, not stale vehicle or identity context.");
assert.match(responder, /const incomingInvestmentTopic = isInvestmentTopic\(customerMessage\.body\);/, "Vehicle inventory phrases such as Model Y in stock must not be misclassified as TSLA investment intent.");
assert.doesNotMatch(responder, /investment_enquiries|investmentAmountMatch|investmentDetailsComplete|investment_summary/, "Investment conversations must not collect personal details or create payment-like enquiry records.");
assert.doesNotMatch(responder, /query1\.finance\.yahoo\.com\/v8\/finance\/chart\/TSLA/, "The customer chat must not estimate TSLA share purchases from a requested investment amount.");
assert.doesNotMatch(responder, /tell me the amount you are considering|Tesla Markets collects investment enquiries/i, "The customer chat must not solicit investment amounts or imply investment lead collection.");
assert.match(responder, /const safeKnowledgeForModel = verifiedKnowledge\.filter/, "The model must use a filtered, current knowledge set.");
assert.match(responder, /approved_documents: safeKnowledgeForModel\.map/, "Deprecated investment FAQ content must not reach the AI model.");
assert.match(responder, /Tesla Markets Investment Information & Customer FAQ/, "The legacy investment FAQ must be explicitly identified for exclusion.");
assert.match(responder, /Tesla Markets does not accept or process payments for TSLA shares/, "TSLA payment requests must be explicitly refused.");
assert.match(responder, /investment_information_only/, "Investment context must remain informational.");
assert.match(responder, /extractedDelivery = investmentFlowMessage \? \{\} : local\.delivery/, "Investment conversations must not save volunteered contact or delivery details.");
assert.match(responder, /const selectedVehicle = investmentFlowMessage \? null : vehicle/, "Investment conversations must not inherit a selected vehicle.");
assert.match(responder, /purchaseFlowActive = !investmentFlowMessage/, "Investment conversations must never enter a stale vehicle checkout stage.");
assert.match(responder, /order_id: activeOrder\.id/, "Payment locks must reference the exact approved order.");
assert.match(responder, /create_or_update_vehicle_draft_order/, "Vehicle draft creation must use the atomic order RPC.");
assert.doesNotMatch(responder, /from\("business_orders"\)\.insert/, "The responder must not create draft orders through non-atomic direct inserts.");
assert.match(chat, /vehicleCheckout\.mode==='cart'\?'Add '\+vehicleCheckout\.title\+' to my cart\.'/,"Add-to-cart must not also submit a vehicle purchase.");
assert.match(chat, /Submit purchase enquiry/, "The customer-facing purchase action must submit an enquiry, not imply immediate payment.");
assert.match(responder, /savedPaymentLockCandidate\?\.kind === "vehicle"/, "Only vehicle-order locks may trigger payment follow-up.");
assert.match(responder, /Compare-and-swap the exact previous status and timestamp/, "AI processing retries must use an atomic claim.");
assert.match(responder, /ai_response_failed/, "Failed AI messages must create a management escalation.");
assert.match(responder, /protectedBusinessIntents = new Set/, "Financial, payment, order and verified price replies must not be rewritten by the language model.");
assert.match(responder, /!protectedBusinessIntents\.has\(intent\) \|\| !cleanString\(reply, 3000\)/, "Only unprotected open-ended replies may be replaced by model output.");
assert.match(takeoverMigration, /FOR UPDATE[\s\S]*ai_reply_blocked_by_human_takeover/, "The database must prevent an in-flight AI reply after takeover.");
assert.match(chat, /HUMAN TAKEOVER · Resume AI/, "The admin inbox must show an explicit human-takeover state.");
assert.match(chat, /Persist human takeover before sending the first management reply/, "Management takeover must be persisted before a human reply is sent.");
assert.match(chat, /const {error:pauseError}=await supabase\.from\('support_conversations'\).*?responder_paused:true/s, "Manual management actions must pause the AI.");
assert.match(takeoverMigration, /SECURITY INVOKER/, "The takeover trigger must respect the caller RLS context.");
assert.doesNotMatch(takeoverMigration, /message_type[\s\S]{0,100}payment_receipt[\s\S]{0,100}payment_pending/, "Human takeover must block every automated AI message type, including payment reminders.");
assert.match(orderMigration, /business_orders_active_vehicle_selection_uidx/, "Active vehicle draft orders must be unique per customer, conversation and selection.");
assert.match(orderMigration, /create_or_update_vehicle_draft_order/, "The database must provide the atomic vehicle-order workflow.");
assert.match(orderMigration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/, "Only the service role may execute the privileged order RPC.");
assert.doesNotMatch(takeoverMigration, /SECURITY DEFINER/, "The takeover trigger must not add a public SECURITY DEFINER function.");
assert.match(responder, /paymentSettings\.giftCardEnabled === true/, "Gift-card proof must be rejected or escalated if the method is disabled.");
assert.doesNotMatch(responder, /Present the configured payment choices immediately after a vehicle pro forma/, "AI must not expose payment methods before management approval.");
assert.match(chat, /APPROVED ORDER · /, "Management payment-method cards must identify the approved order.");
assert.match(chat, /must exactly match a verified value saved in Settings/, "Payment recipient instructions must match saved management configuration.");
assert.match(chat, /\(orders\|\|\[\]\)\.length!==1/, "Payment cards must refuse ambiguous multiple awaiting-payment orders.");
assert.match(responder, /\.limit\(2\);[\s\S]*?\(activeOrders \|\| \[\]\)\.length !== 1/, "Payment selection must refuse ambiguous multiple awaiting-payment orders.");
assert.match(responder, /payment_order_ambiguous/, "Ambiguous payment order selection must be escalated.");
assert.match(orderMigration, /already awaiting payment/, "A model already awaiting payment cannot silently switch versions.");
assert.match(admin, /Enable \{method\}/, "Management must be able to enable or disable each payment method.");
assert.match(admin, /Enable optional gift-card payment method/, "Gift-card availability must be controlled independently.");

console.log(JSON.stringify({
  status: "passed",
  identityValidationCases: 5,
  conversationIntentCases: 4,
  investmentCheckoutRemoved: true,
  orderBoundPaymentAuthorization: true,
  giftCardEnablementRechecked: true,
  staleVehicleContextBlocked: true,
  managementPaymentMethodControls: true
}, null, 2));
