"""
Assistant views — stateless.

Conversation messages are no longer stored on the server.  Each chat request
is a single-turn call to the LLM with no persistent history.
The frontend (SchemeAdvisorChat) maintains the visible message list in
component state, which is discarded when the component unmounts.

GET  /api/assistant/messages/  — always returns an empty list
POST /api/assistant/chat/      — runs single-turn LLM call, returns answer
"""
import logging

from rest_framework.response import Response
from rest_framework.views import APIView

from sessions_app.profile_views import _require_session
from schemes.models import Scheme
from schemes.serializers import SchemeSerializer
from agents.assistant_agent import AssistantAgent

logger = logging.getLogger(__name__)


class AssistantMessagesView(APIView):
    """
    GET /api/assistant/messages/  — conversation history is not stored server-side
    """

    def get(self, request):
        _require_session(request)
        return Response({"messages": []})


SLUG_ALIASES = {
    "ayushman-bharat": "ayushman-bharat-pmjay",
    "pmjay": "ayushman-bharat-pmjay",
    "pm-jay": "ayushman-bharat-pmjay",
    "ayushman-card": "ayushman-bharat-pmjay",
    "ayushman": "ayushman-bharat-pmjay",
    "vaya-vandana": "ayushman-vaya-vandana-senior-citizens",
    "pm-kisan": "pm-kisan-samman-nidhi",
    "pmkisan": "pm-kisan-samman-nidhi",
    "kisan-samman-nidhi": "pm-kisan-samman-nidhi",
    "mudra": "pradhan-mantri-mudra-yojana",
    "mudra-loan": "pradhan-mantri-mudra-yojana",
    "pmmy": "pradhan-mantri-mudra-yojana",
    "pmay": "pmay-g",
    "pm-awas": "pmay-g",
    "pmay-gramin": "pmay-g",
    "sukanya": "sukanya-samriddhi-yojana",
    "sukanya-samriddhi": "sukanya-samriddhi-yojana",
    "ssy": "sukanya-samriddhi-yojana",
    "svanidhi": "pm-svanidhi",
    "pm-svanidhi": "pm-svanidhi",
    "vishwakarma": "pm-vishwakarma",
    "pm-vishwakarma": "pm-vishwakarma",
    "kusum": "pm-kusum-solar-pump-scheme",
    "pm-kusum": "pm-kusum-solar-pump-scheme",
    "fasal-bima": "pradhan-mantri-fasal-bima-yojana",
    "pmfby": "pradhan-mantri-fasal-bima-yojana",
    "kcc": "kisan-credit-card-kcc",
    "kisan-credit-card": "kisan-credit-card-kcc",
    "atal-pension": "atal-pension-yojana",
    "apy": "atal-pension-yojana",
    "suraksha-bima": "pradhan-mantri-suraksha-bima-yojana",
    "pmsby": "pradhan-mantri-suraksha-bima-yojana",
    "jeevan-jyoti": "pradhan-mantri-jeevan-jyoti-bima-yojana",
    "pmjjby": "pradhan-mantri-jeevan-jyoti-bima-yojana",
    "matru-vandana": "pradhan-mantri-matru-vandana-yojana",
    "pmmvy": "pradhan-mantri-matru-vandana-yojana",
    "ujjwala": "pradhan-mantri-ujjwala-yojana",
    "pm-ujjwala": "pradhan-mantri-ujjwala-yojana",
    "mgnrega": "mahatma-gandhi-nrega-mgnrega",
    "nrega": "mahatma-gandhi-nrega-mgnrega",
    "stand-up-india": "stand-up-india-scheme",
}


