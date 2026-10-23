"""
Custom DRF authentication using the X-Session-Token header.
This replaces Django's session/cookie auth for anonymous browser sessions.

Sessions carry NO user data on the server — they are purely a lightweight
token so the frontend can authenticate requests within a browser tab.
All user data lives in sessionStorage and is discarded when the tab closes.
"""
import uuid

from rest_framework.authentication import BaseAuthentication, SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import Session


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication without CSRF enforcement for REST API clients.
    """
    def enforce_csrf(self, request):
        return  # Do not perform CSRF check for API requests


class SessionTokenAuthentication(BaseAuthentication):
    """
    Reads the 'X-Session-Token' header and resolves it to a Session object.
    Also links any authenticated User from session or auth headers.
    """

    HEADER_NAME = "HTTP_X_SESSION_TOKEN"

    def authenticate(self, request):
        token_str = request.META.get(self.HEADER_NAME)
        if not token_str:
            return None  # No token → anonymous; let permission classes decide

        # Validate UUID format
        try:
            token_uuid = uuid.UUID(str(token_str).strip())
        except ValueError:
            raise AuthenticationFailed("Invalid session token format.")

        try:
            session = Session.objects.get(token=token_uuid)
        except Session.DoesNotExist:
            raise AuthenticationFailed("Session token not found.")

        # Check if an authenticated user is available via Django session or headers
        underlying_request = getattr(request, "_request", request)
        user = getattr(underlying_request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            return (user, session)

        from authentication.models import resolve_request_user
        resolved_user = resolve_request_user(underlying_request)
        if resolved_user:
            return (resolved_user, session)

        return (session, session)

    def authenticate_header(self, request):
        return "SessionToken"

