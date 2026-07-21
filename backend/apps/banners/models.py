"""
Banner/Promotion subsystem (user-directed addition, layered on top of the
PRD's existing Banner/BannerApplication schema entries — see §10.3).

Business rules implemented here (confirmed with the user):
  - Vendor applies for a hero-carousel slot: image, headline, description,
    CTA, number of days, prepaid or postpaid.
  - Admin sets the platform-wide price/day and the carousel slot limit
    (PlatformSettings, singleton) — changes apply immediately to whatever
    vendors see next, since price/slot checks always read this live.
  - Admin approves/rejects applications, then "publishes" an approved one
    into a live Banner (may re-attach the vendor's own asset details).
  - PREPAID: vendor must pay the full amount before the banner goes live.
    If unpaid 3 days after approval, the reservation auto-cancels and the
    slot frees up (see management/commands/process_banner_billing.py).
  - POSTPAID: banner goes live the day after approval and runs for the
    requested number of days. Payment is due by the last live day. If
    still unpaid the day after (day N+1), a Rs.100/day penalty starts
    accruing for up to 3 days; on the 3rd unpaid day the vendor account
    is auto-suspended (login blocked) and the admin is notified.
  - If a slot is full, a vendor can request a future date once a slot is
    scheduled to free up (see availability check in views.py).

Real-time display: the customer-facing carousel and the paid/penalty/
remaining figures shown to vendors and admins are computed live from
dates on every request (see properties below) rather than depending on
the daily management command — the command only performs the persisted,
one-time state transitions (auto-cancel, auto-suspend) that can't be
"just" a live computation.
"""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

PENALTY_PER_DAY = Decimal("100.00")
MAX_PENALTY_DAYS = 3  # after this many unpaid days past due, vendor is suspended
PREPAID_GRACE_DAYS = 3  # unpaid prepaid reservations auto-cancel after this many days


class PlatformSettings(models.Model):
    """Singleton row (always pk=1). Admin-editable, read live by every
    vendor-facing price/slot check — see get_solo()."""

    banner_price_per_day = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("200.00"))
    carousel_slot_limit = models.PositiveSmallIntegerField(default=5)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Platform settings"
        verbose_name_plural = "Platform settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass  # singleton — never actually delete

    @classmethod
    def get_solo(cls) -> "PlatformSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Platform settings"


def banner_upload_path(instance, filename):
    return f"banners/{instance.vendor_id}/{filename}"


class BannerApplication(models.Model):
    class PaymentType(models.TextChoices):
        PREPAID = "prepaid", "Prepaid"
        POSTPAID = "postpaid", "Postpaid"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"  # e.g. unpaid prepaid past grace period

    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="banner_applications")

    image = models.ImageField(upload_to=banner_upload_path)
    headline = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    cta_label = models.CharField(max_length=40, default="Shop Now")
    cta_url = models.CharField(max_length=300)

    requested_days = models.PositiveSmallIntegerField()
    payment_type = models.CharField(max_length=10, choices=PaymentType.choices)

    # Snapshot at submission time so later admin price changes don't retroactively
    # change what a vendor already agreed to pay.
    price_per_day_snapshot = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    # Null = "as soon as a slot is free"; set = vendor picked a future date
    # because all slots were full at submission time (§ requested behavior).
    requested_start_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.vendor} — {self.headline} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.total_price:
            self.total_price = self.price_per_day_snapshot * self.requested_days
        super().save(*args, **kwargs)


class Banner(models.Model):
    class Status(models.TextChoices):
        AWAITING_PAYMENT = "awaiting_payment", "Awaiting prepayment"  # prepaid, approved, not yet paid/live
        SCHEDULED = "scheduled", "Scheduled"
        LIVE = "live", "Live"
        COMPLETED = "completed", "Completed"  # ran its course, fully settled
        OVERDUE = "overdue", "Overdue"  # postpaid, ran its course, still unpaid
        SUSPENDED = "suspended", "Suspended"  # vendor account suspended over nonpayment
        CANCELLED = "cancelled", "Cancelled"  # prepaid, never paid, grace period lapsed

    application = models.OneToOneField(BannerApplication, on_delete=models.CASCADE, related_name="banner")
    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="banners")

    # Copied from the application at publish time; admin can edit before publishing.
    image = models.ImageField(upload_to=banner_upload_path)
    headline = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    cta_label = models.CharField(max_length=40)
    cta_url = models.CharField(max_length=300)

    slot_position = models.PositiveSmallIntegerField()
    payment_type = models.CharField(max_length=10, choices=BannerApplication.PaymentType.choices)
    price_per_day = models.DecimalField(max_digits=10, decimal_places=2)
    days = models.PositiveSmallIntegerField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)

    live_start_date = models.DateField(null=True, blank=True)
    live_end_date = models.DateField(null=True, blank=True)

    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    penalty_days_elapsed = models.PositiveSmallIntegerField(default=0)  # 0..MAX_PENALTY_DAYS, persisted by the daily job

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["slot_position"]

    def __str__(self):
        return f"Banner #{self.pk} — {self.headline} ({self.status})"

    # --- Real-time computed figures (never depend on the daily job having run) ---

    @property
    def is_past_due(self) -> bool:
        return bool(self.live_end_date) and timezone.localdate() > self.live_end_date

    @property
    def days_overdue(self) -> int:
        if not self.is_past_due or self.payment_type != BannerApplication.PaymentType.POSTPAID:
            return 0
        if self.paid_amount >= self.total_price:
            return 0
        return min((timezone.localdate() - self.live_end_date).days, MAX_PENALTY_DAYS)

    @property
    def penalty_amount(self) -> Decimal:
        if self.payment_type == BannerApplication.PaymentType.PREPAID:
            return Decimal("0.00")
        return PENALTY_PER_DAY * self.days_overdue

    @property
    def remaining_amount(self) -> Decimal:
        remaining = (self.total_price + self.penalty_amount) - self.paid_amount
        return remaining if remaining > 0 else Decimal("0.00")

    @property
    def is_currently_visible(self) -> bool:
        """What the public carousel query also expresses — kept as a property too for reuse/tests."""
        today = timezone.localdate()
        return (
            self.status == self.Status.LIVE
            and self.live_start_date is not None
            and self.live_start_date <= today <= self.live_end_date
        )


class BannerPayment(models.Model):
    """
    Manual payment ledger entry. No payment gateway exists yet (that's
    Phase 4) — for now, an admin records a payment (e.g. after confirming
    a bank transfer) and it's reflected immediately in paid_amount.
    """

    banner = models.ForeignKey(Banner, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="banner_payments_recorded"
    )
    paid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_at"]

    def __str__(self):
        return f"Rs.{self.amount} for Banner #{self.banner_id}"
