"""
High-fidelity Neural Text-to-Speech (TTS) service for SchemeNavigator.
Powered primarily by Sarvam AI (Bulbul:v3) for state-of-the-art native Indian voice synthesis,
with intelligent Edge-TTS fallback (including native Urdu voices) and instant disk caching.
"""
import asyncio
import base64
import hashlib
import logging
import os
import re
from django.conf import settings
import edge_tts
import httpx

logger = logging.getLogger(__name__)

CACHE_DIR = getattr(settings, "TTS_CACHE_DIR", os.path.join(settings.BASE_DIR, "cache_tts"))
os.makedirs(CACHE_DIR, exist_ok=True)

# ── Sarvam AI Credentials & Configuration ─────────────────────────────────────
SARVAM_HOMEPAGE_TTS_KEY = getattr(settings, "SARVAM_HOMEPAGE_TTS_KEY", os.getenv("SARVAM_HOMEPAGE_TTS_KEY", "sk_23ky4uff_zXcSIApnbKayzYiavuM3Gd8H"))
SARVAM_MITRA_TTS_KEY = getattr(settings, "SARVAM_MITRA_TTS_KEY", os.getenv("SARVAM_MITRA_TTS_KEY", "sk_kf97benf_qhgh56zkgZGGoxr32b1jvsrB"))
SARVAM_MITRA_API_KEY = getattr(settings, "SARVAM_MITRA_API_KEY", os.getenv("SARVAM_MITRA_API_KEY", "sk_c3wbxrmf_j3YJihzCjNIhKADHIANQPICL"))
SARVAM_HOMEPAGE_API_KEY = getattr(settings, "SARVAM_HOMEPAGE_API_KEY", os.getenv("SARVAM_HOMEPAGE_API_KEY", "sk_ds4psbt8_o9FwXHw2SHUTFpVUogYVS8Vj"))
SARVAM_API_KEY = getattr(settings, "SARVAM_API_KEY", SARVAM_HOMEPAGE_TTS_KEY)
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

# BCP-47 language codes officially verified on Sarvam Bulbul:v3
SARVAM_LANG_MAP = {
    "hi": "hi-IN",
    "bn": "bn-IN",
    "pa": "pa-IN",
    "or": "od-IN",
    "od": "od-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "as": "as-IN",
    "en": "en-IN",
}

ONES = [
    '', 'ଏକ', 'ଦୁଇ', 'ତିନି', 'ଚାରି', 'ପାଞ୍ଚ', 'ଛଅ', 'ସାତ', 'ଆଠ', 'ନଅ', 'ଦଶ',
    'ଏଗାର', 'ବାର', 'ତେର', 'ଚଉଦ', 'ପନ୍ଦର', 'ଷୋହଳ', 'ସତର', 'ଅଠର', 'ଉଣେଇଶ', 'କୋଡ଼ିଏ',
    'ଏକୋଇଶ', 'ବାଇଶ', 'ତେଇଶ', 'ଚବିଶ', 'ପଚିଶ', 'ଛବିଶ', 'ସତେଇଶ', 'ଅଠେଇଶ', 'ଅଣତିରିଶ', 'ତିରିଶ',
    'ଏକତିରିଶ', 'ବତିଶ', 'ତେତିଶ', 'ଚୌତିଶ', 'ପଇଁତିରିଶ', 'ଛତିଶ', 'ସଇଁତିରିଶ', 'ଅଠତିରିଶ', 'ଅଣଚାଳିଶ', 'ଚାଳିଶ',
    'ଏକଚାଳିଶ', 'ବିୟାଳିଶ', 'ତେୟାଳିଶ', 'ଚଉରାଳିଶ', 'ପଞ୍ଚଚାଳିଶ', 'ଛୟାଳିଶ', 'ସତଚାଳିଶ', 'ଅଠଚାଳିଶ', 'ଅଣଚାଶ', 'ପଚାଶ',
    'ଏକାବନ', 'ବାଅନ', 'ତେପନ', 'ଚଉବନ', 'ପଞ୍ଚାବନ', 'ଛପନ', 'ସତାବନ', 'ଅଠାବନ', 'ଅଣଷଠି', 'ଷାଠିଏ',
    'ଏକଷଠି', 'ବାଷଠି', 'ତେଷଠି', 'ଚୌଷଠି', 'ପଞ୍ଚଷଠି', 'ଛଷଠି', 'ସତଷଠି', 'ଅଠଷଠି', 'ଅଣସତରୀ', 'ସତୁରୀ',
    'ଏକସ୍ତରୀ', 'ବାସ୍ତରୀ', 'ତେସ୍ତରୀ', 'ଚଉସ୍ତରୀ', 'ପଞ୍ଚସ୍ତରୀ', 'ଛଅସ୍ତରୀ', 'ସତସ୍ତରୀ', 'ଅଠସ୍ତରୀ', 'ଅଣଅଶୀ', 'ଅଶୀ',
    'ଏକାଶୀ', 'ବିୟାଶୀ', 'ତେୟାଶୀ', 'ଚଉରାଶୀ', 'ପଞ୍ଚାଶୀ', 'ଛୟାଶୀ', 'ସତାଶୀ', 'ଅଠାଶୀ', 'ଅଣନବେ', 'ନବେ',
    'ଏକାନବେ', 'ବିୟାନବେ', 'ତେୟାନବେ', 'ଚଉରାନବେ', 'ପଞ୍ଚାନବେ', 'ଛୟାନବେ', 'ସତାନବେ', 'ଅଠାନବେ', 'ଅଣଶହେ', 'ଶହେ'
]


