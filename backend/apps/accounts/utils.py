"""
Shared helpers for the accounts app. Kept out of views.py so the views
stay readable — each function here does one job and is unit-testable on
its own (see apps/accounts/tests.py).
"""

import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
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


def maybe_send_new_vendor_application_alert(application) -> None:
    """§6.7/§7.7: admin notification toggle — fires once, right after a
    public vendor application is submitted (§5.7), same pattern as
    apps.products.utils.maybe_send_low_stock_alert."""
    from apps.core.models import PlatformSettings

    settings_row = PlatformSettings.get_solo()
    if not settings_row.notify_new_vendor_applications:
        return

    send_mail(
        subject=f"New vendor application: {application.business_name}",
        message=(
            f"{application.business_name} ({application.owner_name}) applied to sell on Duo Bro Mart.\n\n"
            f"Contact: {application.email} / {application.phone_number}\n"
            f"Business type: {application.business_type}\n\n"
            "Review it in the admin Vendors panel."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings_row.store_email],
        fail_silently=True,  # a missed alert email should never fail the applicant's submission
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


# ---------------------------------------------------------------------------
# §8.1 hardening: opt-in TOTP two-factor for admin accounts
# ---------------------------------------------------------------------------

MFA_PENDING_TOKEN_TTL = 300  # 5 minutes to complete the second factor after a correct password
MFA_RECOVERY_CODE_COUNT = 8


def _mfa_pending_cache_key(token: str) -> str:
    return f"mfa-pending:{token}"


def issue_mfa_pending_token(user) -> str:
    """After a correct password for an admin with MFA enabled: mint a
    short-lived opaque token identifying who's mid-login, instead of
    issuing real session cookies yet. Deliberately not a JWT — this token
    must NOT be usable as a bearer credential for anything, only as a
    lookup key the second-factor step consumes once."""
    token = secrets.token_urlsafe(32)
    cache.set(_mfa_pending_cache_key(token), user.id, timeout=MFA_PENDING_TOKEN_TTL)
    return token


def resolve_mfa_pending_token(token: str):
    """Returns the pending user's id, or None if the token is missing/expired/already used."""
    return cache.get(_mfa_pending_cache_key(token))


def consume_mfa_pending_token(token: str) -> None:
    cache.delete(_mfa_pending_cache_key(token))


def generate_totp_secret() -> str:
    import pyotp

    return pyotp.random_base32()


def totp_provisioning_uri(user, secret: str) -> str:
    import pyotp

    return pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="Duo Bro Mart Admin")


def totp_qr_code_data_uri(provisioning_uri: str) -> str:
    """Renders the provisioning URI as a base64 PNG the frontend can drop
    straight into an <img src="...">, so the frontend needs no QR library
    of its own."""
    import base64
    import io

    import qrcode

    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def verify_totp_code(secret: str, code: str) -> bool:
    import pyotp

    if not code:
        return False
    # valid_window=1 tolerates the ~30s clock drift real phones/servers
    # routinely have, without widening the brute-force window enough to matter.
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def generate_recovery_codes(device) -> list[str]:
    """Creates MFA_RECOVERY_CODE_COUNT fresh single-use codes for `device`,
    deleting any previous ones first (regenerating invalidates the old
    batch entirely — same behavior as GitHub/Google). Returns the
    PLAINTEXT codes — this is the only moment they ever exist outside a
    hash; the caller must show them to the admin now, nothing persists them."""
    from .models import MFARecoveryCode

    device.recovery_codes.all().delete()
    plaintext_codes = []
    for _ in range(MFA_RECOVERY_CODE_COUNT):
        # xxxx-xxxx shape: easy to read/type back, ~1.7e9 possibilities per
        # code from this alphabet — plenty for an 8-code single-use pool.
        raw = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        code = f"{raw[:4]}-{raw[4:]}"
        plaintext_codes.append(code)
        MFARecoveryCode.objects.create(device=device, code_hash=make_password(code))
    return plaintext_codes


def verify_and_consume_recovery_code(device, code: str) -> bool:
    """Checks `code` against every unused recovery code on `device`; marks
    the matching one used (single-use) and returns True, or returns False
    if none match. O(n) over ~8 rows — fine at this scale."""
    from django.utils import timezone

    if not code:
        return False
    for recovery_code in device.recovery_codes.filter(used_at__isnull=True):
        if check_password(code.strip(), recovery_code.code_hash):
            recovery_code.used_at = timezone.now()
            recovery_code.save(update_fields=["used_at"])
            return True
    return False