class AssistantChatView(APIView):
    """
    POST /api/assistant/chat/
    Body: { "message": "<user text>", "history": [...], "profile": {...} }
    Returns: { "answer": str, "referencedSchemes": Scheme[], "profileUpdated": bool }
    """

    def post(self, request):
        # Allow guest chat without blocking on session token
        try:
            _require_session(request)
        except Exception:
            pass

        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "message is required"}, status=400)

        history = request.data.get("history", [])
        profile = request.data.get("profile", None)
        language = request.data.get("language", "en-IN")

        agent = AssistantAgent()
        result = agent.chat(
            history=history,
            message=message,
            current_profile=profile,
            language=language,
        )

        answer = result["answer"]
        referenced_ids = result.get("referenced_scheme_ids", [])
        updated_profile = result.get("updated_profile")

        # Hydrate referenced scheme objects using exact match, alias mapping, or fuzzy search
        referenced_schemes = []
        if referenced_ids:
            from django.db.models import Q
            matched_objs = []
            seen_ids = set()

            for raw_slug in referenced_ids:
                s_clean = raw_slug.strip().lower()
                target_slug = SLUG_ALIASES.get(s_clean, s_clean)

                # 1. Exact match
                scheme_obj = Scheme.objects.filter(slug=target_slug).first()

                # 2. Substring or short name match if not found
                if not scheme_obj:
                    scheme_obj = Scheme.objects.filter(
                        Q(slug__icontains=s_clean)
                        | Q(short_name__iexact=s_clean)
                        | Q(name__icontains=s_clean)
                    ).first()

                if scheme_obj and scheme_obj.id not in seen_ids:
                    matched_objs.append(scheme_obj)
                    seen_ids.add(scheme_obj.id)

            # Ensure at least 5 schemes are returned by backfilling with eligible schemes
            if len(matched_objs) < 5:
                extra_qs = Scheme.objects.exclude(id__in=seen_ids)
                if profile and isinstance(profile, dict):
                    user_occ = (profile.get("occupation") or profile.get("employmentType") or "").lower()
                    user_state = profile.get("state")
                    if user_occ:
                        occ_objs = extra_qs.filter(
                            Q(eligibility_criteria__allowed_occupations__icontains=user_occ)
                            | Q(name__icontains=user_occ)
                            | Q(detailed_description__icontains=user_occ)
                        ).order_by("-popular_score")[: (5 - len(matched_objs))]
                        for s in occ_objs:
                            if s.id not in seen_ids:
                                matched_objs.append(s)
                                seen_ids.add(s.id)
                    if len(matched_objs) < 5 and user_state:
                        state_objs = extra_qs.filter(
                            Q(covered_states__icontains=user_state) | Q(covered_states__icontains="All India")
                        ).order_by("-popular_score")[: (5 - len(matched_objs))]
                        for s in state_objs:
                            if s.id not in seen_ids:
                                matched_objs.append(s)
                                seen_ids.add(s.id)

                if len(matched_objs) < 5:
                    top_fallback = Scheme.objects.exclude(id__in=seen_ids).order_by("-popular_score")[: (5 - len(matched_objs))]
                    for s in top_fallback:
                        if s.id not in seen_ids:
                            matched_objs.append(s)
                            seen_ids.add(s.id)

            if matched_objs:
                referenced_schemes = SchemeSerializer(matched_objs, many=True).data

        return Response(
            {
                "answer": answer,
                "referencedSchemes": referenced_schemes,
                "profileUpdated": bool(updated_profile),
                "updatedProfile": updated_profile,
            }
        )


