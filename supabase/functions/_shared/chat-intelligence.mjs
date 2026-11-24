const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const knownCountryNames = (() => {
  const names = new Set();
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const first of letters) {
      for (const second of letters) {
        const code = first + second;
        const name = display.of(code);
        if (name && name.toUpperCase() !== code) names.add(normalize(name).replace(/[.,]/g, ""));
      }
    }
  } catch {
    // Common aliases below remain available if Intl.DisplayNames is unavailable.
  }
  for (const alias of [
    "United States of America", "USA", "U.S.A.", "US", "UK", "U.K.",
    "UAE", "Ivory Coast", "Czech Republic", "South Korea", "North Korea",
    "Russia", "Turkey", "Vietnam", "Bolivia", "Tanzania", "Syria",
    "Palestine", "Vatican City", "Taiwan"
  ]) names.add(normalize(alias).replace(/[.,]/g, ""));
  return names;
})();

export function isKnownCountry(value) {
  return knownCountryNames.has(normalize(value).trim().replace(/[.,]/g, ""));
}

export function isValidPhoneNumber(value) {
  const candidate = String(value ?? "").trim();
  const digits = candidate.replace(/\D/g, "");
  return /^\+?[0-9][0-9\s().-]{6,18}[0-9]$/.test(candidate) && digits.length >= 8 && digits.length <= 15;
}

export function looksLikeCity(value) {
  const candidate = String(value ?? "").trim().replace(/[.!?]+$/g, "");
  const words = candidate.split(/\s+/);
  if (!candidate || words.length > 4 || !/^[\p{L}][\p{L} .'-]*$/u.test(candidate)) return false;
  const conversational = new Set(["how", "are", "you", "doing", "today", "i", "am", "im", "fine", "good", "well", "thanks", "thank", "please", "can", "what", "where", "when", "is", "the", "and", "my", "from", "in", "at", "to"]);
  return !words.some((word) => conversational.has(normalize(word).replace(/[.'’]/g, "")));
}

export function looksLikeAddress(value) {
  const candidate = String(value ?? "").trim();
  return candidate.length >= 5 &&
    !isConversationalReply(candidate) &&
    (/\d/.test(candidate) || /\b(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|close|crescent|estate|building|house|apartment|unit|campus|plot|block|flat|boulevard|blvd\.?|way)\b/i.test(candidate));
}


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
  const text = normalize(value).trim().replace(/[.!?]+$/g, "").replace(/['’]/g, "");
  return /^(?:how are you(?: doing)?|how is it going|hows it going|whats up|thank you|thanks|thanks a lot|i am fine|im fine|i am good|im good|i am doing well|im doing well|doing well|doing great|not bad|all good)$/i.test(text);
}

export function isGreetingMessage(value) {
  const text = normalize(value).trim().replace(/[.!?]+$/g, "");
  return /^(?:hi|hello|hey|good morning|good afternoon|good evening|bonjour|bonsoir|hola|guten tag|hallo)(?:\s+there)?$/i.test(text);
}

export function isVehicleFollowUpMessage(value) {
  if (isConversationalReply(value) || isGreetingMessage(value)) return false;
  return /\b(price|prices|pricing|cost|how much|colou?rs?|colors?|range|performance|specifications?|features|wheels?|versions?|availability|available|delivery|charging|battery|that one|this one)\b/i.test(normalize(value));
}

export function isInvestmentTopic(value) {
  const text = normalize(value).trim();
  return /\\b(invest(?:ment|ing)?|shares?|stock\\s+(?:market|price|ticker)|ticker|portfolio|brokerage|dividend|tsla(?:\\s+(?:shares?|stock|price))?)\\b/i.test(text);
}
