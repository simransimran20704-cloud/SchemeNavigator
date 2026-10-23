import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.models import resolve_request_user
from .models import NotificationSubscription, NotificationLog
from .serializers import (
    NotificationSubscriptionSerializer,
    SendNotificationRequestSerializer,
    NotificationLogSerializer,
)
from .services import clean_phone_number, send_notification

logger = logging.getLogger(__name__)


class NotificationPreferencesView(APIView):
    """
    GET  /api/notifications/preferences/  — Retrieve notification preferences for current user or phone
    POST /api/notifications/preferences/  — Save / update notification preferences
    """

    def get(self, request):
        user = resolve_request_user(request)
        phone = request.query_params.get("phone", "").strip()

        sub = None
        if user:
            sub = NotificationSubscription.objects.filter(user=user).first()
        elif phone:
            clean_phone = clean_phone_number(phone)
            if clean_phone:
                sub = NotificationSubscription.objects.filter(phone_number=clean_phone).first()

        if sub:
            return Response(NotificationSubscriptionSerializer(sub).data, status=status.HTTP_200_OK)

        # Return defaults if not found
        default_data = {
            "phone_number": phone or (getattr(user, "username", "") if user and getattr(user, "username", "").isdigit() else ""),
            "channel_whatsapp": True,
            "channel_sms": True,
            "notify_tracker_updates": True,
            "notify_deadlines": True,
            "notify_new_schemes": False,
            "preferred_language": "hi-IN",
        }
        return Response(default_data, status=status.HTTP_200_OK)

    def post(self, request):
        user = resolve_request_user(request)
        raw_phone = request.data.get("phone_number", "").strip()
        cleaned_phone = clean_phone_number(raw_phone) if raw_phone else ""

        if not cleaned_phone and not user:
            return Response(
                {"error": "Please provide a valid phone number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find existing subscription by user or phone
        sub = None
        if user:
            sub = NotificationSubscription.objects.filter(user=user).first()
        if not sub and cleaned_phone:
            sub = NotificationSubscription.objects.filter(phone_number=cleaned_phone).first()

        data = request.data.copy()
        if cleaned_phone:
            data["phone_number"] = cleaned_phone

        if sub:
            serializer = NotificationSubscriptionSerializer(sub, data=data, partial=True)
        else:
            serializer = NotificationSubscriptionSerializer(data=data)

        if serializer.is_valid():
            saved_sub = serializer.save(user=user if user else (sub.user if sub else None))
            return Response(NotificationSubscriptionSerializer(saved_sub).data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SendNotificationView(APIView):
    """
    POST /api/notifications/send/ — Dispatch notification (test, scheme guide, etc.)
    """

    def post(self, request):
        user = resolve_request_user(request)
        serializer = SendNotificationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        phone_number = validated["phone_number"]
        channels = validated.get("channels") or ["whatsapp", "sms"]
        template_type = validated.get("template_type", "test")
        data = validated.get("data", {})
        lang_code = validated.get("lang_code", "hi-IN")

        result = send_notification(
            phone_number=phone_number,
            channels=channels,
            template_type=template_type,
            data=data,
            lang_code=lang_code,
            user=user,
        )

        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_207_MULTI_STATUS)


class TriggerTrackerAlertView(APIView):
    """
    POST /api/notifications/tracker-alert/ — Dispatch status alert when tracker item updates
    """

    def post(self, request):
        user = resolve_request_user(request)
        phone = request.data.get("phone_number", "").strip()

        # If phone is not passed, look up from user's NotificationSubscription
        if not phone and user:
            sub = NotificationSubscription.objects.filter(user=user).first()
            if sub and sub.phone_number:
                phone = sub.phone_number

        if not phone:
            return Response(
                {"error": "No recipient phone number configured for alerts."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        scheme_name = request.data.get("scheme_name", "सरकारी योजना")
        app_status = request.data.get("status", "अद्यतित (Updated)")
        notes = request.data.get("notes", "आपके आवेदन की स्थिति अपडेट की गई है।")
        portal_url = request.data.get("portal_url", "https://schemenavigator.gov.in")
        lang_code = request.data.get("lang_code", "hi-IN")
        channels = request.data.get("channels", ["whatsapp", "sms"])

        result = send_notification(
            phone_number=phone,
            channels=channels,
            template_type="tracker_update",
            data={
                "scheme_name": scheme_name,
                "status": app_status,
                "notes": notes,
                "portal_url": portal_url,
            },
            lang_code=lang_code,
            user=user,
        )

        return Response(result, status=status.HTTP_200_OK)


class NotificationLogsView(APIView):
    """
    GET /api/notifications/logs/ — Fetch recent notification logs for user or phone
    """

    def get(self, request):
        user = resolve_request_user(request)
        phone = request.query_params.get("phone", "").strip()

        qs = NotificationLog.objects.all()
        if user:
            qs = qs.filter(user=user)
        elif phone:
            cleaned = clean_phone_number(phone)
            qs = qs.filter(recipient=cleaned)
        else:
            # If neither authenticated nor phone provided, return empty list for privacy
            return Response([], status=status.HTTP_200_OK)

        logs = qs[:50]
        serializer = NotificationLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
