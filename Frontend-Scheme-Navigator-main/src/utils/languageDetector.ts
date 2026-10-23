/**
 * Centralized Intelligent Language Detector for Scheme Navigator & Mitra AI.
 * 
 * Supports:
 * - Native Indic scripts (Devanagari, Bengali, Gurmukhi/Punjabi, Odia, Telugu, Tamil, Gujarati, Kannada, Malayalam, Perso-Arabic/Urdu)
 * - Marathi Devanagari keyword disambiguation
 * - Transliterated / Romanized Indic (Banglish, Roman Odia, Roman Punjabi, Roman Marathi, Roman Urdu, etc.)
 * - Grammar token analysis between English and Hindi/Hinglish
 * - Prevents English queries containing scheme names (e.g. "Pradhan Mantri Awas Yojana") from misidentifying as Hindi
 */

export const LANGUAGE_NAMES: Record<string, string> = {
  'en-IN': 'English',
  'en': 'English',
  'hi-IN': 'Hindi (हिंदी)',
  'hi': 'Hindi (हिंदी)',
  'bn-IN': 'Bengali (বাংলা)',
  'bn': 'Bengali (বাংলা)',
  'ur-IN': 'Urdu (اردو)',
  'ur': 'Urdu (اردو)',
  'pa-IN': 'Punjabi (ਪੰਜਾਬੀ)',
  'pa': 'Punjabi (ਪੰਜਾਬੀ)',
  'or-IN': 'Odia (ଓଡ଼ିଆ)',
  'or': 'Odia (ଓଡ଼ିଆ)',
  'mr-IN': 'Marathi (मराठी)',
  'mr': 'Marathi (मराठी)',
  'te-IN': 'Telugu (తెలుగు)',
  'te': 'Telugu (తెలుగు)',
  'ta-IN': 'Tamil (தமிழ்)',
  'ta': 'Tamil (தமிழ்)',
  'gu-IN': 'Gujarati (ગુજરાતી)',
  'gu': 'Gujarati (ગુજરાતી)',
  'kn-IN': 'Kannada (ಕನ್ನಡ)',
  'kn': 'Kannada (ಕನ್ನಡ)',
  'ml-IN': 'Malayalam (മലയാളം)',
  'ml': 'Malayalam (മലയാളം)',
};

const HINDI_GRAMMAR_WORDS = new Set([
  'kya', 'hai', 'hain', 'ho', 'hoon', 'hu', 'kaise', 'kese', 'batao', 'bataiye', 'batayein', 'batana',
  'chahiye', 'mere', 'meri', 'mera', 'mujhe', 'mujhko', 'hume', 'humko', 'apna', 'apne', 'apni',
  'aap', 'aapka', 'aapke', 'aapki', 'tum', 'tumhara', 'kisko', 'kise', 'kitna', 'kitne', 'kitni',
  'milega', 'milegi', 'milege', 'milta', 'milti', 'milte', 'dastavej', 'patrata', 'labh', 'fayde',
  'fayda', 'kare', 'karein', 'karna', 'karne', 'aavedan', 'paise', 'paisa', 'rupaye',
  'naukri', 'chhatravritti', 'shiksha', 'swasthya', 'ilaj', 'dawa', 'bima', 'berojgar', 'silai',
  'karigar', 'beti', 'ladki', 'bata', 'kuch', 'konsi', 'kaunsi', 'suno', 'bhai', 'sahab'
]);

const ENGLISH_GRAMMAR_WORDS = new Set([
  'what', 'which', 'who', 'how', 'when', 'where', 'why', 'can', 'could', 'would', 'should',
  'tell', 'give', 'show', 'list', 'explain', 'help', 'need', 'want', 'apply', 'get', 'for',
  'from', 'with', 'about', 'under', 'eligibility', 'eligible', 'documents', 'document', 'required',
  'benefit', 'benefits', 'subsidy', 'assistance', 'portal', 'official', 'government', 'central',
  'state', 'process', 'procedure', 'student', 'scholarship', 'farmer', 'business', 'loan',
  'housing', 'pension', 'women', 'senior', 'citizen', 'card', 'online', 'offline', 'the', 'is', 'are'
]);

