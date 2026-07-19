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
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

from .managers import UserManager

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
