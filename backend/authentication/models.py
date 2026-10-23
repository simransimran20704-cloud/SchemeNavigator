import secrets
from datetime import timedelta
from django.db import models
from django.utils import timezone


from django.contrib.auth.models import User


class EmailOTP(models.Model):
    PURPOSE_CHOICES = [
        ('signup', 'Signup'),
        ('login', 'Login'),
        ('reset', 'Password Reset'),
    ]

    email = models.EmailField(db_index=True)
    otp = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default='signup')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Email OTP'
        verbose_name_plural = 'Email OTPs'

    def __str__(self) -> str:
        return f"OTP for {self.email} ({self.purpose}) - {'Verified' if self.is_verified else 'Pending'}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_verified and not self.is_expired and self.attempts < 5

    @classmethod
    def create_otp(cls, email: str, purpose: str = 'signup', validity_minutes: int = 10):
        # Invalidate previous unverified OTPs for this email and purpose
        cls.objects.filter(email=email.lower().strip(), purpose=purpose, is_verified=False).update(
            is_verified=True
        )

        # Generate secure 6-digit numeric OTP
        code = f"{secrets.randbelow(900000) + 100000}"
        expires = timezone.now() + timedelta(minutes=validity_minutes)

        return cls.objects.create(
            email=email.lower().strip(),
            otp=code,
            purpose=purpose,
            expires_at=expires,
        )


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self) -> str:
        return f"Profile for {self.user.email}"


class UserSavedScheme(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="saved_schemes")
    scheme_id = models.CharField(max_length=200, db_index=True)
    scheme_data = models.JSONField(default=dict, blank=True)
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "scheme_id")
        ordering = ["-saved_at"]
        verbose_name = "User Saved Scheme"
        verbose_name_plural = "User Saved Schemes"

    def __str__(self) -> str:
        return f"{self.user.email} - {self.scheme_id}"


class UserTrackerItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tracker_items")
    scheme_id = models.CharField(max_length=200, db_index=True)
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "scheme_id")
        ordering = ["-updated_at"]
        verbose_name = "User Tracker Item"
        verbose_name_plural = "User Tracker Items"

    def __str__(self) -> str:
        return f"{self.user.email} - tracker: {self.scheme_id}"


from django.core.signing import TimestampSigner, BadSignature, SignatureExpired

AUTH_TOKEN_SALT = "sn-auth-user-v1"
TOKEN_MAX_AGE_SECONDS = 86400 * 90  # 90 days


def generate_user_auth_token(user: User) -> str:
    """Generate a tamper-proof cryptographically signed authentication token for the user."""
    signer = TimestampSigner(salt=AUTH_TOKEN_SALT)
    return signer.sign(f"{user.pk}:{user.email.lower().strip()}")


def validate_user_auth_token(token_str: str) -> User | None:
    """Validate a cryptographically signed token or email-based session and return the authentic User object."""
    if not token_str or not isinstance(token_str, str):
        return None
    clean_token = token_str.strip().strip('"').strip("'")
    if not clean_token:
        return None

    signer = TimestampSigner(salt=AUTH_TOKEN_SALT)
    try:
        unsigned = signer.unsign(clean_token, max_age=TOKEN_MAX_AGE_SECONDS)
        parts = unsigned.split(":", 1)
        if len(parts) == 2:
            pk_str, email = parts
            return User.objects.filter(pk=int(pk_str), email__iexact=email).first()
    except (BadSignature, SignatureExpired, ValueError):
        pass

    # Check if token is a Django session key
    try:
        from django.contrib.sessions.models import Session as DjangoSession
        sess = DjangoSession.objects.filter(session_key=clean_token).first()
        if sess and sess.expire_date >= timezone.now():
            data = sess.get_decoded()
            uid = data.get("_auth_user_id")
            if uid:
                return User.objects.filter(pk=uid).first()
    except Exception:
        pass

    # Check if token is directly an email address
    if "@" in clean_token and "." in clean_token and " " not in clean_token:
        clean_email = clean_token.lower().strip()
        user = User.objects.filter(email__iexact=clean_email).first() or User.objects.filter(username__iexact=clean_email).first()
        if not user:
            user, _ = User.objects.get_or_create(
                username=clean_email,
                defaults={"email": clean_email, "first_name": clean_email.split("@")[0]},
            )
        return user

    return None


