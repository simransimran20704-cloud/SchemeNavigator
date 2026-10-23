import re
from rest_framework import serializers
from .models import NotificationSubscription, NotificationLog
from .services import clean_phone_number


class NotificationSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSubscription
        fields = [
            "id",
            "phone_number",
            "channel_whatsapp",
            "channel_sms",
            "notify_tracker_updates",
            "notify_deadlines",
            "notify_new_schemes",
            "preferred_language",
            "is_verified",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_verified", "created_at", "updated_at"]

    def validate_phone_number(self, value):
        cleaned = clean_phone_number(value)
        digits_only = re.sub(r"[^\d]", "", cleaned)
        if len(digits_only) < 10:
            raise serializers.ValidationError("Please provide a valid 10-digit mobile number.")
        return cleaned


class SendNotificationRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=25, required=True)
    channels = serializers.ListField(
        child=serializers.ChoiceField(choices=["whatsapp", "sms"]),
        required=False,
        default=["whatsapp", "sms"],
    )
    template_type = serializers.CharField(
        max_length=50,
        required=False,
        default="test",
    )
    data = serializers.DictField(required=False, default=dict)
    lang_code = serializers.CharField(max_length=15, required=False, default="hi-IN")

    def validate_phone_number(self, value):
        cleaned = clean_phone_number(value)
        digits_only = re.sub(r"[^\d]", "", cleaned)
        if len(digits_only) < 10:
            raise serializers.ValidationError("Please provide a valid mobile number.")
        return cleaned


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = [
            "id",
            "recipient",
            "channel",
            "notification_type",
            "title",
            "message",
            "status",
            "gateway_response",
            "created_at",
        ]
        read_only_fields = fields
