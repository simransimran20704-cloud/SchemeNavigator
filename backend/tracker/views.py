"""
Tracker (application status) views — persisted in database per authenticated user.
Enables real-time cross-device tracking sync for logged-in accounts.
"""
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.models import UserTrackerItem, resolve_request_user


class TrackerListView(APIView):
    """
    GET  /api/tracker/  — returns all tracked applications for the authenticated user
    POST /api/tracker/  — saves or bulk-syncs application tracker items
    """

    def get(self, request):
        user = resolve_request_user(request)
        if not user:
            return Response({"applications": []})

        items = list(UserTrackerItem.objects.filter(user=user))
        result = [item.data for item in items if item.data and isinstance(item.data, dict)]
        return Response({"applications": result})

    def post(self, request):
        user = resolve_request_user(request)
        applications = request.data.get("applications")

        if applications and isinstance(applications, list):
            saved_items = []
            if user:
                for app in applications:
                    if not isinstance(app, dict):
                        continue
                    scheme_id = str(app.get("schemeId") or app.get("id") or "").strip()
                    if scheme_id:
                        obj, _ = UserTrackerItem.objects.update_or_create(
                            user=user,
                            scheme_id=scheme_id,
                            defaults={"data": app},
                        )
                        saved_items.append(obj.data)
            return Response({"applications": saved_items if user else applications}, status=200)

        # Single item payload
        app = request.data.get("application") or request.data
        if isinstance(app, dict):
            scheme_id = str(app.get("schemeId") or app.get("id") or "").strip()
            if user and scheme_id:
                UserTrackerItem.objects.update_or_create(
                    user=user,
                    scheme_id=scheme_id,
                    defaults={"data": app},
                )
            return Response({"application": app}, status=200)

        return Response({"applications": []}, status=200)


class TrackerDetailView(APIView):
    """
    PUT    /api/tracker/<item_id>/  — updates or creates tracker item for user
    DELETE /api/tracker/<item_id>/  — deletes tracker item for user
    """

    def put(self, request, item_id):
        user = resolve_request_user(request)
        app_data = request.data.get("application") or request.data

        if not isinstance(app_data, dict):
            app_data = {"id": str(item_id)}

        scheme_id = str(app_data.get("schemeId") or item_id).strip()
        if user and scheme_id:
            UserTrackerItem.objects.update_or_create(
                user=user,
                scheme_id=scheme_id,
                defaults={"data": app_data},
            )

        return Response({"application": app_data, "id": item_id}, status=200)

    def delete(self, request, item_id):
        user = resolve_request_user(request)
        target = str(item_id).strip().lower()

        if user:
            for item in UserTrackerItem.objects.filter(user=user):
                sid = (item.scheme_id or "").strip().lower()
                data_id = str(item.data.get("id") or "").strip().lower() if isinstance(item.data, dict) else ""
                data_sid = str(item.data.get("schemeId") or "").strip().lower() if isinstance(item.data, dict) else ""
                if target in (sid, data_id, data_sid):
                    item.delete()

        return Response({"deleted": True, "id": item_id}, status=200)

