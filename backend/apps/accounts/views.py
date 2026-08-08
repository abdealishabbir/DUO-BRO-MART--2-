"""
PRD §4 — Authentication & Security Architecture. Views are grouped to
match §14 Phase 2's five sub-features: 2.1 signup/login, 2.2 social login,
2.3 forgot password/session security, 2.4 vendor & admin login, 2.5
account page. See utils.py for the cookie/email/lockout mechanics these
views lean on.
"""

from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import ScopedRateThrottle

from django.conf import settings

from .models import Address, AdminMFADevice, EmailVerificationToken, PasswordResetToken, VendorApplication
from .permissions import IsAdminRole, IsVendorRole
from apps.core.audit import log_admin_action
from .utils import provision_vendor_account
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
    VendorApplicationCreateSerializer,
    VendorApplicationSerializer,
)
from .utils import (
    clear_failed_logins,
    clear_jwt_cookies,
    consume_mfa_pending_token,
    generate_recovery_codes,
    generate_totp_secret,
    is_locked_out,
    issue_jwt_cookies,
    issue_mfa_pending_token,
    maybe_send_new_vendor_application_alert,
    record_failed_login,
    resolve_mfa_pending_token,
    send_password_reset_email,
    send_verification_email,
    totp_provisioning_uri,
    totp_qr_code_data_uri,
    verify_and_consume_recovery_code,
    verify_google_id_token,
    verify_recaptcha,
    verify_totp_code,
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
            {"detail": "Account created. Check your email to verify your address.", "user": UserSerializer(user, context={"request": request}).data},
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
        response = Response({"user": UserSerializer(user, context={"request": request}).data})
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

        response = Response({"user": UserSerializer(user, context={"request": request}).data})
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
            "user": UserSerializer(user, context={"request": request}).data,
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
        response = Response({"user": UserSerializer(user, context={"request": request}).data})
        return issue_jwt_cookies(response, user, keep_logged_in=False)


class AdminLoginView(APIView):
    """§4.3/§8.1: rate-limited and IP-loggable. If the admin has opted into
    TOTP two-factor (AdminMFADevice.is_enabled), a correct password alone
    does NOT issue session cookies — it returns an mfa_required + a
    short-lived pending token instead, and MFALoginVerifyView finishes
    the login once the second factor checks out."""

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

        device = getattr(user, "mfa_device", None)
        if device is not None and device.is_enabled:
            return Response({"mfa_required": True, "mfa_token": issue_mfa_pending_token(user)})

        response = Response({"user": UserSerializer(user, context={"request": request}).data})
        return issue_jwt_cookies(response, user, keep_logged_in=False)


class MFALoginVerifyView(APIView):
    """§8.1: second step of admin login when 2FA is enabled — completes
    the session given a valid TOTP code or an unused recovery code."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-write"

    def post(self, request):
        token = request.data.get("mfa_token", "")
        code = request.data.get("code", "")

        user_id = resolve_mfa_pending_token(token)
        if user_id is None:
            return Response({"detail": "That login attempt expired. Please sign in again."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=user_id, role=User.Role.ADMIN).first()
        device = getattr(user, "mfa_device", None) if user else None
        if user is None or device is None or not device.is_enabled:
            consume_mfa_pending_token(token)
            return Response({"detail": "That login attempt is no longer valid. Please sign in again."}, status=status.HTTP_400_BAD_REQUEST)

        lockout_key = f"mfa:{user.email}"
        if is_locked_out(lockout_key):
            return Response({"detail": "Too many failed codes. Try again in 15 minutes."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        valid = verify_totp_code(device.secret, code) or verify_and_consume_recovery_code(device, code)
        if not valid:
            record_failed_login(lockout_key)
            return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

        clear_failed_logins(lockout_key)
        consume_mfa_pending_token(token)
        response = Response({"user": UserSerializer(user, context={"request": request}).data})
        return issue_jwt_cookies(response, user, keep_logged_in=False)


class MFAStatusView(APIView):
    """§8.1: whether the logged-in admin currently has 2FA enabled — drives the Settings toggle."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        device = getattr(request.user, "mfa_device", None)
        return Response({"is_enabled": bool(device and device.is_enabled)})


class MFASetupView(APIView):
    """§8.1: step 1 — mint a fresh (unconfirmed) secret + QR code. Calling
    this again before confirming just replaces the pending secret, so an
    admin can safely retry a botched QR scan."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        secret = generate_totp_secret()
        AdminMFADevice.objects.update_or_create(
            user=request.user, defaults={"secret": secret, "is_enabled": False, "confirmed_at": None},
        )
        uri = totp_provisioning_uri(request.user, secret)
        return Response({"secret": secret, "qr_code_data_uri": totp_qr_code_data_uri(uri)})


class MFAConfirmView(APIView):
    """§8.1: step 2 — prove the authenticator app actually works before
    2FA starts being enforced on login. Returns the recovery codes exactly
    once; nothing about them is retrievable again after this response."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        device = getattr(request.user, "mfa_device", None)
        if device is None:
            return Response({"detail": "Start setup first."}, status=status.HTTP_400_BAD_REQUEST)
        if not verify_totp_code(device.secret, request.data.get("code", "")):
            return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

        device.is_enabled = True
        device.confirmed_at = timezone.now()
        device.save(update_fields=["is_enabled", "confirmed_at"])
        codes = generate_recovery_codes(device)
        return Response({"recovery_codes": codes})


class MFADisableView(APIView):
    """§8.1: requires both the account password AND a valid second-factor
    code — a stolen logged-in session alone isn't enough to turn off 2FA,
    the same reasoning GitHub/Google apply to this exact action."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        device = getattr(request.user, "mfa_device", None)
        if device is None or not device.is_enabled:
            return Response({"detail": "Two-factor authentication isn't enabled."}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(request.data.get("password", "")):
            return Response({"detail": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)

        code = request.data.get("code", "")
        if not (verify_totp_code(device.secret, code) or verify_and_consume_recovery_code(device, code)):
            return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

        device.delete()
        return Response({"detail": "Two-factor authentication has been disabled."})


class MFARegenerateRecoveryCodesView(APIView):
    """§8.1: invalidates every existing recovery code and issues a fresh batch."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        device = getattr(request.user, "mfa_device", None)
        if device is None or not device.is_enabled:
            return Response({"detail": "Two-factor authentication isn't enabled."}, status=status.HTTP_400_BAD_REQUEST)

        code = request.data.get("code", "")
        if not (verify_totp_code(device.secret, code) or verify_and_consume_recovery_code(device, code)):
            return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"recovery_codes": generate_recovery_codes(device)})


