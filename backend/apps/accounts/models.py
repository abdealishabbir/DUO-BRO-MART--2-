"""
Phase 1 scope: the User model itself and its `role` field, which is the
single source of truth RBAC is built on (see permissions.py). Signup/login
flows, social auth, password reset, phone/CNIC validation, and profile
fields (§4.2–§4.4) are implemented in Phase 2 — this model already has the
fields they'll need so migrations don't churn later.
"""

import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from PIL import Image

from .managers import UserManager

# §8.1: CNIC photos weren't validated for type/size at all (unlike banner
# images, which already had this) — an easy way for a malicious upload to
# slip through as a vendor "identity document". No fixed-ratio requirement
# here (a real CNIC photo's proportions vary by phone/scanner), just: is it
# actually a readable image, a sane format, and not a garbage-sized file.
CNIC_MAX_FILE_SIZE_MB = 5
CNIC_MIN_WIDTH = 400
CNIC_MIN_HEIGHT = 250
ALLOWED_CNIC_FORMATS = {"JPEG", "PNG"}


def validate_cnic_image(image_file):
    if image_file.size > CNIC_MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ValidationError(f"Image is too large — please upload a file under {CNIC_MAX_FILE_SIZE_MB}MB.")

    try:
        img = Image.open(image_file)
        img.verify()
        image_file.seek(0)
        img = Image.open(image_file)  # re-open: verify() leaves the image unusable
        width, height = img.size
        image_format = img.format
    except Exception as exc:
        raise ValidationError("Couldn't read that image file — please upload a valid PNG or JPEG.") from exc
    finally:
        image_file.seek(0)

    if image_format not in ALLOWED_CNIC_FORMATS:
        raise ValidationError("Only PNG, JPG, or JPEG images are allowed.")
    if width < CNIC_MIN_WIDTH or height < CNIC_MIN_HEIGHT:
        raise ValidationError(
            f"Image is only {width}x{height}px — it's too small to be a legible CNIC photo "
            f"(minimum {CNIC_MIN_WIDTH}x{CNIC_MIN_HEIGHT}px)."
        )

# Same "is it actually a readable, sane-sized image" bar as CNIC/banner/
# feedback uploads (§8.1 precedent) — a vendor's public storefront logo.
SHOP_LOGO_MAX_FILE_SIZE_MB = 3
SHOP_LOGO_MIN_WIDTH = 100
SHOP_LOGO_MIN_HEIGHT = 100
ALLOWED_SHOP_LOGO_FORMATS = {"JPEG", "PNG"}


def validate_shop_logo(image_file):
    if image_file.size > SHOP_LOGO_MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ValidationError(f"Logo is too large — please upload a file under {SHOP_LOGO_MAX_FILE_SIZE_MB}MB.")

    try:
        img = Image.open(image_file)
        img.verify()
        image_file.seek(0)
        img = Image.open(image_file)
        width, height = img.size
        image_format = img.format
    except Exception as exc:
        raise ValidationError("Couldn't read that image file — please upload a valid PNG or JPEG.") from exc
    finally:
        image_file.seek(0)

    if image_format not in ALLOWED_SHOP_LOGO_FORMATS:
        raise ValidationError("Only PNG, JPG, or JPEG images are allowed.")
    if width < SHOP_LOGO_MIN_WIDTH or height < SHOP_LOGO_MIN_HEIGHT:
        raise ValidationError(
            f"Image is only {width}x{height}px — please upload a clearer logo "
            f"(minimum {SHOP_LOGO_MIN_WIDTH}x{SHOP_LOGO_MIN_HEIGHT}px)."
        )

# PRD §4.2: Pakistani phone format, e.g. +923001234567 or 03001234567
pk_phone_validator = RegexValidator(
    regex=r"^(\+92|0)3\d{9}$",
    message="Enter a valid Pakistani phone number, e.g. 03001234567 or +923001234567.",
)


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


