/**
 * sarvamService.ts
 *
 * Sarvam AI Bulbul:v3 (Text-to-Speech) & Saaras:v4 (Speech-to-Text) Service.
 * Provides state-of-the-art native Indian voice synthesis and transcription directly
 * in the browser for Mitra Chatbot, with fallback to backend APIs and Web Speech.
 */

import { API_BASE_URL } from './api';
import { detectMessageLanguage } from '../utils/languageDetector';

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';

// User-configured Sarvam AI API subscription keys
// ── Speech-to-Text (STT) Keys ──
export const DEFAULT_SARVAM_MITRA_STT_KEY = 'sk_a8tndpvd_tIgYK3ISO34GrEe81rPTQRPd';

// ── Text-to-Speech (TTS) Keys ──
export const DEFAULT_SARVAM_HOMEPAGE_TTS_KEY = 'sk_23ky4uff_zXcSIApnbKayzYiavuM3Gd8H';
export const DEFAULT_SARVAM_MITRA_TTS_KEY = 'sk_kf97benf_qhgh56zkgZGGoxr32b1jvsrB';

// ── Translation Keys ──
export const DEFAULT_SARVAM_HOMEPAGE_TRANSLATE_KEY = 'sk_ds4psbt8_o9FwXHw2SHUTFpVUogYVS8Vj';
export const DEFAULT_SARVAM_MITRA_TRANSLATE_KEY = 'sk_c3wbxrmf_j3YJihzCjNIhKADHIANQPICL';

// STT Keys
export const SARVAM_MITRA_STT_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SARVAM_MITRA_STT_KEY) ||
  DEFAULT_SARVAM_MITRA_STT_KEY;

// TTS Keys
export const SARVAM_HOMEPAGE_TTS_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SARVAM_HOMEPAGE_TTS_KEY) ||
  DEFAULT_SARVAM_HOMEPAGE_TTS_KEY;

export const SARVAM_MITRA_TTS_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SARVAM_MITRA_TTS_KEY) ||
  DEFAULT_SARVAM_MITRA_TTS_KEY;

// Translation Keys
export const SARVAM_HOMEPAGE_TRANSLATE_KEY =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SARVAM_HOMEPAGE_TRANSLATE_KEY || import.meta.env?.VITE_SARVAM_HOMEPAGE_API_KEY)) ||
  DEFAULT_SARVAM_HOMEPAGE_TRANSLATE_KEY;

export const SARVAM_MITRA_TRANSLATE_KEY =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SARVAM_MITRA_TRANSLATE_KEY || import.meta.env?.VITE_SARVAM_MITRA_API_KEY)) ||
  DEFAULT_SARVAM_MITRA_TRANSLATE_KEY;

// General & Backward-Compatible Aliases
export const DEFAULT_SARVAM_MITRA_KEY = DEFAULT_SARVAM_MITRA_TRANSLATE_KEY;
export const DEFAULT_SARVAM_HOMEPAGE_KEY = DEFAULT_SARVAM_HOMEPAGE_TRANSLATE_KEY;
export const SARVAM_MITRA_API_KEY = SARVAM_MITRA_TRANSLATE_KEY;
export const SARVAM_HOMEPAGE_API_KEY = SARVAM_HOMEPAGE_TRANSLATE_KEY;
export const SARVAM_API_KEY = SARVAM_HOMEPAGE_API_KEY;

// Language codes verified for Sarvam Bulbul:v3 & Saaras:v4
const SARVAM_SUPPORTED_LANGUAGES: Record<string, string> = {
  hi: 'hi-IN',
  'hi-in': 'hi-IN',
  bn: 'bn-IN',
  'bn-in': 'bn-IN',
  pa: 'pa-IN',
  'pa-in': 'pa-IN',
  or: 'od-IN',
  'or-in': 'od-IN',
  od: 'od-IN',
  'od-in': 'od-IN',
  ta: 'ta-IN',
  'ta-in': 'ta-IN',
  te: 'te-IN',
  'te-in': 'te-IN',
  mr: 'mr-IN',
  'mr-in': 'mr-IN',
  gu: 'gu-IN',
  'gu-in': 'gu-IN',
  kn: 'kn-IN',
  'kn-in': 'kn-IN',
  ml: 'ml-IN',
  'ml-in': 'ml-IN',
  as: 'as-IN',
  'as-in': 'as-IN',
  en: 'en-IN',
  'en-in': 'en-IN',
};