# ---------------------------------------------------------------------------
# 2.5 Customer Account page
# ---------------------------------------------------------------------------

class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user, context={"request": request}).data)


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class VendorApplicationCreateView(generics.CreateAPIView):
    """§5.7: public application form — no auth required."""

    permission_classes = [permissions.AllowAny]
    serializer_class = VendorApplicationCreateSerializer

    def perform_create(self, serializer):
        application = serializer.save()
        maybe_send_new_vendor_application_alert(application)


class AdminVendorApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    """§6.5: admin reviews pending applications, approves (provisions the vendor account) or rejects."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = VendorApplicationSerializer

    def get_queryset(self):
        qs = VendorApplication.objects.all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        application = self.get_object()
        if application.status != VendorApplication.Status.PENDING:
            return Response({"detail": "This application has already been decided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user, _temp_password, email_status = provision_vendor_account(
                application.email, application.owner_name.split(" ")[0], " ".join(application.owner_name.split(" ")[1:])
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        application.status = VendorApplication.Status.APPROVED
        application.decided_at = timezone.now()
        application.decided_by = request.user
        application.created_vendor = user
        application.save(update_fields=["status", "decided_at", "decided_by", "created_vendor"])
        log_admin_action(request.user, "vendor_application.approved", application)

        return Response({**VendorApplicationSerializer(application).data, "email_status": email_status})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        application = self.get_object()
        if application.status != VendorApplication.Status.PENDING:
            return Response({"detail": "This application has already been decided."}, status=status.HTTP_400_BAD_REQUEST)

        application.status = VendorApplication.Status.REJECTED
        application.admin_notes = request.data.get("admin_notes", "")
        application.decided_at = timezone.now()
        application.decided_by = request.user
        application.save(update_fields=["status", "admin_notes", "decided_at", "decided_by"])
        log_admin_action(request.user, "vendor_application.rejected", application, details=application.admin_notes)
        return Response(VendorApplicationSerializer(application).data)


class AdminVendorListView(generics.ListAPIView):
    """
    §6.5: active/suspended vendor roster with lifetime sales stats —
    Products/Gross Sales/Commission Earned/Net Paid Out are computed
    from real order data (apps.orders), not placeholders. There's no
    rating field yet (Phase 7/8 Feedback subsystem), so it's left out.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        qs = get_user_model().objects.filter(role=get_user_model().Role.VENDOR)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(username__icontains=search) | Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search))
        return qs

    def list(self, request, *args, **kwargs):
        from django.db.models import Avg

        from apps.feedback.models import Feedback
        from apps.orders.models import OrderItem
        from apps.products.models import Product

        vendors = self.get_queryset()
        results = []
        for vendor in vendors:
            items = OrderItem.objects.filter(vendor=vendor).exclude(order__status="cancelled")
            gross_sales = sum((i.line_total for i in items), 0)
            net_paid_out = sum((i.net_to_vendor for i in items), 0)
            commission_earned = gross_sales - net_paid_out
            rating = Feedback.objects.filter(order__items__vendor=vendor).aggregate(avg=Avg("overall_rating"))["avg"]
            results.append({
                "id": vendor.id,
                "business_name": f"{vendor.first_name} {vendor.last_name}".strip() or vendor.username,
                "email": vendor.email,
                "product_count": Product.objects.filter(vendor=vendor).count(),
                "gross_sales": gross_sales,
                "commission_earned": commission_earned,
                "net_paid_out": net_paid_out,
                "rating": round(rating, 1) if rating is not None else None,
                "is_active": vendor.is_active,
                "must_change_password": vendor.must_change_password,
                "payout_hold_days_override": vendor.payout_hold_days_override,
                "payout_cycle_days_override": vendor.payout_cycle_days_override,
            })
        return Response(results)


