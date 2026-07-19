"""
PRD §4 — Authentication & Security Architecture. Views are grouped to
match §14 Phase 2's five sub-features: 2.1 signup/login, 2.2 social login,
2.3 forgot password/session security, 2.4 vendor & admin login, 2.5
account page. See utils.py for the cookie/email/lockout mechanics these
views lean on.
"""

from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import ScopedRateThrottle

from django.conf import settings

from .models import Address, EmailVerificationToken, PasswordResetToken
from .permissions import IsAdminRole, IsVendorRole
from .serializers import (
    AddressSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    GoogleLoginSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    ResetPasswordSerializer,
    SignupSerializer,
    UserSerializer,
)
from .utils import (
    clear_failed_logins,
    clear_jwt_cookies,
    is_locked_out,
    issue_jwt_cookies,
    record_failed_login,
    send_password_reset_email,
    send_verification_email,
    verify_google_id_token,
    verify_recaptcha,
    GoogleTokenError,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# 2.1 Customer signup & login
# ---------------------------------------------------------------------------

class SignupView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        if not verify_recaptcha(request.data.get("recaptcha_token")):
            return Response({"detail": "reCAPTCHA verification failed."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        token = EmailVerificationToken.objects.create(user=user)
        send_verification_email(user, token.token)

        # Design decision: the account is usable immediately (matches Daraz/
        # Amazon UX) — email_verified is tracked and surfaced in the UI as a
        # "please confirm your email" reminder, but doesn't block login.
        response = Response(
            {"detail": "Account created. Check your email to verify your address.", "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
        return issue_jwt_cookies(response, user, keep_logged_in=False)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        try:
            record = EmailVerificationToken.objects.select_related("user").get(token=token)
        except EmailVerificationToken.DoesNotExist:
            return Response({"detail": "Invalid or expired verification link."}, status=status.HTTP_400_BAD_REQUEST)

        if not record.is_valid:
            return Response({"detail": "Invalid or expired verification link."}, status=status.HTTP_400_BAD_REQUEST)

        record.used_at = timezone.now()
        record.save(update_fields=["used_at"])
        record.user.email_verified = True
        record.user.save(update_fields=["email_verified"])

        return Response({"detail": "Email verified."})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower().strip()
        password = serializer.validated_data["password"]
        keep_logged_in = serializer.validated_data["keep_logged_in"]

        if is_locked_out(email):
            return Response(
                {"detail": "Too many failed attempts. Try again in 15 minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = authenticate(request, username=email, password=password)

        # §4.1: this endpoint is customer-only — vendor/admin accounts must
        # use their own portals even if the credentials are otherwise valid.
        if user is None or user.role != User.Role.CUSTOMER:
            record_failed_login(email)
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_400_BAD_REQUEST)

        clear_failed_logins(email)
        response = Response({"user": UserSerializer(user).data})
        return issue_jwt_cookies(response, user, keep_logged_in=keep_logged_in)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except Exception:
                pass  # already invalid/expired — fine, we're clearing cookies regardless
        response = Response({"detail": "Logged out."})
        return clear_jwt_cookies(response)


class RefreshView(APIView):
    """Reads the refresh cookie, rotates it, and issues a new access cookie."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
        if not raw_refresh:
            return Response({"detail": "No refresh token."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            old_refresh = RefreshToken(raw_refresh)
            user = User.objects.get(id=old_refresh["user_id"])
        except Exception:
            response = Response({"detail": "Session expired, please log in again."}, status=status.HTTP_401_UNAUTHORIZED)
            return clear_jwt_cookies(response)

        try:
            old_refresh.blacklist()
        except Exception:
            pass

        response = Response({"user": UserSerializer(user).data})
        return issue_jwt_cookies(response, user, keep_logged_in=False)


# ---------------------------------------------------------------------------
# 2.2 Social login (Google now; Facebook follows the same shape once a
# FACEBOOK_APP_ID/SECRET is configured — see utils.py note).
# ---------------------------------------------------------------------------

class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payload = verify_google_id_token(serializer.validated_data["id_token"])
        except GoogleTokenError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        google_sub = payload["sub"]
        email = payload.get("email", "").lower()

        user = User.objects.filter(google_sub=google_sub).first()
        created = False
        if user is None:
            # §2.2: link to an existing email/password account if one exists,
            # otherwise create a fresh customer account.
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                user = User(
                    username=email or f"google-{google_sub}",
                    email=email,
                    first_name=payload.get("given_name", ""),
                    last_name=payload.get("family_name", ""),
                    role=User.Role.CUSTOMER,
                    email_verified=True,
                )
                user.set_unusable_password()
                created = True
            user.google_sub = google_sub
            user.email_verified = True
            user.save()

        if user.role != User.Role.CUSTOMER:
            return Response({"detail": "This Google account is linked to a non-customer role."}, status=status.HTTP_400_BAD_REQUEST)

        response = Response({
            "user": UserSerializer(user).data,
            "needs_phone_number": not bool(user.phone_number),  # §2.2: prompt for phone if missing
            "created": created,
        })
        return issue_jwt_cookies(response, user, keep_logged_in=True)


# ---------------------------------------------------------------------------
# 2.3 Forgot password & session security
# ---------------------------------------------------------------------------

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower().strip()

        user = User.objects.filter(email__iexact=email).first()
        if user is not None:
            token = PasswordResetToken.objects.create(user=user)
            send_password_reset_email(user, token.token)

        # §4.2: identical response whether or not the email exists, to
        # prevent account enumeration.
        return Response({"detail": "If that email exists, a reset link has been sent."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            record = PasswordResetToken.objects.select_related("user").get(token=serializer.validated_data["token"])
        except PasswordResetToken.DoesNotExist:
            return Response({"detail": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not record.is_valid:
            return Response({"detail": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)

        user = record.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        record.used_at = timezone.now()
        record.save(update_fields=["used_at"])

        # §4.2: "all existing sessions invalidated" — blacklist every
        # outstanding refresh token for this user.
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        clear_failed_logins(user.email)

        return Response({"detail": "Password has been reset. Please log in again."})


class ChangePasswordView(APIView):
    """Used by both the customer Account > Security tab and the vendor
    forced first-login password change (§2.4/§2.5)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["current_password"]):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])

        return Response({"detail": "Password updated."})


# ---------------------------------------------------------------------------
# 2.4 Vendor & admin login
# ---------------------------------------------------------------------------

class VendorLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower().strip()
        password = serializer.validated_data["password"]

        if is_locked_out(email):
            return Response({"detail": "Too many failed attempts. Try again in 15 minutes."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        user = authenticate(request, username=email, password=password)
        if user is None or user.role != User.Role.VENDOR:
            record_failed_login(email)
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_400_BAD_REQUEST)

        clear_failed_logins(email)
        response = Response({"user": UserSerializer(user).data})
        return issue_jwt_cookies(response, user, keep_logged_in=False)


class AdminLoginView(APIView):
    """§4.3: rate-limited and IP-loggable. TOTP two-factor is a Phase 8
    hardening item (flagged there, not silently skipped)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower().strip()
        password = serializer.validated_data["password"]

        if is_locked_out(email):
            return Response({"detail": "Too many failed attempts. Try again in 15 minutes."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        user = authenticate(request, username=email, password=password)
        if user is None or user.role != User.Role.ADMIN:
            record_failed_login(email)
            # Deliberately generic + logged server-side only; admin login
            # attempts are a higher-value target than customer login.
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_400_BAD_REQUEST)

        clear_failed_logins(email)
        response = Response({"user": UserSerializer(user).data})
        return issue_jwt_cookies(response, user, keep_logged_in=False)


# ---------------------------------------------------------------------------
# 2.5 Customer Account page
# ---------------------------------------------------------------------------

class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)
