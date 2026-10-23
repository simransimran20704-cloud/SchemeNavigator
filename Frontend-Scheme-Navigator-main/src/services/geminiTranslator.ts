/**
 * geminiTranslator.ts — Real-time Google Gemini AI Translation Engine for Scheme Navigator.
 * Uses the user's configured Gemini API key to translate any dynamic government scheme terminology word-to-word.
 */

import { getGeminiApiKey, DEFAULT_GEMINI_API_KEY } from './geminiService';

const CACHE_KEY = 'sn_gemini_translation_cache_v2';
const memoryCache = new Map<string, string>();

// Initialize memory cache from localStorage
try {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') {
          memoryCache.set(k, v);
        }
      });
    }
  }
} catch {
  // Ignore localStorage parsing errors
}

function getCacheKey(text: string, langCode: string): string {
  return `${langCode.toLowerCase()}:::${text.trim().toLowerCase()}`;
}

export function getCachedTranslation(text: string, langCode: string): string | null {
  if (!text || !langCode || langCode === 'en-IN' || langCode === 'en') return text;
  const key = getCacheKey(text, langCode);
  return memoryCache.get(key) || null;
}

export function setCachedTranslation(text: string, langCode: string, translation: string): void {
  if (!text || !langCode || !translation) return;
  const key = getCacheKey(text, langCode);
  memoryCache.set(key, translation);

  try {
    if (typeof window !== 'undefined') {
      const existing = localStorage.getItem(CACHE_KEY);
      const parsed = existing ? JSON.parse(existing) : {};
      parsed[key] = translation;
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
      window.dispatchEvent(new CustomEvent('sn_translations_updated', { detail: { text, langCode, translation } }));
    }
  } catch {
    // Ignore storage quota limits
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  'hi-IN': 'Hindi (हिन्दी)',
  'or-IN': 'Odia (ଓଡ଼ିଆ)',
  'bn-IN': 'Bengali (বাংলা)',
  'te-IN': 'Telugu (తెలుగు)',
  'ta-IN': 'Tamil (தமிழ்)',
  'mr-IN': 'Marathi (मराठी)',
  'gu-IN': 'Gujarati (ગુજરાતી)',
  'kn-IN': 'Kannada (ಕನ್ನಡ)',
  'ml-IN': 'Malayalam (മലയാളം)',
  'pa-IN': 'Punjabi (ਪੰਜਾਬੀ)',
  'ur-IN': 'Urdu (اردو)',
  'en-IN': 'English',
};

const MODELS = [
  'gemini-flash-lite-latest',
  'gemma-4-26b-a4b-it',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-pro-latest',
];

const GOOGLE_LANG_MAP: Record<string, string> = {
  'hi-IN': 'hi',
  'bn-IN': 'bn',
  'te-IN': 'te',
  'mr-IN': 'mr',
  'ta-IN': 'ta',
  'gu-IN': 'gu',
  'kn-IN': 'kn',
  'or-IN': 'or',
  'od-IN': 'or',
  'ml-IN': 'ml',
  'pa-IN': 'pa',
  'ur-IN': 'ur',
  'as-IN': 'as',
  'en-IN': 'en',
};

export async function translateWithGoogle(text: string, langCode: string): Promise<string | null> {
  const target = GOOGLE_LANG_MAP[langCode] || langCode.split('-')[0];
  if (!target || target === 'en') return text;
  const trimmed = text.trim();
  if (!trimmed) return '';

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map((part: any) => part?.[0] || '').join('');
      if (translated && translated.trim() && translated.trim() !== trimmed) {
        return translated.trim();
      }
    }
  } catch (e) {
    console.warn('Google translation fallback failed:', e);
  }
  return null;
}

import { translateTextSarvam } from './sarvamService';

/**
 * Translates arbitrary text into the target language using Sarvam AI Mayura:v1 (Primary),
 * Google Translate Engine (High-speed Fallback), and Google Gemini AI (Reasoning Fallback).
 * Automatically caches translations in localStorage.
 */
export async function translateWithGemini(
  text: string,
  langCode: string,
  options?: { scope?: 'mitra' | 'homepage'; apiKey?: string }
): Promise<string> {
  if (!text || !langCode || langCode === 'en-IN' || langCode === 'en') {
    return text;
  }

  const cached = getCachedTranslation(text, langCode);
  if (cached) {
    return cached;
  }

  // 1. Primary Engine: Sarvam AI Mayura:v1 (native accuracy for Indic languages)
  try {
    const sarvamResult = await translateTextSarvam(text, langCode, {
      numeralsFormat: 'native',
      mode: 'formal',
      scope: options?.scope,
      apiKey: options?.apiKey,
    });
    if (sarvamResult && sarvamResult.trim() && sarvamResult.trim() !== text.trim()) {
      const cleaned = sarvamResult.trim();
      setCachedTranslation(text, langCode, cleaned);
      return cleaned;
    }
  } catch (sarvamErr) {
    console.warn('Sarvam translation in geminiTranslator failed, trying Google/Gemini fallback:', sarvamErr);
  }

  // 2. High-speed Fallback Engine: Google Translate API (Zero quota, instant browser-compatible)
  try {
    const googleResult = await translateWithGoogle(text, langCode);
    if (googleResult && googleResult.trim() && googleResult.trim() !== text.trim()) {
      const cleaned = googleResult.trim();
      setCachedTranslation(text, langCode, cleaned);
      return cleaned;
    }
  } catch (googleErr) {
    console.warn('Google translate fallback failed, trying Gemini models:', googleErr);
  }

  // 2. Secondary Fallback Engine: Google Gemini AI
  const apiKey = getGeminiApiKey() || DEFAULT_GEMINI_API_KEY;
  if (!apiKey) {
    return text;
  }

  const targetLang = LANGUAGE_NAMES[langCode] || langCode;
  const prompt = `You are an expert translator for the Indian Government Scheme Navigator portal.
Translate the following English text to ${targetLang} accurately and word-to-word.
Text to translate:
"${text}"

Rules:
1. Return ONLY the translated string in ${targetLang}.
2. Do NOT add notes, quotes, explanations, or introductory text.
3. Preserve numbers, acronyms (like DBT, PVC, PDF, CSC), and URLs unchanged.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
    },
  };

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidate) {
          const cleaned = candidate.replace(/^[\"']|[\"']$/g, '').trim();
          setCachedTranslation(text, langCode, cleaned);
          return cleaned;
        }
      }
    } catch {
      // Try next model
      continue;
    }
  }

  return text;
}

/**
 * Universal dynamic translation alias.
 */
export const translateDynamicText = translateWithGemini;

/**
 * Batch translation helper
 */
export async function translateBatchWithGemini(
  texts: string[],
  langCode: string,
  options?: { scope?: 'mitra' | 'homepage'; apiKey?: string }
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const pending: string[] = [];

  for (const txt of texts) {
    const cached = getCachedTranslation(txt, langCode);
    if (cached) {
      result[txt] = cached;
    } else {
      pending.push(txt);
    }
  }

  if (pending.length === 0) return result;

  await Promise.all(
    pending.map(async (txt) => {
      try {
        result[txt] = await translateWithGemini(txt, langCode, options);
      } catch {
        result[txt] = txt;
      }
    })
  );

  return result;
}

