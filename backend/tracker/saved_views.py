from django.db.models import Q
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.models import UserSavedScheme, resolve_request_user
from schemes.models import Scheme
from schemes.serializers import SchemeSerializer


class SavedSchemeListView(APIView):
    """
    GET /api/saved-schemes/  — returns saved schemes from database for authenticated user
    POST /api/saved-schemes/ — saves a scheme from body
    """

    def get(self, request):
        user = resolve_request_user(request)
        if not user:
            return Response({"savedSchemes": []})

        user_saved = list(UserSavedScheme.objects.filter(user=user))
        saved_list = []
        for item in user_saved:
            clean_id = str(item.scheme_id).strip()
            db_scheme = Scheme.objects.filter(
                Q(slug__iexact=clean_id) | Q(id__iexact=clean_id) | Q(slug__icontains=clean_id)
            ).first()
            base_data = SchemeSerializer(db_scheme).data if db_scheme else {}

            if item.scheme_data and isinstance(item.scheme_data, dict) and item.scheme_data.get("name"):
                merged = dict(base_data)
                merged.update({k: v for k, v in item.scheme_data.items() if v is not None and v != ""})
                if not merged.get("id"):
                    merged["id"] = item.scheme_id
                if not merged.get("slug"):
                    merged["slug"] = item.scheme_id
                saved_list.append(merged)
            elif db_scheme:
                saved_list.append(base_data)
            else:
                saved_list.append({
                    "id": item.scheme_id,
                    "slug": item.scheme_id,
                    "name": clean_id.replace('-', ' ').title(),
                    "category": "Social Welfare",
                    "level": "Central",
                    "shortDescription": "Verified government scheme.",
                })

        return Response({"savedSchemes": saved_list})

    def post(self, request):
        user = resolve_request_user(request)
        if not user:
            return Response({"error": "Authentication required"}, status=401)

        # Batch upload support: { "savedSchemes": [...] }
        batch = request.data.get("savedSchemes")
        if isinstance(batch, list):
            for raw_item in batch:
                if not isinstance(raw_item, dict):
                    continue
                sid = raw_item.get("id") or raw_item.get("slug")
                if not sid:
                    continue
                clean_id = str(sid).strip()
                UserSavedScheme.objects.update_or_create(
                    user=user,
                    scheme_id=clean_id,
                    defaults={"scheme_data": raw_item},
                )
            return self.get(request)

        scheme_id = request.data.get("schemeId") or request.data.get("id") or request.data.get("slug")
        scheme_data = request.data.get("scheme") or request.data

        if not scheme_id and isinstance(scheme_data, dict):
            scheme_id = scheme_data.get("id") or scheme_data.get("slug")

        if not scheme_id:
            return Response({"error": "schemeId is required"}, status=400)

        clean_id = str(scheme_id).strip()
        if not (isinstance(scheme_data, dict) and scheme_data.get("name")):
            db_scheme = Scheme.objects.filter(
                Q(slug__iexact=clean_id) | Q(id__iexact=clean_id) | Q(slug__icontains=clean_id)
            ).first()
            if db_scheme:
                scheme_data = SchemeSerializer(db_scheme).data

        UserSavedScheme.objects.update_or_create(
            user=user,
            scheme_id=clean_id,
            defaults={"scheme_data": scheme_data if isinstance(scheme_data, dict) else {}},
        )

        return Response({"saved": True, "schemeId": scheme_id}, status=200)

    def delete(self, request):
        user = resolve_request_user(request)
        if not user:
            return Response({"error": "Authentication required"}, status=401)

        scheme_id = request.data.get("schemeId") or request.data.get("id") or request.data.get("slug")
        if not scheme_id:
            scheme_id = request.GET.get("schemeId") or request.GET.get("id") or request.GET.get("slug")

        if not scheme_id:
            return Response({"error": "schemeId is required"}, status=400)

        clean_id = str(scheme_id).strip().lower()
        to_delete = []
        for item in UserSavedScheme.objects.filter(user=user):
            item_sid = (item.scheme_id or "").strip().lower()
            data_id = str(item.scheme_data.get("id") or "").strip().lower() if isinstance(item.scheme_data, dict) else ""
            data_slug = str(item.scheme_data.get("slug") or "").strip().lower() if isinstance(item.scheme_data, dict) else ""
            if clean_id in (item_sid, data_id, data_slug):
                to_delete.append(item.id)
        if to_delete:
            UserSavedScheme.objects.filter(id__in=to_delete).delete()

        return Response({"saved": False, "schemeId": scheme_id, "deleted": True})


class SavedSchemeDetailView(APIView):
    """
    POST   /api/saved-schemes/<scheme_id>/  — saves scheme for user in database
    DELETE /api/saved-schemes/<scheme_id>/  — removes scheme for user from database
    """

    def post(self, request, scheme_id):
        user = resolve_request_user(request)
        if not user:
            return Response({"error": "Authentication required"}, status=401)

        scheme_data = request.data.get("scheme") or request.data
        clean_id = str(scheme_id).strip()

        if not (isinstance(scheme_data, dict) and scheme_data.get("name")):
            db_scheme = Scheme.objects.filter(
                Q(slug__iexact=clean_id) | Q(id__iexact=clean_id) | Q(slug__icontains=clean_id)
            ).first()
            if db_scheme:
                scheme_data = SchemeSerializer(db_scheme).data

        UserSavedScheme.objects.update_or_create(
            user=user,
            scheme_id=clean_id,
            defaults={"scheme_data": scheme_data if isinstance(scheme_data, dict) else {}},
        )

        return Response({"saved": True, "schemeId": scheme_id}, status=200)

    def delete(self, request, scheme_id):
        user = resolve_request_user(request)
        clean_id = str(scheme_id).strip().lower()

        if user and clean_id:
            to_delete = []
            for item in UserSavedScheme.objects.filter(user=user):
                item_sid = (item.scheme_id or "").strip().lower()
                data_id = str(item.scheme_data.get("id") or "").strip().lower() if isinstance(item.scheme_data, dict) else ""
                data_slug = str(item.scheme_data.get("slug") or "").strip().lower() if isinstance(item.scheme_data, dict) else ""
                if clean_id in (item_sid, data_id, data_slug):
                    to_delete.append(item.id)
            if to_delete:
                UserSavedScheme.objects.filter(id__in=to_delete).delete()

        return Response({"saved": False, "schemeId": scheme_id, "deleted": True})
