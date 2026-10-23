import logging
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmailOTP, resolve_request_user, generate_user_auth_token
from .serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    LoginSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


class SendOTPView(APIView):
    """
    POST /api/auth/send-otp/
    Generates and sends a 6-digit OTP code to the requested email address.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        purpose = serializer.validated_data['purpose']

        user_exists = User.objects.filter(email__iexact=email).exists()

        # Create OTP record
        otp_record = EmailOTP.create_otp(email=email, purpose=purpose, validity_minutes=10)

        # Send email with OTP
        subject = f"Your Scheme Navigator Verification Code: {otp_record.otp}"
        body = f"""Hello,

Your 6-digit verification code for Scheme Navigator is:

    {otp_record.otp}

This code will expire in 10 minutes.
If you did not request this verification code, please ignore this email.

Best regards,
The Scheme Navigator Team
"""
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@schemenavigator.gov.in')

        email_sent = False
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[email],
                fail_silently=False,
            )
            email_sent = True
        except Exception as e:
            logger.warning("Could not send email via configured backend: %s. OTP logged: %s", e, otp_record.otp)
            # In local dev / fallback, we log the OTP to console so development is unblocked
            print(f"\n==========================================")
            print(f"[OTP NOTIFICATION] To: {email}")
            print(f"[OTP NOTIFICATION] Code: {otp_record.otp} (Purpose: {purpose})")
            print(f"==========================================\n")

        smtp_configured = bool(getattr(settings, 'EMAIL_HOST_USER', '')) and str(getattr(settings, 'EMAIL_BACKEND', '')).endswith('smtp.EmailBackend')

        if purpose == 'signup' and user_exists:
            msg = f"An account with this email already exists. Verification code sent to log you in."
        elif purpose == 'login' and not user_exists:
            msg = f"No account found. Verification code sent to set up and log into your new account."
        elif email_sent:
            msg = f"Verification code sent to {email}."
        else:
            msg = f"Verification code generated for {email}."

        res_data = {
            "message": msg,
            "email": email,
            "purpose": purpose,
            "expiresInMinutes": 10,
            "isSmtpConfigured": smtp_configured,
            "userExists": user_exists,
        }
        return Response(res_data, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    """
    POST /api/auth/verify-otp/
    Verifies the submitted OTP and completes registration or login.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        otp = serializer.validated_data['otp'].strip()
        purpose = serializer.validated_data['purpose']
        name = serializer.validated_data.get('name', '').strip()
        password = serializer.validated_data.get('password', '').strip()

        # Find latest active unverified OTP for this email
        otp_record = EmailOTP.objects.filter(
            email=email,
            is_verified=False
        ).order_by('-created_at').first()

        if not otp_record or otp_record.is_expired:
            return Response(
                {"error": "Verification code has expired or is invalid. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if otp_record.attempts >= 5:
            return Response(
                {"error": "Too many incorrect attempts. Please request a new verification code."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if otp_record.otp != otp:
            otp_record.attempts += 1
            otp_record.save(update_fields=['attempts'])
            remaining = max(0, 5 - otp_record.attempts)
            return Response(
                {"error": f"Incorrect verification code. {remaining} attempt(s) remaining."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark OTP as verified
        otp_record.is_verified = True
        otp_record.save(update_fields=['is_verified'])

        # Handle user signup or login
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            display_name = name or email.split('@')[0]
            user = User(
                username=email,
                email=email,
                first_name=display_name,
            )
            if password:
                user.set_password(password)
            else:
                user.set_unusable_password()
            user.save()
        else:
            if name and not user.first_name:
                user.first_name = name
                user.save(update_fields=['first_name'])
            if password and (purpose == 'reset' or not user.has_usable_password()):
                user.set_password(password)
                user.save(update_fields=['password'])

        login(request, user)
        token = generate_user_auth_token(user)
        user_data = UserSerializer(user).data
        return Response({
            "message": "Verification successful.",
            "token": token,
            "user": user_data,
        }, status=status.HTTP_200_OK)


class LoginView(APIView):
    """
    POST /api/auth/login/
    Standard email and password login.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']

        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.check_password(password):
            return Response(
                {"error": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        login(request, user)
        token = generate_user_auth_token(user)
        return Response({
            "message": "Login successful.",
            "token": token,
            "user": UserSerializer(user).data,
        }, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    GET /api/auth/me/
    Returns the currently authenticated user or null.
    """
    def get(self, request):
        user = resolve_request_user(request)
        if user:
            return Response({"user": UserSerializer(user).data})
        return Response({"user": None})


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Logs out the current user session.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        underlying_request = getattr(request, "_request", request)
        logout(underlying_request)
        return Response({"message": "Logged out successfully."})
