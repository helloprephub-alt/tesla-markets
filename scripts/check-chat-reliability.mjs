import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isConversationalReply,
  looksLikePersonName,
  isSmallTalkMessage,
  isGreetingMessage,
  isVehicleFollowUpMessage
} from "../supabase/functions/_shared/chat-intelligence.mjs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const chat = read("src/ChatWorkspace.tsx");
const admin = read("src/AdminConsole.tsx");
const responder = read("supabase/functions/tesla-markets-ai-responder/index.ts");

assert.equal(isConversationalReply("How are you doing?"), true);
assert.equal(looksLikePersonName("How are you doing", true), false);
assert.equal(looksLikePersonName("I'm doing well", false), false);
assert.equal(looksLikePersonName("John Smith", true), true);
assert.equal(looksLikePersonName("john smith", true), true);
assert.equal(isSmallTalkMessage("How are you doing?"), true);
assert.equal(isGreetingMessage("Hi"), true);
assert.equal(isVehicleFollowUpMessage("What is the price?"), true);
assert.equal(isVehicleFollowUpMessage("How are you doing?"), false);

assert.doesNotMatch(chat, /investmentCheckout|submitInvestmentCheckout/, "Investment enquiries must not open a checkout form.");
assert.match(responder, /looksLikePersonName\(nameMatch\[1\]\)/, "Explicit name candidates must pass name validation.");
assert.match(responder, /looksLikePersonName\(plain,true\)/, "Unlabelled names must pass strict pending-slot validation.");
assert.match(responder, /const selectedVehicle = vehicle;/, "A previous vehicle must not be auto-selected for unrelated messages.");
assert.match(responder, /isSmallTalkMessage\(customerMessage\.body\) \|\| isGreetingMessage\(customerMessage\.body\)/, "Greetings and small talk must not inherit stale vehicle context.");
assert.match(responder, /"investment_payment_restricted"/, "Investment payment requests must be rejected as payment workflows.");
assert.match(responder, /const investmentFlow = intent\.startsWith\("investment"\) \|\| incomingInvestmentTopic;/, "Investment intent must be based on the current message, not stale vehicle or identity context.");
assert.doesNotMatch(responder, /investment_enquiries|investmentAmountMatch|investmentDetailsComplete|investment_summary/, "Investment conversations must not collect personal details or create payment-like enquiry records.");
assert.match(responder, /investment_information_only/, "Investment context must remain informational.");
assert.match(responder, /order_id: activeOrder\.id/, "Payment locks must reference the exact approved order.");
assert.match(responder, /savedPaymentLockCandidate\?\.kind === "vehicle"/, "Only vehicle-order locks may trigger payment follow-up.");
assert.match(responder, /giftCardSettingsRow\?\.value\?\.giftCardEnabled !== true/, "Gift-card proof must be rejected or escalated if the method is disabled.");
assert.doesNotMatch(responder, /Present the configured payment choices immediately after a vehicle pro forma/, "AI must not expose payment methods before management approval.");
assert.match(chat, /APPROVED ORDER · /, "Management payment-method cards must identify the approved order.");
assert.match(chat, /must exactly match a verified value saved in Settings/, "Payment recipient instructions must match saved management configuration.");
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