class TTSView(APIView):
    """
    GET  /api/assistant/tts/?text=<text>&lang=<lang>&rate=<rate>
    POST /api/assistant/tts/
    Body: { "text": "<text>", "lang": "<lang>", "rate": 1.0 }

    Returns MP3 audio stream of high-fidelity neural speech.
    Zero credits used, disk-cached for instant sub-millisecond response.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        text = (request.query_params.get("text") or "").strip()
        lang = (request.query_params.get("lang") or "or-IN").strip()
        speaker = (request.query_params.get("speaker") or "shubh").strip()
        try:
            rate = float(request.query_params.get("rate") or 1.0)
        except (ValueError, TypeError):
            rate = 1.0

        if not text:
            return Response({"error": "text parameter is required"}, status=400)

        scope = (request.query_params.get("scope") or "homepage").strip()
        return self._synthesize(text, lang, rate, speaker=speaker, scope=scope)

    def post(self, request):
        text = (request.data.get("text") or "").strip()
        lang = (request.data.get("lang") or "or-IN").strip()
        speaker = (request.data.get("speaker") or "shubh").strip()
        try:
            rate = float(request.data.get("rate") or 1.0)
        except (ValueError, TypeError):
            rate = 1.0

        if not text:
            return Response({"error": "text field is required"}, status=400)

        scope = (request.data.get("scope") or "homepage").strip()
        return self._synthesize(text, lang, rate, speaker=speaker, scope=scope)

    def _synthesize(self, text: str, lang: str, rate: float, speaker: str = "shubh", scope: str = "homepage"):
        from django.http import HttpResponse
        from asgiref.sync import async_to_sync
        from .tts_service import synthesize_neural_speech

        try:
            audio_bytes = async_to_sync(synthesize_neural_speech)(text, lang, rate, speaker=speaker, scope=scope)
            if not audio_bytes:
                return Response({"error": "Failed to generate audio"}, status=500)

            content_type = "audio/wav" if audio_bytes.startswith(b"RIFF") else "audio/mpeg"
            response = HttpResponse(audio_bytes, content_type=content_type)
            response["Content-Length"] = str(len(audio_bytes))
            response["Cache-Control"] = "public, max-age=86400"
            return response
        except Exception as e:
            logger.error(f"TTSView synthesis error: {e}", exc_info=True)
            return Response({"error": f"Speech synthesis failed: {str(e)}"}, status=500)


class STTView(APIView):
    """
    POST /api/assistant/transcribe/
    Body: multipart/form-data with 'file' (audio) and optional 'language_code' / 'language'.
    Transcribes audio using Sarvam AI Saaras:v4 Speech-to-Text model.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        import os
        import requests
        from django.conf import settings

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "Audio file is required in 'file' parameter"}, status=400)

        language_code = request.data.get("language_code") or request.data.get("language") or "en-IN"
        model = request.data.get("model") or "saaras:v4"
        mode = request.data.get("mode") or "transcribe"

        keys_to_try = [
            k for k in [
                getattr(settings, "SARVAM_MITRA_STT_KEY", os.getenv("SARVAM_MITRA_STT_KEY", "sk_a8tndpvd_tIgYK3ISO34GrEe81rPTQRPd")),
                getattr(settings, "SARVAM_MITRA_TTS_KEY", os.getenv("SARVAM_MITRA_TTS_KEY", "sk_kf97benf_qhgh56zkgZGGoxr32b1jvsrB")),
                getattr(settings, "SARVAM_HOMEPAGE_TTS_KEY", os.getenv("SARVAM_HOMEPAGE_TTS_KEY", "sk_23ky4uff_zXcSIApnbKayzYiavuM3Gd8H")),
                getattr(settings, "SARVAM_MITRA_API_KEY", os.getenv("SARVAM_MITRA_API_KEY", "sk_c3wbxrmf_j3YJihzCjNIhKADHIANQPICL")),
                getattr(settings, "SARVAM_HOMEPAGE_API_KEY", getattr(settings, "SARVAM_API_KEY", os.getenv("SARVAM_HOMEPAGE_API_KEY", os.getenv("SARVAM_API_KEY", "sk_ds4psbt8_o9FwXHw2SHUTFpVUogYVS8Vj")))),
            ] if k
        ]
        sarvam_url = "https://api.sarvam.ai/speech-to-text"

        try:
            audio_bytes = uploaded_file.read()
            content_type = uploaded_file.content_type or "audio/wav"
            file_name = uploaded_file.name or "audio.wav"

            data = {
                "model": model,
                "language_code": language_code,
                "mode": mode,
            }

            last_error = None
            last_status = 500

            for active_key in keys_to_try:
                files = {
                    "file": (file_name, audio_bytes, content_type)
                }
                headers = {
                    "api-subscription-key": active_key,
                }

                try:
                    res = requests.post(sarvam_url, headers=headers, files=files, data=data, timeout=30)
                    if res.status_code == 200:
                        result = res.json()
                        return Response({
                            "transcript": result.get("transcript", ""),
                            "language_code": result.get("language_code", language_code),
                            "request_id": result.get("request_id"),
                        })
                    else:
                        logger.warning(f"Sarvam AI STT ({active_key[:10]}...) responded {res.status_code}: {res.text}")
                        last_error = res.text
                        last_status = res.status_code
                except Exception as req_err:
                    logger.warning(f"Sarvam AI STT request exception with key {active_key[:10]}...: {req_err}")
                    last_error = str(req_err)

            return Response(
                {"error": "Sarvam AI transcription failed", "detail": last_error},
                status=last_status
            )
        except Exception as e:
            logger.error(f"STTView transcription exception: {e}", exc_info=True)
            return Response({"error": f"Transcription error: {str(e)}"}, status=500)



