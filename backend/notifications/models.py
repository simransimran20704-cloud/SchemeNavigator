from django.db import models
from django.contrib.auth.models import User


class NotificationSubscription(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notification_subscriptions",
    )
    phone_number = models.CharField(max_length=20, db_index=True)
    channel_whatsapp = models.BooleanField(default=True)
    channel_sms = models.BooleanField(default=True)
    notify_tracker_updates = models.BooleanField(default=True)
    notify_deadlines = models.BooleanField(default=True)
    notify_new_schemes = models.BooleanField(default=False)
    preferred_language = models.CharField(max_length=10, default="hi-IN")
    is_verified = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "Notification Subscription"
        verbose_name_plural = "Notification Subscriptions"

    def __str__(self) -> str:
        return f"{self.phone_number} (WA: {self.channel_whatsapp}, SMS: {self.channel_sms})"


class NotificationLog(models.Model):
    CHANNEL_CHOICES = [
        ("whatsapp", "WhatsApp"),
        ("sms", "SMS / Text"),
    ]
    STATUS_CHOICES = [
        ("sent", "Sent"),
        ("delivered", "Delivered"),
        ("simulated", "Simulated"),
        ("failed", "Failed"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_logs",
    )
    recipient = models.CharField(max_length=50, db_index=True)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default="whatsapp")
    notification_type = models.CharField(max_length=50, default="general", db_index=True)
    title = models.CharField(max_length=255, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="sent")
    gateway_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification Log"
        verbose_name_plural = "Notification Logs"

    def __str__(self) -> str:
        return f"[{self.channel.upper()}] {self.recipient} - {self.notification_type} ({self.status})"
