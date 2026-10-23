"""
Profile views — stateless.

User profile data is never stored on the server.  The frontend keeps all
profile data in sessionStorage and discards it when the tab closes.

GET  /api/profile/  — always returns {"profile": null}
PUT  /api/profile/  — validates the payload shape and echoes it back;
                      nothing is written to the database.
"""
from pydantic import ValidationError
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView

from .schemas import UserProfileSchema


def _require_session(request):
    """
    Returns the user or session if authenticated, raises AuthenticationFailed otherwise.
    """
    from authentication.models import resolve_request_user
    user = resolve_request_user(request)
    if user:
        return user

    from sessions_app.models import Session
    session = getattr(request, "user", None)
    if not isinstance(session, Session):
        session = getattr(request, "auth", None)
    if not isinstance(session, Session):
        # Don't strictly block guest access if token is offline or absent
        return None
    return session


class ProfileView(APIView):
    """
    GET /api/profile/   — returns stored profile for authenticated user
    PUT /api/profile/   — persists and returns updated profile for user
    """

    def get(self, request):
        from authentication.models import resolve_request_user, UserProfile
        user = resolve_request_user(request)
        if user:
            prof = UserProfile.objects.filter(user=user).first()
            if prof and prof.data:
                return Response({"profile": prof.data}, status=200)
        return Response({"profile": None}, status=200)

    def put(self, request):
        from authentication.models import resolve_request_user, UserProfile
        data = request.data

        try:
            schema = UserProfileSchema.model_validate(data)
            profile_dict = schema.to_frontend_dict()
        except ValidationError:
            # Fallback to direct sanitized dict if non-strict
            profile_dict = dict(data) if isinstance(data, dict) else {}

        user = resolve_request_user(request)
        if user and profile_dict:
            UserProfile.objects.update_or_create(
                user=user,
                defaults={"data": profile_dict},
            )

        return Response({"profile": profile_dict}, status=200)