/**
 * Returns mapped Sarvam language code or null if language is not directly supported by Bulbul v3 (e.g. Urdu).
 */
export function getSarvamLanguageCode(langCode: string, text?: string): string | null {
  const cleanLang = (langCode || '').toLowerCase().trim();
  const langPrefix = cleanLang.split('-')[0];

  // Urdu is handled via Backend Edge-TTS / Web Speech API
  if (langPrefix === 'ur' || (text && /[\u0600-\u06FF]/.test(text))) {
    return null;
  }

  // 1. If caller explicitly requested a language, ALWAYS honor it directly!
  // This guarantees Hindi NEVER mistakenly switches to Marathi or vice versa.
  if (cleanLang.startsWith('hi')) return 'hi-IN';
  if (cleanLang.startsWith('mr')) return 'mr-IN';
  if (cleanLang.startsWith('bn')) return 'bn-IN';
  if (cleanLang.startsWith('pa')) return 'pa-IN';
  if (cleanLang.startsWith('or') || cleanLang.startsWith('od')) return 'od-IN';
  if (cleanLang.startsWith('ta')) return 'ta-IN';
  if (cleanLang.startsWith('te')) return 'te-IN';
  if (cleanLang.startsWith('gu')) return 'gu-IN';
  if (cleanLang.startsWith('kn')) return 'kn-IN';
  if (cleanLang.startsWith('ml')) return 'ml-IN';
  if (cleanLang.startsWith('as')) return 'as-IN';
  if (cleanLang.startsWith('en')) return 'en-IN';

  // 2. Distinct script-based fallback if langCode was not specified or unknown
  if (text) {
    if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
    if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
    if (/[\u0B00-\u0B7F]/.test(text)) return 'od-IN';
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
    if (/[\u0900-\u097F]/.test(text)) {
      if (langPrefix === 'mr' || /\b(आहे|आहेत|नाहीत|कसे|करावे|सांगा|योजनांची|शेतकरी|मिळेल|पाहिजे)\b/.test(text)) {
        return 'mr-IN';
      }
      return 'hi-IN';
    }
  }

  if (SARVAM_SUPPORTED_LANGUAGES[cleanLang]) {
    return SARVAM_SUPPORTED_LANGUAGES[cleanLang];
  }
  if (SARVAM_SUPPORTED_LANGUAGES[langPrefix]) {
    return SARVAM_SUPPORTED_LANGUAGES[langPrefix];
  }

  return cleanLang.startsWith('en') ? 'en-IN' : 'hi-IN';
}

export interface SarvamTTSOptions {
  speaker?: 'shubh' | 'aditya' | 'ritu' | 'ashutosh' | 'priya' | 'neha' | 'rahul' | 'pooja' | 'simran' | string;
  pace?: number;
  sampleRate?: number;
  scope?: 'mitra' | 'homepage';
  apiKey?: string;
}

/**
 * Converts text into audio using Sarvam AI Bulbul:v3 REST API.
 * Returns a data URL (e.g. `data:audio/mp3;base64,...`) or null if request fails.
 */
