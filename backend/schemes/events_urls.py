from django.urls import path
from .views_events import GovernmentEventsView

urlpatterns = [
    path("government/", GovernmentEventsView.as_view(), name="government-events"),
]