def num_to_words(n: int) -> str:
    if n <= 100:
        return ONES[n] if n < len(ONES) else str(n)
    if n < 1000:
        h = n // 100
        rem = n % 100
        h_str = 'ଶହେ' if h == 1 else f"{ONES[h]} ଶହ"
        return f"{h_str} {num_to_words(rem)}" if rem > 0 else h_str
    if n < 100000:
        th = n // 1000
        rem = n % 1000
        th_str = f"{num_to_words(th)} ହଜାର"
        return f"{th_str} {num_to_words(rem)}" if rem > 0 else th_str
    if n < 10000000:
        lk = n // 100000
        rem = n % 100000
        lk_str = f"{num_to_words(lk)} ଲକ୍ଷ"
        return f"{lk_str} {num_to_words(rem)}" if rem > 0 else lk_str
    return str(n)


def convert_odia_numbers(text: str) -> str:
    if not text:
        return ""
    # Odia digits to ASCII
    s = re.sub(r'[\u0b66-\u0b6f]', lambda m: str(ord(m.group(0)) - 0x0b66), text)
    s = re.sub(r'(\d+),(\d+)', r'\1\2', s)
    s = re.sub(r'₹\s*(\d+(?:\.\d+)?)\s*(?:Lakhs?|Lac|L)\b', r'\1 ଲକ୍ଷ ଟଙ୍କା', s, flags=re.I)
    s = re.sub(r'₹\s*(\d+(?:\.\d+)?)\s*(?:Crores?|Cr)\b', r'\1 କୋଟି ଟଙ୍କା', s, flags=re.I)
    s = re.sub(r'₹\s*(\d+(?:\.\d+)?)', r'\1 ଟଙ୍କା', s)
    s = re.sub(r'₹', 'ଟଙ୍କା ', s)
    s = re.sub(r'(\d+(?:\.\d+)?)\s*(?:Lakhs?|Lac|L)\b', r'\1 ଲକ୍ଷ', s, flags=re.I)
    s = re.sub(r'(\d+(?:\.\d+)?)\s*(?:Crores?|Cr)\b', r'\1 କୋଟି', s, flags=re.I)
    s = re.sub(r'/yr\b', ' ବାର୍ଷିକ', s, flags=re.I)
    s = re.sub(r'/mo\b', ' ମାସିକ', s, flags=re.I)
    s = re.sub(r'(\d+(?:\.\d+)?)\s*%', r'\1 ପ୍ରତିଶତ', s)
    s = re.sub(r'(\d+(?:\.\d+)?)\s*\+', r'\1 ରୁ ଅଧିକ', s)
    s = re.sub(r'(\d+)\.(\d+)', lambda m: f"{num_to_words(int(m.group(1)))} ଦଶମିକ {num_to_words(int(m.group(2)))}", s)
    s = re.sub(r'\b\d+\b', lambda m: num_to_words(int(m.group(0))) if int(m.group(0)) <= 9999999 else m.group(0), s)
    return s