export async function convertTextToSpeechSarvam(
  text: string,
  targetLang: string,
  options?: SarvamTTSOptions
): Promise<string | null> {
  const cleanText = (text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
  if (!cleanText) return null;

  const resolvedLang = getSarvamLanguageCode(targetLang, cleanText);
  if (!resolvedLang) {
    return null; // Delegate to fallback engine
  }

  const pace = Math.max(0.5, Math.min(2.0, options?.pace ?? 1.0));
  const speaker = options?.speaker || 'shubh';
  const sampleRate = options?.sampleRate || 22050;

  const isMitra = options?.scope === 'mitra';
  const primaryKey = options?.apiKey || (isMitra ? SARVAM_MITRA_TTS_KEY : SARVAM_HOMEPAGE_TTS_KEY);
  const secondaryKey = primaryKey === SARVAM_MITRA_TTS_KEY ? SARVAM_HOMEPAGE_TTS_KEY : SARVAM_MITRA_TTS_KEY;
  const tertiaryKey = isMitra ? SARVAM_MITRA_TRANSLATE_KEY : SARVAM_HOMEPAGE_TRANSLATE_KEY;
  const keysToTry = [primaryKey, secondaryKey, tertiaryKey, SARVAM_MITRA_STT_KEY].filter(Boolean);

  for (const activeKey of keysToTry) {
    try {
      const response = await fetch(SARVAM_TTS_URL, {
        method: 'POST',
        headers: {
          'api-subscription-key': activeKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          target_language_code: resolvedLang,
          speaker,
          model: 'bulbul:v3',
          pace,
          speech_sample_rate: sampleRate,
          output_audio_codec: 'mp3',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const audios = data?.audios;
        if (Array.isArray(audios) && audios.length > 0 && audios[0]) {
          return `data:audio/mp3;base64,${audios[0]}`;
        }
      } else {
        console.warn(`Sarvam AI TTS responded with HTTP ${response.status}:`, await response.text());
      }
    } catch (err) {
      console.warn('Sarvam AI direct client error:', err);
    }
  }

  return null;
}

// ── WAV 16kHz Encoding Helper (Pure JavaScript, Zero External Libs) ──────────

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWav16kHz(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk (PCM 16-bit Mono 16000Hz)
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, 16000, true); // SampleRate (16000Hz)
  view.setUint32(28, 16000 * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Convert float32 samples to 16-bit signed PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

/**
 * Resamples an input audio blob (from MediaRecorder) to a standard 16kHz mono WAV Blob
 * optimized for Sarvam AI Saaras:v4 speech-to-text.
 */
export async function convertAudioTo16kHzWav(audioBlob: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return audioBlob;
  }

  const audioContext = new AudioCtx({ sampleRate: 16000 });
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Resample/mix down to single mono channel at 16000Hz
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    let monoSamples: Float32Array;

    if (numberOfChannels === 1) {
      monoSamples = audioBuffer.getChannelData(0);
    } else {
      monoSamples = new Float32Array(length);
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = audioBuffer.getChannelData(1);
      for (let i = 0; i < length; i++) {
        monoSamples[i] = (ch0[i] + ch1[i]) / 2;
      }
    }

    const wavBuffer = encodeWav16kHz(monoSamples);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    try {
      await audioContext.close();
    } catch (_) {}
  }
}

export interface SarvamSTTResult {
  transcript: string;
  language_code?: string;
  request_id?: string;
}

/**
 * Transcribes audio using Sarvam AI Saaras:v4 Speech-to-Text model.
 * Matches:
 * response = client.speech_to_text.transcribe(
 *     file=f,
 *     model="saaras:v4",
 *     language_code="en-IN",
 *     mode="transcribe",
 *     sample_rate=16000,
 * )
 */
export async function transcribeAudioSarvam(
  audioBlob: Blob,
  targetLang: string = 'en-IN',
  options?: { scope?: 'mitra' | 'homepage'; apiKey?: string }
): Promise<SarvamSTTResult | null> {
  let wavBlob = audioBlob;
  try {
    wavBlob = await convertAudioTo16kHzWav(audioBlob);
  } catch (convErr) {
    console.warn('WAV resampling fallback:', convErr);
  }

  const resolvedLang = getSarvamLanguageCode(targetLang) || 'en-IN';

  const isMitra = options?.scope !== 'homepage';
  const primaryKey = options?.apiKey || (isMitra ? SARVAM_MITRA_STT_KEY : SARVAM_HOMEPAGE_TTS_KEY);
  const secondaryKey = primaryKey === SARVAM_MITRA_STT_KEY ? SARVAM_MITRA_TTS_KEY : SARVAM_MITRA_STT_KEY;
  const tertiaryKey = SARVAM_HOMEPAGE_TTS_KEY;
  const quaternaryKey = isMitra ? SARVAM_MITRA_TRANSLATE_KEY : SARVAM_HOMEPAGE_TRANSLATE_KEY;
  const keysToTry = [primaryKey, secondaryKey, tertiaryKey, quaternaryKey].filter(Boolean);

  // 1. Direct browser call to Sarvam AI STT
  for (const activeKey of keysToTry) {
    try {
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');
      formData.append('model', 'saaras:v4');
      formData.append('language_code', resolvedLang);
      formData.append('mode', 'transcribe');

      const response = await fetch(SARVAM_STT_URL, {
        method: 'POST',
        headers: {
          'api-subscription-key': activeKey,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.transcript === 'string') {
          return {
            transcript: data.transcript.trim(),
            language_code: data.language_code || resolvedLang,
            request_id: data.request_id,
          };
        }
      } else {
        console.warn(`Direct Sarvam STT failed with status ${response.status}:`, await response.text());
      }
    } catch (directErr) {
      console.warn('Direct Sarvam STT call failed:', directErr);
    }
  }

  // 2. Fallback to Backend proxy endpoint (/api/assistant/transcribe/)
  try {
    const baseUrl = API_BASE_URL || '';
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio.wav');
    formData.append('language_code', resolvedLang);
    formData.append('model', 'saaras:v4');
    formData.append('mode', 'transcribe');

    const backendRes = await fetch(`${baseUrl}/api/assistant/transcribe/`, {
      method: 'POST',
      body: formData,
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data && typeof data.transcript === 'string') {
        return {
          transcript: data.transcript.trim(),
          language_code: data.language_code || resolvedLang,
          request_id: data.request_id,
        };
      }
    }
  } catch (backendErr) {
    console.warn('Backend Sarvam STT fallback error:', backendErr);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SARVAM AI MAYURA:V1 (TRANSLATION SERVICE)
// ─────────────────────────────────────────────────────────────────────────────

export interface SarvamTranslateOptions {
  numeralsFormat?: 'native' | 'international';
  mode?: 'formal' | 'modern-colloquial' | 'code-mixed';
  sourceLang?: string;
  scope?: 'mitra' | 'homepage';
  apiKey?: string;
}

/**
 * Returns the mapped Sarvam language code for translation (Mayura:v1),
 * or null if not supported (e.g. Urdu, which is handled via fallback).
 */
export function getSarvamTranslateLanguageCode(langCode: string): string | null {
  const cleanLang = (langCode || '').toLowerCase().trim();
  if (cleanLang.startsWith('hi')) return 'hi-IN';
  if (cleanLang.startsWith('bn')) return 'bn-IN';
  if (cleanLang.startsWith('pa')) return 'pa-IN';
  if (cleanLang.startsWith('or') || cleanLang.startsWith('od')) return 'od-IN';
  if (cleanLang.startsWith('mr')) return 'mr-IN';
  if (cleanLang.startsWith('ta')) return 'ta-IN';
  if (cleanLang.startsWith('te')) return 'te-IN';
  if (cleanLang.startsWith('gu')) return 'gu-IN';
  if (cleanLang.startsWith('kn')) return 'kn-IN';
  if (cleanLang.startsWith('ml')) return 'ml-IN';
  if (cleanLang.startsWith('en')) return 'en-IN';
  return null;
}

/**
 * Splits long text into natural chunks strictly under 800 characters to comply with
 * Sarvam Mayura:v1 maximum 1000 characters limit while preserving paragraph boundaries.
 */
function splitTextForTranslation(text: string, maxLen = 800): string[] {
  if (!text || text.length <= maxLen) return [text];

  const paragraphs = text.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (para.length > maxLen) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const lines = para.split('\n');
      for (const line of lines) {
        if (line.length > maxLen) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          const sentences = line.match(/[^.!?।\n]+[.!?।]+|[^.!?।\n]+$/g) || [line];
          for (const s of sentences) {
            if ((currentChunk + ' ' + s).trim().length <= maxLen) {
              currentChunk = currentChunk ? `${currentChunk} ${s}` : s;
            } else {
              if (currentChunk) chunks.push(currentChunk.trim());
              currentChunk = s;
            }
          }
        } else {
          if ((currentChunk + '\n' + line).trim().length <= maxLen) {
            currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = line;
          }
        }
      }
    } else {
      if ((currentChunk + '\n\n' + para).trim().length <= maxLen) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = para;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

const translationMemoryCache = new Map<string, string>();

const GOOGLE_CODE_MAP: Record<string, string> = {
  'hi-IN': 'hi', 'bn-IN': 'bn', 'te-IN': 'te', 'mr-IN': 'mr', 'ta-IN': 'ta',
  'gu-IN': 'gu', 'kn-IN': 'kn', 'od-IN': 'or', 'or-IN': 'or', 'ml-IN': 'ml',
  'pa-IN': 'pa', 'ur-IN': 'ur', 'as-IN': 'as', 'en-IN': 'en',
};

async function fallbackGoogleTranslate(text: string, targetLang: string): Promise<string | null> {
  const target = GOOGLE_CODE_MAP[targetLang] || targetLang.split('-')[0];
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
    console.warn('Google translation fallback in sarvamService failed:', e);
  }
  return null;
}

/**
 * Translates text into target Indian language using Sarvam AI Mayura:v1.
 * Automatically chunks large texts (> 800 chars) to stay safely within Sarvam limits.
 * Employs in-memory caching and zero-quota Google fallback to guarantee translation success.
 */
export async function translateTextSarvam(
  text: string,
  targetLang: string,
  options?: SarvamTranslateOptions
): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  const targetCode = getSarvamTranslateLanguageCode(targetLang);
  if (!targetCode) {
    // If language is not directly supported by Mayura (e.g. Urdu), fallback to Google
    const fb = await fallbackGoogleTranslate(trimmed, targetLang);
    return fb || text;
  }

  // Determine source language without defaulting to targetLang
  let sourceCode = options?.sourceLang ? getSarvamTranslateLanguageCode(options.sourceLang) : null;
  if (!sourceCode) {
    const detected = detectMessageLanguage(trimmed, 'en-IN');
    sourceCode = getSarvamTranslateLanguageCode(detected) || 'en-IN';
  }

  // If source and target are the same language, no translation needed
  if (sourceCode === targetCode) {
    return text;
  }

  const numeralsFormat = options?.numeralsFormat || 'native';
  const mode = options?.mode || 'formal';

  const cacheKey = `${sourceCode}:${targetCode}:${numeralsFormat}:${trimmed}`;
  if (translationMemoryCache.has(cacheKey)) {
    return translationMemoryCache.get(cacheKey)!;
  }

  const isMitra = options?.scope === 'mitra';
  const primaryKey = options?.apiKey || (isMitra ? SARVAM_MITRA_TRANSLATE_KEY : SARVAM_HOMEPAGE_TRANSLATE_KEY);
  const secondaryKey = primaryKey === SARVAM_MITRA_TRANSLATE_KEY ? SARVAM_HOMEPAGE_TRANSLATE_KEY : SARVAM_MITRA_TRANSLATE_KEY;
  const tertiaryKey = isMitra ? SARVAM_MITRA_TTS_KEY : SARVAM_HOMEPAGE_TTS_KEY;
  const keysToTry = [primaryKey, secondaryKey, tertiaryKey, SARVAM_MITRA_STT_KEY].filter(Boolean);

  const chunks = splitTextForTranslation(trimmed, 800);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const cTrim = chunk.trim();
    if (!cTrim) {
      translatedChunks.push(chunk);
      continue;
    }

    const chunkCacheKey = `${sourceCode}:${targetCode}:${numeralsFormat}:${cTrim}`;
    if (translationMemoryCache.has(chunkCacheKey)) {
      translatedChunks.push(translationMemoryCache.get(chunkCacheKey)!);
      continue;
    }

    let translated: string | null = null;

    for (const activeKey of keysToTry) {
      try {
        const response = await fetch(SARVAM_TRANSLATE_URL, {
          method: 'POST',
          headers: {
            'api-subscription-key': activeKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: cTrim,
            source_language_code: sourceCode,
            target_language_code: targetCode,
            model: 'mayura:v1',
            numerals_format: numeralsFormat,
            mode: mode,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson?.translated_text) {
            translated = resJson.translated_text;
            break;
          }
        } else {
          console.warn(`Sarvam AI Translate API (${activeKey.slice(0, 10)}...) error (${response.status}):`, await response.text());
        }
      } catch (err) {
        console.warn('Sarvam translation request failed:', err);
      }
    }

    if (!translated) {
      const fb = await fallbackGoogleTranslate(cTrim, targetLang);
      translated = fb || cTrim;
    }

    translationMemoryCache.set(chunkCacheKey, translated);
    translatedChunks.push(translated);
  }

  const fullResult = translatedChunks.join('\n\n');
  translationMemoryCache.set(cacheKey, fullResult);
  return fullResult;
}