class User(AbstractUser):
    """
    One User table serves all three channels (§3.1). `role` is what every
    RBAC permission check in this codebase keys off of — never infer role
    from which endpoint was hit.
    """

    class Role(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        VENDOR = "vendor", "Vendor"
        ADMIN = "admin", "Admin"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
        help_text="Drives RBAC — see apps/accounts/permissions.py.",
    )

    # Populated at signup (customer, §4.2) or by admin provisioning (vendor/admin, §4.1).
    phone_number = models.CharField(
        max_length=17,
        validators=[pk_phone_validator],
        blank=True,
    )

    # Phase 2: set True only after email confirmation link is clicked (§4.2).
    email_verified = models.BooleanField(default=False)

    # Phase 5 §5.1: vendors must change their admin-issued password on first login.
    must_change_password = models.BooleanField(default=False)

    # §4.2/§2.2: set when the account originated from (or was later linked to)
    # a social login, so we don't force a password on those accounts.
    google_sub = models.CharField(max_length=255, blank=True, unique=False, db_index=True)
    facebook_id = models.CharField(max_length=255, blank=True, unique=False, db_index=True)

    # Vendor storefront customization — only meaningful when role == VENDOR,
    # but kept on the shared User table rather than a separate profile
    # model, matching how phone_number/etc. already work here ("one User
    # table serves all three channels"). All optional: a vendor who never
    # sets these still gets a working storefront page, just with their
    # name standing in for shop_name and no logo/description (see
    # apps.accounts.serializers for the display fallback).
    shop_name = models.CharField(max_length=150, blank=True)
    shop_logo = models.ImageField(upload_to="vendor_shop/logos/", blank=True, null=True, validators=[validate_shop_logo])
    shop_description = models.TextField(blank=True, max_length=1000)

    # Per-vendor payout schedule override (Phase 8 deferred item) — most
    # vendors just use PlatformSettings.payout_hold_days/payout_cycle_days
    # (see apps.orders.payouts), but a high-volume or especially trusted
    # vendor might get a shorter hold/cycle, same idea as Amazon offering
    # faster disbursement tiers to established sellers. None means "use
    # the platform default" — only meaningful when role == VENDOR.
    payout_hold_days_override = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Overrides PlatformSettings.payout_hold_days for this vendor only. Leave blank to use the platform default.",
    )
    payout_cycle_days_override = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Overrides PlatformSettings.payout_cycle_days for this vendor only. Leave blank to use the platform default.",
    )

    objects = UserManager()

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_customer(self) -> bool:
        return self.role == self.Role.CUSTOMER

    @property
    def is_vendor(self) -> bool:
        return self.role == self.Role.VENDOR

    @property
    def is_platform_admin(self) -> bool:
        # Named to avoid clashing with Django's built-in is_staff/is_superuser.
        return self.role == self.Role.ADMIN