def prepare_odia_for_neural_speech(text: str) -> str:
    """
    Transliterates Odia Unicode characters to Devanagari phonetics with precise
    Odia phonetic mapping for secondary neural engines (Edge-TTS).
    """
    raw_expanded = convert_odia_numbers(text)
    s = raw_expanded.replace('ଣ୍ଣ', 'ଣ')

    tokens = re.split(r'(\s+|[.,!?।॥;:\(\)\[\]"\'\-]+)', s)
    out_tokens = []
    for tok in tokens:
        if not tok or re.match(r'^\s+$|[.,!?।॥;:\(\)\[\]"\'\-]+', tok):
            out_tokens.append(tok)
            continue

        if tok.endswith('ର'):
            tok = tok[:-1] + 'ରୋ'
        elif tok.endswith('ଜ') and len(tok) > 1:
            tok = tok[:-1] + 'ଜୋ'
        elif tok.endswith('ବ') and len(tok) > 1:
            tok = tok[:-1] + 'ବୋ'
        elif tok.endswith('ଭ') and len(tok) > 1:
            tok = tok[:-1] + 'ଭୋ'
        elif tok.endswith('ଳ') and len(tok) > 1:
            tok = tok[:-1] + 'ଳୋ'
        elif tok.endswith('ତ') and len(tok) > 2:
            tok = tok[:-1] + 'ତୋ'

        out_tokens.append(tok)

    expanded = ''.join(out_tokens)
    res = []
    i = 0
    n = len(expanded)
    while i < n:
        ch = expanded[i]
        c = ord(ch)
        if 0x0B00 <= c <= 0x0B7F:
            if c == 0x0B2F:
                if i > 0 and ord(expanded[i - 1]) == 0x0B4D:
                    res.append('\u092F')
                else:
                    res.append('\u091C')
            elif c == 0x0B5F:
                res.append('\u092F')
            elif c == 0x0B71:
                res.append('\u0935')
            elif c == 0x0B33:
                res.append('\u0932')
            elif c == 0x0B38:
                res.append('\u0938')
            elif c == 0x0B36:
                res.append('\u0936')
            elif c == 0x0B37:
                res.append('\u0937')
            elif c == 0x0B5C:
                res.append('\u095C')
            elif c == 0x0B5D:
                res.append('\u095D')
            elif c == 0x0B47 and i + 1 < n and ord(expanded[i + 1]) == 0x0B3E:
                res.append('\u094B')
                i += 1
            elif c == 0x0B47 and i + 1 < n and ord(expanded[i + 1]) == 0x0B57:
                res.append('\u094C')
                i += 1
            elif 0x0B01 <= c <= 0x0B75:
                res.append(chr(c - 0x0200))
            else:
                res.append(ch)
        else:
            res.append(ch)
        i += 1
    return ''.join(res)


def prepare_punjabi_for_neural_speech(text: str) -> str:
    """
    Transliterates Punjabi (Gurmukhi) text to Devanagari phonetics for secondary neural engines.
    """
    if not text:
        return ""
    res = []
    i = 0
    n = len(text)
    while i < n:
        c = ord(text[i])
        if c == 0x0A70 or c == 0x0A02:
            res.append('\u0902')
        elif c == 0x0A71:
            if i + 1 < n and 0x0A15 <= ord(text[i + 1]) <= 0x0A39:
                next_c = ord(text[i + 1])
                res.append(chr(next_c - 0x0100) + '\u094D')
        elif c == 0x0A5C:
            res.append('\u095C')
        elif 0x0A66 <= c <= 0x0A6F:
            res.append(str(c - 0x0A66))
        elif 0x0A01 <= c <= 0x0A75:
            res.append(chr(c - 0x0100))
        else:
            res.append(text[i])
        i += 1
    return ''.join(res)


