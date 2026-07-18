"""
Phase 1 scope: the User model itself and its `role` field, which is the
single source of truth RBAC is built on (see permissions.py). Signup/login
flows, social auth, password reset, phone/CNIC validation, and profile
fields (§4.2–§4.4) are implemented in Phase 2 — this model already has the
fields they'll need so migrations don't churn later.
"""

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models

# PRD §4.2: Pakistani phone format, e.g. +923001234567 or 03001234567
pk_phone_validator = RegexValidator(
    regex=r"^(\+92|0)3\d{9}$",
    message="Enter a valid Pakistani phone number, e.g. 03001234567 or +923001234567.",
)


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
