from django.urls import path
from .views import (
    NotificationPreferencesView,
    SendNotificationView,
    TriggerTrackerAlertView,
    NotificationLogsView,
)

urlpatterns = [
    path("preferences/", NotificationPreferencesView.as_view(), name="notification-preferences"),
    path("send/", SendNotificationView.as_view(), name="notification-send"),
    path("tracker-alert/", TriggerTrackerAlertView.as_view(), name="notification-tracker-alert"),
    path("logs/", NotificationLogsView.as_view(), name="notification-logs"),
]