async def synthesize_sarvam_speech(text: str, target_lang: str, rate: float = 1.0, speaker: str = "shubh", scope: str = "homepage") -> bytes | None:
    """
    Synthesizes speech using Sarvam AI Bulbul:v3 API.
    Returns MP3 audio bytes if successful, None otherwise.
    """
    if scope == "mitra":
        keys_to_try = [k for k in [SARVAM_MITRA_TTS_KEY, SARVAM_HOMEPAGE_TTS_KEY, SARVAM_MITRA_API_KEY] if k]
    else:
        keys_to_try = [k for k in [SARVAM_HOMEPAGE_TTS_KEY, SARVAM_MITRA_TTS_KEY, SARVAM_HOMEPAGE_API_KEY] if k]

    if not keys_to_try:
        logger.debug("Sarvam API key not set, skipping Sarvam synthesis")
        return None

    # Pace must be between 0.5 and 2.0
    pace = max(0.5, min(2.0, float(rate or 1.0)))
    effective_speaker = speaker or "shubh"

    payload = {
        "text": text,
        "target_language_code": target_lang,
        "speaker": effective_speaker,
        "model": "bulbul:v3",
        "pace": pace,
        "speech_sample_rate": 22050,
        "output_audio_codec": "mp3",
    }

    for active_key in keys_to_try:
        headers = {
            "api-subscription-key": active_key,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(SARVAM_TTS_URL, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    audios = data.get("audios", [])
                    if audios and len(audios) > 0 and audios[0]:
                        audio_bytes = base64.b64decode(audios[0])
                        if audio_bytes:
                            logger.info(f"Sarvam AI Bulbul:v3 generated {len(audio_bytes)} bytes for lang {target_lang} (speaker: {effective_speaker})")
                            return audio_bytes
                else:
                    logger.warning(f"Sarvam AI TTS API ({active_key[:10]}...) returned HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Sarvam AI TTS call ({active_key[:10]}...) failed: {e}")

    return None


async def synthesize_neural_speech(text: str, lang: str = "or-IN", rate: float = 1.0, speaker: str = "shubh", scope: str = "homepage") -> bytes:
    """
    Synthesizes high-fidelity speech with intelligent tiered routing:
    1. Primary: Sarvam AI (Bulbul:v3) for Indian languages & authentic human cadence.
    2. Fallback/Urdu: Edge-TTS (with ur-IN-GulNeural for Urdu and regional fallbacks).
    3. Full disk caching for instant sub-millisecond replay.
    """
    clean_text = text.strip()
    if not clean_text:
        return b""

    # Determine base language prefix
    normalized_lang = (lang or "hi-IN").lower().strip()
    lang_prefix = normalized_lang.split("-")[0]

    # Script-level auto-detection from text content
    if lang_prefix in ("en", "") or not normalized_lang:
        if re.search(r"[\u0B00-\u0B7F]", clean_text):
            lang_prefix = "or"
        elif re.search(r"[\u0980-\u09FF]", clean_text):
            lang_prefix = "bn"
        elif re.search(r"[\u0C00-\u0C7F]", clean_text):
            lang_prefix = "te"
        elif re.search(r"[\u0B80-\u0BFF]", clean_text):
            lang_prefix = "ta"
        elif re.search(r"[\u0A80-\u0AFF]", clean_text):
            lang_prefix = "gu"
        elif re.search(r"[\u0C80-\u0CFF]", clean_text):
            lang_prefix = "kn"
        elif re.search(r"[\u0D00-\u0D7F]", clean_text):
            lang_prefix = "ml"
        elif re.search(r"[\u0A00-\u0A7F]", clean_text):
            lang_prefix = "pa"
        elif re.search(r"[\u0600-\u06FF]", clean_text):
            lang_prefix = "ur"
        elif re.search(r"[\u0900-\u097F]", clean_text):
            if re.search(r"\b(आहे|आहेत|नाही|कसे|काय|करावे|सांगा|योजनांची|शेतकरी|पात्रता|मिळेल)\b", clean_text):
                lang_prefix = "mr"
            else:
                lang_prefix = "hi"

    # Explicit Urdu check: if Urdu script or lang is Urdu, use Edge-TTS (ur-IN-GulNeural)
    is_urdu = lang_prefix == "ur" or bool(re.search(r"[\u0600-\u06FF]", clean_text))

    # Rate formatting
    rate_val = float(rate or 1.0)
    rate_percent = int(round((rate_val - 1.0) * 100))
    rate_str = f"{'+' if rate_percent >= 0 else ''}{rate_percent}%"
    effective_speaker = speaker or "shubh"

    # Cache key based on engine target, speaker, text, and speed
    cache_tag = "urdu" if is_urdu else (SARVAM_LANG_MAP.get(lang_prefix) or lang_prefix)
    cache_key = hashlib.md5(f"v3:{cache_tag}:{effective_speaker}:{rate_str}:{clean_text}".encode("utf-8")).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.mp3")

    # ── 1. Check disk cache ───────────────────────────────────────────────────
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 0:
        try:
            with open(cache_file, "rb") as f:
                return f.read()
        except Exception as e:
            logger.warning(f"Failed to read TTS cache file: {e}")

    # ── 2. Primary Engine: Sarvam AI Bulbul:v3 (for supported Indic languages) ──
    if not is_urdu and lang_prefix in SARVAM_LANG_MAP:
        sarvam_lang = SARVAM_LANG_MAP[lang_prefix]
        audio_bytes = await synthesize_sarvam_speech(clean_text, sarvam_lang, rate_val, speaker=effective_speaker, scope=scope)
        if audio_bytes:
            try:
                with open(cache_file, "wb") as f:
                    f.write(audio_bytes)
            except Exception as e:
                logger.warning(f"Failed to write Sarvam audio to cache: {e}")
            return audio_bytes

    # ── 3. Fallback & Urdu Engine: Edge-TTS Neural Voices ─────────────────────
    if lang_prefix == "or":
        voice = "hi-IN-SwaraNeural"
        speech_text = prepare_odia_for_neural_speech(clean_text)
    elif lang_prefix == "hi":
        voice = "hi-IN-SwaraNeural"
        speech_text = clean_text
    elif lang_prefix == "bn":
        voice = "bn-IN-TanishaaNeural"
        speech_text = clean_text
    elif lang_prefix == "ta":
        voice = "ta-IN-PallaviNeural"
        speech_text = clean_text
    elif lang_prefix == "te":
        voice = "te-IN-ShrutiNeural"
        speech_text = clean_text
    elif lang_prefix == "gu":
        voice = "gu-IN-DhwaniNeural"
        speech_text = clean_text
    elif lang_prefix == "mr":
        voice = "mr-IN-AarohiNeural"
        speech_text = clean_text
    elif lang_prefix == "kn":
        voice = "kn-IN-SapnaNeural"
        speech_text = clean_text
    elif lang_prefix == "ml":
        voice = "ml-IN-SobhanaNeural"
        speech_text = clean_text
    elif lang_prefix == "ur" or is_urdu:
        voice = "ur-IN-GulNeural"
        speech_text = clean_text
    elif lang_prefix == "pa":
        voice = "hi-IN-SwaraNeural"
        speech_text = prepare_punjabi_for_neural_speech(clean_text)
    else:
        voice = "en-IN-NeerjaNeural"
        speech_text = clean_text

    try:
        tts = edge_tts.Communicate(speech_text, voice, rate=rate_str)
        audio = b""
        async for chunk in tts.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]

        if audio:
            try:
                with open(cache_file, "wb") as f:
                    f.write(audio)
            except Exception as e:
                logger.warning(f"Failed to write Edge-TTS audio to cache: {e}")
            return audio
    except Exception as e:
        logger.error(f"Edge-TTS synthesis error for voice {voice}: {e}")

    return b""
