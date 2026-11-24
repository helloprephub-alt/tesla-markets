import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const responder=readFileSync("supabase/functions/tesla-markets-ai-responder/index.ts","utf8");
const admin=readFileSync("supabase/functions/tesla-markets-ai-admin/index.ts","utf8");
const adminUi=readFileSync("src/AdminConsole.tsx","utf8");
const chat=readFileSync("src/ChatWorkspace.tsx","utf8");
assert.match(responder,/vehicle_catalogue_list/);assert.match(responder,/vehicle_comparison/);assert.match(responder,/vehicle_recommendation/);
assert.match(responder,/TESLA_PRIVATE_LLM_ENDPOINT/);assert.match(responder,/management_approved/);
assert.doesNotMatch(responder,/discountPercent:28|discountPercent:35|CLOUDFLARE_AI_TOKEN/);
assert.match(admin,/TESLA_PRIVATE_LLM_ENDPOINT/);assert.doesNotMatch(admin,/CLOUDFLARE_AI_TOKEN|api\.cloudflare\.com\/client\/v4\/accounts/);
assert.match(adminUi,/verified_official.*verified_independent.*management_approved/);
const base=100000,pct=35,saved=base*pct/100;assert.equal(saved,35000);assert.equal(base-saved,65000);
console.log("Tesla Markets AI intelligence checks passed.");
assert.match(responder,/explicitQuantityMatch = customerMessage\.body\.match/, "Vehicle quantity must require an explicit add/put/include instruction.");
assert.doesNotMatch(responder,/const quantityMatch = customerMessage\.body\.match/, "Unqualified message numbers must never be interpreted as cart quantity.");
assert.match(chat,/const selected=selectedVariant===String\(variant\.name\|\|''\)/, "Selected vehicle trim highlighting must use the live local selection.");
assert.match(chat,/save_vehicle_variant_selection/, "Vehicle version selection must persist without sending a chat message.");