export function detectMessageLanguage(message: string, fallbackLang: string = 'en-IN'): string {
  const text = (message || '').trim();
  if (!text) {
    return fallbackLang || 'en-IN';
  }

  const lower = text.toLowerCase();

  // 1. Unicode Script Detection (Strongest Signal)
  if (/[\u0600-\u06FF]/.test(text)) return 'ur-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  if (/[\u0900-\u097F]/.test(text)) {
    // If fallbackLang or target language is explicitly Hindi, honor Hindi 100%!
    if (fallbackLang && fallbackLang.startsWith('hi')) {
      return 'hi-IN';
    }
    if (fallbackLang && fallbackLang.startsWith('mr')) {
      return 'mr-IN';
    }
    const marathiMarkers = /\b(आहे|आहेत|नाहीत|करावे|मिळेल|योजनांची|माझ्या|पाहिजे)\b/;
    if (marathiMarkers.test(text)) {
      return 'mr-IN';
    }
    return 'hi-IN';
  }

  // 2. Regional Romanized / Transliterated Indic Markers
  if (/\b(mainu|assi|tussi|chahida|chahidi|chahide|daso|kivve|kive|kiven|dasso|vadhiya|kujh|jatt|hove|hovan|pind|sade|tuhada|tuhadi)\b/i.test(lower)) {
    return 'pa-IN';
  }

  if (/\b(mu|mote|mate|amara|amaku|kipari|kemiti|jojana|kahantu|kahiba|sahayata|darkar|darkara|janni|miliba|milipare|tankaa|tanka|chasa|chasi)\b/i.test(lower)) {
    return 'or-IN';
  }

  if (/\b(amar|amake|amader|prokolpo|jonno|chhatrobritti|kivabe|dorkar|bhalo|dhonnobad|krishok|shunchen|taka|korbo|korte|konta|dekhte)\b/i.test(lower)) {
    return 'bn-IN';
  }

  if (/\b(majhe|majha|majhi|amhi|amche|karava|karave|aahe|ahet|dya|shasan|sang|sanga|sangave|pahije|milnar|baddal|sathi)\b/i.test(lower)) {
    if (!fallbackLang || !fallbackLang.startsWith('hi')) {
      return 'mr-IN';
    }
  }

  if (/\b(wazifa|qarz|qard|dastawiz|hukumat|janab|shukriya|khawateen|khatoon|imdad|rehnumai|taraqqi|itla|darkhwast)\b/i.test(lower)) {
    return 'ur-IN';
  }

  if (/\b(naku|naaku|manaku|ela|elaga|pathakam|pathakalu|sahayam|kavali|cheyali|teliyacheyandi|raithu|dabbulu)\b/i.test(lower)) {
    return 'te-IN';
  }

  if (/\b(enakku|engalukku|eppadi|thittam|thittangal|udavi|vendum|solla|sollunga|vivasaayi|panam)\b/i.test(lower)) {
    return 'ta-IN';
  }

  if (/\b(mane|amane|kevi|rite|sahay|joiye|chhe|kaho|khedut)\b/i.test(lower)) {
    return 'gu-IN';
  }

  if (/\b(nanage|namage|hege|yojane|sahaya|beku|ide|heli|raitha|hana)\b/i.test(lower)) {
    return 'kn-IN';
  }

  if (/\b(enikku|njangalkku|enganeyanu|padhathi|venam|undu|parayamo|karshakan)\b/i.test(lower)) {
    return 'ml-IN';
  }

  // 3. Token-based Hindi vs English Grammar Comparison
  const rawTokens = lower.match(/[a-z]+/g) || [];
  let hiCount = 0;
  let enCount = 0;

  for (const token of rawTokens) {
    if (HINDI_GRAMMAR_WORDS.has(token)) hiCount++;
    if (ENGLISH_GRAMMAR_WORDS.has(token)) enCount++;
  }

  // If query is formulated with English grammar
  if (enCount > hiCount && enCount >= 2) {
    return 'en-IN';
  }

  // If Hindi grammatical markers are explicitly present
  if (hiCount > 0) {
    return 'hi-IN';
  }

  // Single English indicator with no Hindi
  if (enCount >= 1) {
    return 'en-IN';
  }

  // If regional fallback is specified
  if (fallbackLang && !['en', 'en-IN', 'en-US'].includes(fallbackLang)) {
    return fallbackLang;
  }

  return 'en-IN';
}

export function getLanguageDisplayName(langCode: string): string {
  if (LANGUAGE_NAMES[langCode]) {
    return LANGUAGE_NAMES[langCode];
  }
  const prefix = langCode.split('-')[0].toLowerCase();
  return LANGUAGE_NAMES[prefix] || 'English';
}
