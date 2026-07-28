"""
Shared helpers for the accounts app. Kept out of views.py so the views
stay readable — each function here does one job and is unit-testable on
its own (see apps/accounts/tests.py).
"""

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from rest_framework_simplejwt.tokens import RefreshToken

# ---------------------------------------------------------------------------
# Email (§4.2: verification link, password reset link; §4.3: vendor creds)
# ---------------------------------------------------------------------------

def send_verification_email(user, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email/{token}"
    send_mail(
        subject="Confirm your Duo Bro Mart account",
        message=(
            f"Hi {user.first_name or user.username},\n\n"
            f"Confirm your email address to activate your Duo Bro Mart account:\n{link}\n\n"
            "This link expires in 24 hours. If you didn't create this account, ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_password_reset_email(user, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password/{token}"
    send_mail(
        subject="Reset your Duo Bro Mart password",
        message=(
            f"Hi {user.first_name or user.username},\n\n"
            f"Use this link to reset your password:\n{link}\n\n"
            "This link expires in 30 minutes and can only be used once. "
            "If you didn't request this, you can safely ignore this email — "
            "your password will not be changed."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_vendor_credentials_email(user, temporary_password: str) -> None:
    """§4.3: admin approves a vendor -> system emails temp credentials, forces change on first login."""
    link = f"{settings.FRONTEND_URL}/vendor/login"
    send_mail(
        subject="Your Duo Bro Mart vendor account is ready",
        message=(
            f"Hi {user.first_name or user.username},\n\n"
            f"Your vendor account has been approved. Sign in at {link} with:\n\n"
            f"  Email: {user.email}\n"
            f"  Temporary password: {temporary_password}\n\n"
            "You'll be asked to set a new password on first login."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def provision_vendor_account(email: str, first_name: str = "", last_name: str = ""):
    """
    §4.3/§6.5: creates the vendor User account + temp password + sends
    credentials email. Shared by the admin approval action
    (VendorApplicationViewSet.approve) and the create_vendor_account
    management command (dev convenience for creating a vendor without
    going through a public application first).

    Returns (user, email_status_message). Raises ValueError if the email
    is already in use — the caller decides how to surface that.
    """
    import secrets

    from django.contrib.auth import get_user_model

    User = get_user_model()
    email = email.lower().strip()
    if User.objects.filter(email__iexact=email).exists():
        raise ValueError(f"A user with email {email} already exists.")

    temp_password = secrets.token_urlsafe(9)
    user = User.objects.create(
        username=email,
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=User.Role.VENDOR,
        email_verified=True,
        must_change_password=True,
    )
    user.set_password(temp_password)
    user.save()

    try:
        send_vendor_credentials_email(user, temp_password)
        email_status = "Credentials email sent (check console output in dev)."
    except Exception as exc:  # pragma: no cover — surfaced to the caller either way
        email_status = f"Could not send email ({exc}); share the password below manually."

    return user, temp_password, email_status


# ---------------------------------------------------------------------------
# Login lockout (§4.4.8) — cache-based, no extra DB table needed.
# ---------------------------------------------------------------------------

_LOCKOUT_MAX_ATTEMPTS = 5
_LOCKOUT_WINDOW_SECONDS = 15 * 60  # 15 minutes


def _lockout_cache_key(identifier: str) -> str:
    return f"login_fail:{identifier.lower()}"


def record_failed_login(identifier: str) -> None:
    key = _lockout_cache_key(identifier)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, timeout=_LOCKOUT_WINDOW_SECONDS)


def clear_failed_logins(identifier: str) -> None:
    cache.delete(_lockout_cache_key(identifier))


def is_locked_out(identifier: str) -> bool:
    return cache.get(_lockout_cache_key(identifier), 0) >= _LOCKOUT_MAX_ATTEMPTS


# ---------------------------------------------------------------------------
# JWT cookies (§4.4.3: HttpOnly, Secure, SameSite — never localStorage)
# ---------------------------------------------------------------------------

def issue_jwt_cookies(response, user, keep_logged_in: bool = False):
    """
    Mints a fresh access/refresh token pair for `user` and attaches them to
    `response` as HttpOnly cookies. Returns the response for chaining.
    """
    refresh = RefreshToken.for_user(user)

    lifetime = (
        settings.JWT_REFRESH_LIFETIME_KEEP_LOGGED_IN
        if keep_logged_in
        else settings.JWT_REFRESH_LIFETIME_DEFAULT
    )
    refresh.set_exp(lifetime=lifetime)

    access = refresh.access_token

    response.set_cookie(
        settings.JWT_ACCESS_COOKIE,
        str(access),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        path="/",
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE,
        str(refresh),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=int(lifetime.total_seconds()),
        path="/",
    )
    return response


def clear_jwt_cookies(response):
    response.delete_cookie(settings.JWT_ACCESS_COOKIE, path="/")
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path="/")
    return response


# ---------------------------------------------------------------------------
# reCAPTCHA (§4.4.8) — Phase 8 hardening wires a real site/secret key.
# ---------------------------------------------------------------------------

def verify_recaptcha(token) -> bool:
    """
    Returns True (i.e. "passes") when RECAPTCHA_SECRET_KEY isn't configured,
    so signup works in dev/staging before real keys exist. Once
    RECAPTCHA_SECRET_KEY is set, a missing token fails the check — wiring
    the actual Google verify-token HTTP call is Phase 8 scope.
    """
    if not settings.RECAPTCHA_SECRET_KEY:
        return True
    return bool(token)  # placeholder until Phase 8 adds the real HTTP verification call


# ---------------------------------------------------------------------------
# Google Sign-In (§2.2/§4.2) — verified server-side, never trust a client-sent profile.
# ---------------------------------------------------------------------------

class GoogleTokenError(Exception):
    pass


def verify_google_id_token(id_token_str: str) -> dict:
    """
    Verifies a Google ID token against Google's public certs and returns
    the decoded payload (contains "sub", "email", "email_verified",
    "given_name", "family_name"). Raises GoogleTokenError if the token is
    invalid/expired or GOOGLE_OAUTH_CLIENT_ID isn't configured.
    """
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        raise GoogleTokenError(
            "Google login isn't configured yet — set GOOGLE_OAUTH_CLIENT_ID in .env."
        )

    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        payload = google_id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID
        )
    except ValueError as exc:  # invalid/expired token, wrong audience, etc.
        raise GoogleTokenError(str(exc)) from exc

    if not payload.get("email_verified", False):
        raise GoogleTokenError("Google account email is not verified.")

    return payload
