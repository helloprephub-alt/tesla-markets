const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function isConversationalReply(value) {
  const text = normalize(value).trim().replace(/[.!?]+$/g, "").replace(/['’]/g, "");
  return isGreetingMessage(text) || /^(?:how are you(?: doing)?|how is it going|hows it going|whats up|what is up|im fine|i am fine|im good|i am good|im doing well|i am doing well|im doing great|i am doing great|doing well|doing great|not bad|all good|great|good|fine|well|okay|ok|yes|no|thanks|thank you|thank you very much|nice to meet you|pleased to meet you|hello|hi|hey)$/i.test(text);
}

export function looksLikePersonName(value, requireFullName = false) {
  const candidate = String(value ?? "").trim().replace(/[.!?]+$/g, "");
  if (!candidate || /[?@0-9]/.test(candidate) || isConversationalReply(candidate)) return false;
  const words = candidate.split(/\s+/);
  if (words.length > 5 || (requireFullName && words.length < 2)) return false;
  return words.every((word) => /^\p{L}[\p{L}'’.-]*$/u.test(word));
}

export function isSmallTalkMessage(value) {
  const text = normalize(value).trim().replace(/[.!?]+$/g, "");
  return /^(?:how are you(?: doing)?|how is it going|how's it going|what's up|whats up|thank you|thanks|thanks a lot|i am fine|im fine|i am good|im good|i am doing well|im doing well|doing well|doing great|not bad|all good)$/i.test(text);
}

export function isGreetingMessage(value) {
  const text = normalize(value).trim().replace(/[.!?]+$/g, "");
  return /^(?:hi|hello|hey|good morning|good afternoon|good evening|bonjour|bonsoir|hola|guten tag|hallo)(?:\s+there)?$/i.test(text);
}

export function isVehicleFollowUpMessage(value) {
  if (isConversationalReply(value) || isGreetingMessage(value)) return false;
  return /\b(price|prices|pricing|cost|how much|colou?rs?|colors?|range|performance|specifications?|features|wheels?|versions?|availability|available|delivery|charging|battery|that one|this one)\b/i.test(normalize(value));
}
