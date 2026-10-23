from django.urls import path
from .views import TrackerListView, TrackerDetailView

urlpatterns = [
    path("", TrackerListView.as_view(), name="tracker-list"),
    path("<str:item_id>/", TrackerDetailView.as_view(), name="tracker-detail"),
]
