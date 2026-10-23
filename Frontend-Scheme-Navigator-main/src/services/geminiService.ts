/**
 * geminiService.ts — Direct, low-latency Google Gemini AI caller for Scheme Navigator (Mitra AI).
 *
 * Uses official Google AI Studio Gemini models:
 * - gemini-2.5-flash (primary hybrid reasoning model, ~1.2s latency)
 * - gemini-2.5-flash-lite (ultra-fast fallback)
 */

import { UserProfile, Scheme } from '../types';
import { detectMessageLanguage, getLanguageDisplayName } from '../utils/languageDetector';
import { rankSchemesForProfile, calculateSchemeMatch } from './matchingEngine';

export const DEFAULT_GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';
const STORAGE_KEY = 'sn_gemini_api_key';

export function getGeminiApiKey(): string {
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (envKey && envKey.length > 15 && !envKey.toLowerCase().startsWith('your_')) {
    return envKey;
  }
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_KEY)?.trim();
  if (stored && stored.length > 15 && !stored.toLowerCase().startsWith('your_')) {
    return stored;
  }
  return '';
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const clean = key.trim();
  if (!clean) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, clean);
  }
  window.dispatchEvent(new Event('sn_gemini_key_updated'));
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export async function askGeminiDirect(
  query: string,
  history: Array<{ role: string; content: string }> = [],
  profile: UserProfile | null = null,
  language: string = 'en-IN',
  schemesCatalog: Scheme[] = []
): Promise<{ answer: string; referencedSchemes: Scheme[] }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  // 1. Build profile context
  let profileContext = 'No profile provided.';
  if (profile) {
    const parts: string[] = [];
    if (profile.age) parts.push(`Age: ${profile.age}`);
    if (profile.gender) parts.push(`Gender: ${profile.gender}`);
    if (profile.state) parts.push(`State: ${profile.state}`);
    if (profile.district) parts.push(`District: ${profile.district}`);
    if (profile.areaType) parts.push(`Area: ${profile.areaType}`);
    const occ = profile.employmentType || (profile as any).occupation;
    if (occ) parts.push(`Occupation/Employment: ${occ}`);
    if (profile.studentCourse) parts.push(`Studies/Course: ${profile.studentCourse}`);
    const cat = profile.category || (profile as any).caste_category;
    if (cat) parts.push(`Category: ${cat}`);
    const inc = profile.incomeRange || (profile as any).income;
    if (inc) parts.push(`Income: ${inc}`);
    if (profile.hasBPLCard !== undefined) parts.push(`BPL/Ration Card: ${profile.hasBPLCard ? 'Yes' : 'No'}`);
    if (profile.isDisability !== undefined) parts.push(`Disability: ${profile.isDisability ? 'Yes' : 'No'}`);
    profileContext = parts.join(' • ');
  }

  // 2. Select matching schemes for grounding from catalog using deterministic rules
  const qLower = query.toLowerCase();
  const occLower = (profile?.employmentType || '').toLowerCase();
  const stateLower = (profile?.state || '').toLowerCase();

  let relevant: Scheme[] = [];

  if (profile && (profile.age || profile.state || occLower || profile.category)) {
    const rankedResults = rankSchemesForProfile(profile, schemesCatalog);
    relevant = rankedResults.slice(0, 8).map(r => r.scheme);
  }

  // If query specifies keywords or we need more schemes, supplement
  const queryMatched = schemesCatalog.filter((s) => {
    const sName = (s.name || '').toLowerCase();
    const sCat = (s.category || '').toLowerCase();
    const sDesc = (s.shortDescription || '').toLowerCase();
    const matchQuery = sName.includes(qLower) || sCat.includes(qLower) || sDesc.includes(qLower);
    const matchOcc = occLower && (sName.includes(occLower) || sCat.includes(occLower) || sDesc.includes(occLower));
    const matchState = stateLower && (s.coveredStates?.some((st) => st.toLowerCase() === stateLower) ?? false);
    return matchQuery || matchOcc || matchState;
  });

  for (const s of queryMatched) {
    if (!relevant.some(r => r.id === s.id)) {
      relevant.push(s);
    }
  }

  if (relevant.length < 6) {
    for (const s of schemesCatalog) {
      if (!relevant.some(r => r.id === s.id)) {
        relevant.push(s);
      }
      if (relevant.length >= 8) break;
    }
  }

  relevant = relevant.slice(0, 8);

  const schemeSnippets = relevant
    .map((s) => {
      const ben = s.benefits?.[0]?.amountOrValue || s.benefits?.[0]?.title || '';
      const cond = s.eligibility?.customConditions?.[0] || '';
      return `[${s.slug}] ${s.name} (${s.category}): ${s.shortDescription} ${ben ? `| Benefit: ${ben}` : ''} ${cond ? `| Eligibility Rule: ${cond}` : ''}`;
    })
    .join('\n');

  // 3. System Instruction & Query Language Detection
  const targetLang = detectMessageLanguage(query, language || 'en-IN');
  const langName = getLanguageDisplayName(targetLang);

  const systemInstruction = `You are Mitra (मित्र / মিত্র / متر / ਮਿੱਤਰ / ಮಿತ್ರ / మిత్ర / மித்ரா), the expert AI Welfare Advisor on Scheme Navigator for Indian citizens.
CRITICAL ABSOLUTE MULTILINGUAL MANDATE:
Generate your response strictly and 100% in ${langName}.
- If the user asks in English, respond STRICTLY and 100% in English! Never switch to Hindi or another language for an English query.
- If the user asks in Hindi or Hinglish, respond 100% in natural Hindi using Devanagari script (हिंदी).
- If the user asks in Bengali or Banglish, respond 100% in fluent Bengali script (বাংলা).
- If the user asks in Odia or Roman Odia, respond 100% in fluent Odia script (ଓଡ଼ିଆ).
- If the user asks in Urdu or Roman Urdu, respond 100% in fluent Urdu using Perso-Arabic script (اردو).
- If the user asks in Punjabi or Roman Punjabi, respond 100% in fluent Punjabi using Gurmukhi script (ਪੰਜਾਬੀ).
- If the user asks in Marathi, respond 100% in fluent Marathi script (मराठी).
- If the user asks in Telugu, respond 100% in fluent Telugu script (తెలుగు).
- If the user asks in Tamil, respond 100% in fluent Tamil script (தமிழ்).
- If the user asks in Gujarati, respond 100% in fluent Gujarati script (ગુજરાતી).
- If the user asks in Kannada, respond 100% in fluent Kannada script (ಕನ್ನಡ).
- If the user asks in Malayalam, respond 100% in fluent Malayalam script (മലയാളം).
- CRITICAL: Never default to a different language than what the user asked in. Strictly mirror the user's inquiry language!

CITIZEN PROFILE PERSONALIZATION & DETERMINISTIC ELIGIBILITY RULES:
The citizen has the following verified profile:
${profileContext}

CRITICAL MANDATORY RULES:
1. MANDATORY AT LEAST 5 SCHEMES: Whenever the user asks for scheme recommendations, options, or asks what schemes they qualify for, you MUST recommend and detail AT LEAST 5 ELIGIBLE SCHEMES. Never provide only 1 scheme!
2. DETERMINISTIC ELIGIBILITY RULES: For EACH of the 5 schemes, explain explicitly WHY the citizen qualifies based on deterministic rules comparing their Age, State, Occupation, Category, Gender, and Income against the scheme's criteria.
   - Example: "चूंकि आपकी आयु 22 वर्ष है, आप छात्र हैं और OBC वर्ग से आते हैं, अतः आप इस छात्रवृत्ति योजना के लिए पूर्णतः पात्र हैं।"
3. For EACH scheme include:
   - 🎯 Scheme Name & Category
   - 👥 Deterministic Eligibility Reason (why they qualify based on Age, State, Occupation, Category)
   - 💰 Benefit (Amount or subsidy)
   - 📄 Required Documents Checklist
   - 🌐 Official Application Link
4. Append ALL 5+ scheme slugs at the very end like: <schemes>slug-1,slug-2,slug-3,slug-4,slug-5</schemes>.

RELEVANT SCHEMES CONTEXT (Grounded from Database):
${schemeSnippets || 'National Flagship Schemes: Ayushman Bharat (PM-JAY), PM-KISAN, PM Mudra Yojana, National Scholarship Portal, PM SVANidhi, PM Vishwakarma'}`;

  // 4. Format contents strictly alternating user and model
  const contents: GeminiMessage[] = [];

  for (const h of history.slice(-6)) {
    const role = h.role === 'user' ? 'user' : 'model';
    const text = (h.content || '').trim();
    if (!text) continue;

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += '\n\n' + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // Ensure first is user
  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  // Append current query
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += '\n\n' + query;
  } else {
    contents.push({ role: 'user', parts: [{ text: query }] });
  }

  const payload = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };

  const modelsToTry = [
    'gemini-flash-lite-latest',
    'gemma-4-26b-a4b-it',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-pro-latest',
  ];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) {
          // Parse referenced slugs
          const slugMatch = rawText.match(/<schemes>(.*?)<\/schemes>/i);
          const rawSlugs = slugMatch ? slugMatch[1].split(',').map((s: string) => s.trim().toLowerCase()) : [];
          const cleanAnswer = rawText.replace(/<schemes>.*?<\/schemes>/gis, '').trim();

          const referencedSchemes: Scheme[] = [];
          for (const s of rawSlugs) {
            const found = schemesCatalog.find((item) => item.slug.toLowerCase() === s);
            if (found && !referencedSchemes.some((r) => r.id === found.id)) {
              referencedSchemes.push(found);
            }
          }

          // Ensure at least 5 schemes are referenced so interactive cards render
          if (referencedSchemes.length < 5 && relevant.length > 0) {
            for (const r of relevant) {
              if (!referencedSchemes.some((item) => item.id === r.id)) {
                referencedSchemes.push(r);
              }
              if (referencedSchemes.length >= 5) break;
            }
          }

          return { answer: cleanAnswer, referencedSchemes };
        }
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Gemini API authentication failed (Status ${res.status}). Please check your API key.`);
      } else if (res.status === 404 || res.status === 429) {
        // Try next model
        continue;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error(`Gemini request timed out on model ${model}`);
      } else {
        lastError = err;
        if (err.message && (err.message.includes('authentication') || err.message.includes('API key'))) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models were unavailable.');
}