assert.match(responder, /isBareVehicleConfirmation/, "Affirmative vehicle selection must not be captured as a customer name.");
assert.match(responder, /if\(bareVehicleConfirmation\) delete mergedDetails\.full_name/, "A stale conversational pseudo-name must be cleared.");
assert.match(chat,/const next=String\(variant\.name\);setSelectedVariant\(next\);onSelectVariant/, "Version selection must update locally and persist without sending another chat message.");
assert.doesNotMatch(chat, /onSelectVariant=\{\(variant,data\)=>void sendQuickMessage/, "A trim selection must not generate another AI purchase card.");
assert.match(chat, /selected_variant:selectedVariant\|\|null/, "The exact selected trim must flow into checkout.");
assert.match(responder, /promo_active===true[\s\S]*discount_percent/, "Vehicle promotions must be calculated from the selected live catalogue variant.");
assert.match(responder, /Exact selected configuration/, "The pro forma invoice must name the exact selected vehicle configuration.");
assert.match(responder, /if \(explicitVehiclePurchase && selectedVehicle\) \{[\s\S]*intent = "customer_details_progress"/, "An explicit vehicle purchase must override a generic intent classification.");
assert.match(responder, /Object\.keys\(extractedDelivery\)\.length > 0 && !purchaseFlowActive/, "Purchase details must not fall through to the generic customer-enquiry card.");
assert.match(responder, /selected_variant,100\) \|\| selectedVehicle\.name/, "The purchase response must retain the exact selected vehicle configuration.");

assert.match(responder,/wantsPaymentStage/, "A customer must be able to request the payment stage from the pro forma invoice.");
assert.match(responder,/paymentMethodPrompt/, "Only an approved vehicle order may produce the payment-method selection card.");
assert.match(chat,/PROCEED TO PAYMENT/, "The vehicle pro forma invoice must expose a proceed-to-payment action.");

assert.match(responder,/Use the first vehicle name in the message/, "A trim mentioned later must never override the base vehicle named first.");
assert.match(responder,/const contextualVehicle = canonicalVehicle\(customerMessage\.body\)[\s\S]*persistedDetails\.selected_vehicle_model/, "Vehicle context must fall back to the saved selected model.");
assert.match(responder,/const cartIntent = cartRemovalRequested \|\| \/, "Cart requests and cart removals must be recognized even when customer details follow on later lines.");
assert.match(responder,/if \(variants\.length > 1 && !chosen\) return null/, "A cart line must never be created without its exact selected version.");
assert.match(responder,/existing\.unit_price_usd = sale[\s\S]*existing\.original_unit_price_usd = base[\s\S]*existing\.discount_percent = pct/, "Updating an existing cart line must refresh its authoritative variant price and discount.");
assert.match(responder,/Continue with " \+ cleanString\(selectedVehicle\.name,100\) \+ \(cleanString\(mergedDetails\.selected_variant,100\)/, "The purchase card title must include the selected version.");
assert.match(responder,/Selected vehicle version/, "Customer details must show the selected vehicle version separately.");
assert.match(responder,/intent = "vehicle_variant_required"[\s\S]*select the exact vehicle version below/, "A cart request without a selected version must ask for the exact version instead of saving a generic vehicle.");

// Regression: a specific trim must beat its generic model-name prefix.
assert.match(responder,/variants\.slice\(\)\.sort\(\(a:any,b:any\)=>[\s\S]*\.find\(\(variant:any\)=>/,
  "Variant matching must test the longest catalogue trim before its generic model prefix.");
assert.match(responder,/Upgrade a previously mis-saved generic model line to the exact trim/,
  "A previously generic cart line must be upgraded rather than duplicated when the exact trim is selected.");
assert.doesNotMatch(responder,/image_url:cartSummary\.find/,
  "Cart cards must not reuse an unverified generic model image as the selected trim image.");
assert.match(chat,/const fallbackImage=type==='cart_summary'\?'':/,
  "Cart cards must not fall back to a generic model image when no trim-specific image is verified.");

assert.match(responder,/if \(explicitQuantityMatch \|\| addAnother\) \{[\s\S]*existing\.quantity = Math\.min/,
  "Repeated unqualified add-to-cart messages must not inflate an existing line quantity.");

assert.ok(responder.includes('const cartRemovalMatch = customerMessage.body.match('), "Cart removal commands must identify a specific saved item.");
assert.ok(responder.includes('priorCart.filter((_item:any,index:number)=>index!==cartRemovalIndex)'), "Removing an item must persist only the remaining cart entries.");
assert.ok(responder.includes('cart_items:cartSummary.map'), "Cart cards must carry item identifiers for per-item removal.");
assert.ok(chat.includes('onRemoveCartItem?.(item)'), "Cart rows must expose a remove action.");
assert.ok(chat.includes('>PAY NOW</button>'), "Non-empty carts must display a Pay Now action.");
assert.ok(chat.includes('REMOVE_CART_ITEM|'), "The remove action must send a deterministic cart-item identifier.");
assert.ok(chat.includes('Pay now for my cart.'), "Pay Now must enter the existing payment approval flow.");

assert.ok(responder.includes('const cartRemovalMatch = customerMessage.body.match('), "Cart removal commands must identify a specific saved item.");
assert.ok(responder.includes('priorCart.filter((_item:any,index:number)=>index!==cartRemovalIndex)'), "Removing an item must persist only the remaining cart entries.");
assert.ok(responder.includes('cart_items:cartSummary.map'), "Cart cards must carry item identifiers for per-item removal.");
assert.ok(chat.includes('onRemoveCartItem?.(item)'), "Cart rows must expose a remove action.");
assert.ok(chat.includes('>PAY NOW</button>'), "Non-empty carts must display a Pay Now action.");
assert.ok(chat.includes('REMOVE_CART_ITEM|'), "The remove action must send a deterministic cart-item identifier.");
assert.ok(chat.includes('Pay now for my cart.'), "Pay Now must enter the existing payment approval flow.");