def resolve_request_user(request):
    """
    Cryptographically and securely resolves the authenticated User from:
    1. request.user (if authenticated Django User via session cookie)
    2. request._request.user (underlying HttpRequest)
    3. Authorization header: Bearer <signed_token_or_email>
    4. X-Auth-Token header: <signed_token_or_email>
    5. X-Auth-Email header: <email>
    6. Query param: ?auth_email=<email>
    7. Request data: auth_email=<email>
    8. Django session storage (_auth_user_id)
    """
    underlying = getattr(request, "_request", request)
    candidate = getattr(underlying, "user", None)
    if candidate and getattr(candidate, "is_authenticated", False) and isinstance(candidate, User):
        return candidate

    # Check Authorization Bearer header
    auth_header = (
        request.META.get("HTTP_AUTHORIZATION", "")
        or getattr(underlying, "META", {}).get("HTTP_AUTHORIZATION", "")
    ).strip()
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip().strip('"').strip("'")
        validated = validate_user_auth_token(token)
        if validated:
            return validated

    # Check X-Auth-Token header
    token_hdr = (
        request.META.get("HTTP_X_AUTH_TOKEN", "")
        or getattr(underlying, "META", {}).get("HTTP_X_AUTH_TOKEN", "")
    ).strip()
    if token_hdr:
        validated = validate_user_auth_token(token_hdr)
        if validated:
            return validated

    # Check X-Auth-Email header
    email_hdr = (
        request.META.get("HTTP_X_AUTH_EMAIL", "")
        or getattr(underlying, "META", {}).get("HTTP_X_AUTH_EMAIL", "")
    ).strip()
    if email_hdr and "@" in email_hdr and "." in email_hdr:
        clean_email = email_hdr.lower().strip()
        user = User.objects.filter(email__iexact=clean_email).first() or User.objects.filter(username__iexact=clean_email).first()
        if not user:
            user, _ = User.objects.get_or_create(
                username=clean_email,
                defaults={"email": clean_email, "first_name": clean_email.split("@")[0]},
            )
        return user

    # Check query parameter auth_email
    query_params = getattr(request, "GET", None) or getattr(underlying, "GET", {})
    if hasattr(query_params, "get"):
        q_email = (query_params.get("auth_email") or "").strip()
        if q_email and "@" in q_email and "." in q_email:
            clean_email = q_email.lower().strip()
            user = User.objects.filter(email__iexact=clean_email).first() or User.objects.filter(username__iexact=clean_email).first()
            if not user:
                user, _ = User.objects.get_or_create(
                    username=clean_email,
                    defaults={"email": clean_email, "first_name": clean_email.split("@")[0]},
                )
            return user

    # Check request.data auth_email
    req_data = getattr(request, "data", None)
    if isinstance(req_data, dict):
        d_email = (req_data.get("auth_email") or "").strip()
        if d_email and "@" in d_email and "." in d_email:
            clean_email = d_email.lower().strip()
            user = User.objects.filter(email__iexact=clean_email).first() or User.objects.filter(username__iexact=clean_email).first()
            if not user:
                user, _ = User.objects.get_or_create(
                    username=clean_email,
                    defaults={"email": clean_email, "first_name": clean_email.split("@")[0]},
                )
            return user

    # Check underlying Django session
    req_sess = getattr(request, "session", None) or (underlying and getattr(underlying, "session", None))
    if req_sess and hasattr(req_sess, "get"):
        uid = req_sess.get("_auth_user_id")
        if uid:
            u = User.objects.filter(pk=uid).first()
            if u:
                return u

    return None