class VendorApplication(models.Model):
    """
    §5.7/§6.5: public application (frontend/src/pages/customer/BecomeVendor.jsx)
    reviewed by admin. Approval provisions a real vendor User account
    (see apps/accounts/utils.provision_vendor_account, shared with the
    create_vendor_account management command); rejection just records why.

    cnic_matches is a computed flag, not a hard validation error — a
    mismatch is a strong signal to reject (per the "must match" rule
    quoted to applicants), but it's the admin's call on review, not an
    automatic block at submission time.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    business_name = models.CharField(max_length=150)
    owner_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone_number = models.CharField(max_length=17, validators=[pk_phone_validator])
    business_type = models.CharField(max_length=50)
    description = models.TextField()
    social_links = models.CharField(max_length=255, blank=True)

    cnic_number = models.CharField(max_length=20)
    cnic_front = models.ImageField(upload_to="vendor_applications/cnic/", validators=[validate_cnic_image])
    cnic_back = models.ImageField(upload_to="vendor_applications/cnic/", validators=[validate_cnic_image])

    bank_name = models.CharField(max_length=100)
    account_title = models.CharField(max_length=150)
    account_number = models.CharField(max_length=50)
    account_cnic = models.CharField(max_length=20)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="decided_vendor_applications",
    )
    created_vendor = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="vendor_application",
        help_text="Set on approval — the account provisioned for this applicant.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.business_name} ({self.status})"

    @staticmethod
    def _normalize_cnic(value: str) -> str:
        return "".join(ch for ch in value if ch.isdigit())

    @property
    def cnic_matches(self) -> bool:
        return self._normalize_cnic(self.cnic_number) == self._normalize_cnic(self.account_cnic)


class Address(models.Model):
    """
    Customer saved address (PRD §2.5 Account Page, reused at checkout in
    Phase 4). Province/city + optional landmark supports the rural
    delivery flow described in §10.3/§4.4.5.
    """

    # Kept short and Pakistan-specific rather than a generic country list —
    # §10.1 scope is Pakistan-only for v1.
    PROVINCE_CHOICES = [
        ("punjab", "Punjab"),
        ("sindh", "Sindh"),
        ("khyber_pakhtunkhwa", "Khyber Pakhtunkhwa"),
        ("balochistan", "Balochistan"),
        ("gilgit_baltistan", "Gilgit-Baltistan"),
        ("azad_kashmir", "Azad Kashmir"),
        ("islamabad_ct", "Islamabad Capital Territory"),
    ]

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=50, default="Home")  # e.g. "Home", "Office"
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=17, validators=[pk_phone_validator])
    province = models.CharField(max_length=30, choices=PROVINCE_CHOICES)
    city = models.CharField(max_length=100)
    address_line = models.CharField(max_length=255)
    landmark = models.CharField(max_length=255, blank=True, help_text="For rural/hard-to-find delivery (§4.4.5).")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "-created_at"]

    def __str__(self):
        return f"{self.label} — {self.user}"


class EmailVerificationToken(models.Model):
    """Single-use, expiring token emailed to confirm a customer's address (§4.2)."""

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="email_verification_tokens")
    token = models.CharField(max_length=64, unique=True, default=_generate_token)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    DEFAULT_LIFETIME = timedelta(hours=24)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + self.DEFAULT_LIFETIME
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and timezone.now() < self.expires_at


class PasswordResetToken(models.Model):
    """
    Single-use, 30-minute token (§4.2 forgot-password flow). Requesting a
    reset never reveals whether the email exists — see accounts/views.py.
    """

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.CharField(max_length=64, unique=True, default=_generate_token)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    DEFAULT_LIFETIME = timedelta(minutes=30)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + self.DEFAULT_LIFETIME
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and timezone.now() < self.expires_at


# ---------------------------------------------------------------------------
# §8.1 hardening: opt-in TOTP two-factor for admin accounts (user-confirmed
# scope: optional, not mandatory; recovery codes included)
# ---------------------------------------------------------------------------

class AdminMFADevice(models.Model):
    """
    One row per admin who has set up 2FA. `is_enabled` stays False during
    setup — a device only "counts" (i.e. AdminLoginView starts requiring
    it) once the admin has proven they can actually generate valid codes
    by confirming one, same as every real TOTP setup flow (Google,
    GitHub, etc.) — otherwise a typo'd QR scan could permanently lock an
    admin out of their own account.
    """

    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="mfa_device")
    secret = models.CharField(max_length=32)
    is_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)


class MFARecoveryCode(models.Model):
    """
    Single-use recovery codes, hashed the same way passwords are (never
    stored or logged in plaintext) — shown to the admin exactly once, at
    generation time, same UX as GitHub/Google's recovery-code screens.
    """

    device = models.ForeignKey(AdminMFADevice, on_delete=models.CASCADE, related_name="recovery_codes")
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_used(self) -> bool:
        return self.used_at is not None