class AdminVendorSuspendView(APIView):
    """§6.5: suspend a poorly-performing vendor (blocks login) or reactivate one."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        User = get_user_model()
        try:
            vendor = User.objects.get(pk=pk, role=User.Role.VENDOR)
        except User.DoesNotExist:
            return Response({"detail": "Vendor not found."}, status=status.HTTP_404_NOT_FOUND)

        action_type = request.data.get("action", "suspend")
        vendor.is_active = action_type != "suspend"
        vendor.save(update_fields=["is_active"])
        log_admin_action(request.user, "vendor.suspended" if action_type == "suspend" else "vendor.reinstated", vendor)
        return Response({"id": vendor.id, "is_active": vendor.is_active})


class AdminVendorPayoutScheduleView(APIView):
    """
    §6.7 deferred item: per-vendor payout schedule tiers. Most vendors just
    use PlatformSettings.payout_hold_days/payout_cycle_days (see
    apps.orders.payouts) — this lets an admin give an individual vendor a
    shorter (or longer) hold/cycle, e.g. faster disbursement for an
    established, high-trust seller. Send null/blank for either field to
    reset that one back to the platform default.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    MAX_DAYS = 90

    def patch(self, request, pk):
        User = get_user_model()
        try:
            vendor = User.objects.get(pk=pk, role=User.Role.VENDOR)
        except User.DoesNotExist:
            return Response({"detail": "Vendor not found."}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []
        for field, label in (("payout_hold_days_override", "hold days"), ("payout_cycle_days_override", "cycle days")):
            if field not in request.data:
                continue
            raw = request.data.get(field)
            if raw in (None, ""):
                setattr(vendor, field, None)
            else:
                try:
                    value = int(raw)
                except (TypeError, ValueError):
                    return Response({"detail": f"Invalid {label}: must be a whole number of days."}, status=status.HTTP_400_BAD_REQUEST)
                if not (0 <= value <= self.MAX_DAYS):
                    return Response({"detail": f"{label.capitalize()} must be between 0 and {self.MAX_DAYS}."}, status=status.HTTP_400_BAD_REQUEST)
                setattr(vendor, field, value)
            update_fields.append(field)

        if not update_fields:
            return Response({"detail": "Nothing to update — send payout_hold_days_override and/or payout_cycle_days_override."}, status=status.HTTP_400_BAD_REQUEST)

        vendor.save(update_fields=update_fields)
        log_admin_action(
            request.user, "vendor.payout_schedule_changed", vendor,
            details=f"hold={vendor.payout_hold_days_override if vendor.payout_hold_days_override is not None else 'default'}, "
                    f"cycle={vendor.payout_cycle_days_override if vendor.payout_cycle_days_override is not None else 'default'}",
        )
        return Response({
            "id": vendor.id,
            "payout_hold_days_override": vendor.payout_hold_days_override,
            "payout_cycle_days_override": vendor.payout_cycle_days_override,
        })


# ---------------------------------------------------------------------------
# Public vendor storefront page (UX-survey gap)
# ---------------------------------------------------------------------------

class VendorStorefrontView(APIView):
    """
    GET /api/accounts/vendors/<id>/store/ — public "shop page" for a
    vendor. 404s for anyone who isn't an active vendor (wrong id,
    customer/admin id, or a suspended vendor — AdminVendorSuspendView
    above is what flips is_active) so this can't be used to probe
    account existence/role/status for arbitrary ids.

    Rating mirrors AdminVendorListView's calculation (overall_rating
    averaged across the vendor's own order feedback) rather than
    averaging each product's rating, so the two vendor-rating numbers
    that exist in this codebase stay consistent with each other.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "public-catalog"

    def get(self, request, pk):
        from django.db.models import Avg

        from apps.feedback.models import Feedback
        from apps.products.models import Product

        User = get_user_model()
        try:
            vendor = User.objects.get(pk=pk, role=User.Role.VENDOR, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "Vendor not found."}, status=status.HTTP_404_NOT_FOUND)

        rating = Feedback.objects.filter(order__items__vendor=vendor).aggregate(avg=Avg("overall_rating"))["avg"]

        return Response({
            "id": vendor.id,
            "shop_name": vendor.shop_name or (f"{vendor.first_name} {vendor.last_name}".strip() or vendor.username),
            "shop_logo": request.build_absolute_uri(vendor.shop_logo.url) if vendor.shop_logo else None,
            "shop_description": vendor.shop_description,
            "product_count": Product.objects.filter(vendor=vendor, status=Product.Status.APPROVED, is_active=True).count(),
            "rating": round(rating, 1) if rating is not None else None,
            "member_since": vendor.date_joined,
        })
