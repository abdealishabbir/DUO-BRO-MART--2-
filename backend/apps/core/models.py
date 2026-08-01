"""
§6.7 Admin Settings: platform-wide configuration. A few of these fields
have real, wired-up effects (see module notes below); others are
genuine settings toggles with no automated trigger behind them yet —
called out explicitly rather than silently doing nothing:

  - free_shipping_threshold: wired — apps.orders.serializers.OrderCreateSerializer
    zeroes out shipping_fee when subtotal >= this value, on top of
    whatever the chosen delivery method would otherwise cost.
  - cod_enabled/card_enabled/jazzcash_enabled/easypaisa_enabled: wired —
    OrderCreateSerializer rejects a checkout using a disabled method.
  - payout_hold_days / payout_cycle_days: wired — apps.orders.payouts
    (Phase 6+ vendor payout ledger). Mirrors the hold-then-cycle pattern
    every real marketplace uses (Amazon: 7-day post-delivery hold + 14-day
    cycle; Etsy: reserve + weekly/biweekly/monthly deposit choice) —
    delivered order items only become payout-eligible payout_hold_days
    after delivery (covers the return/complaint window), and
    "Generate Payouts" batches everything eligible since a vendor's last
    payout, at most once per payout_cycle_days.
  - notify_new_orders / notify_new_vendor_applications / notify_low_stock
    / notify_payout_requests: NOT wired to any actual email trigger yet.
    There's no admin-notification-email subsystem built at all currently
    (only customer/vendor-facing emails like vendor credentials and
    password reset exist) — these toggles are stored and editable here
    so the Settings page is complete and future work has somewhere to
    read the flag from, but flipping them today sends nothing. That
    belongs with Phase 7's real-time/notification work.
"""

from django.db import models


class PlatformSettings(models.Model):
    """Singleton row (always pk=1) — same pattern as apps.banners.models.PlatformSettings."""

    class HandlingTime(models.TextChoices):
        SAME_DAY = "same_day", "Same Day"
        ONE_TO_TWO_DAYS = "1_2_days", "1-2 Business Days"
        THREE_TO_FIVE_DAYS = "3_5_days", "3-5 Business Days"

    # General
    store_name = models.CharField(max_length=100, default="Duo Bro Mart")
    store_email = models.EmailField(default="hello@duobromart.pk")
    currency = models.CharField(max_length=10, default="PKR")

    # Shipping
    default_shipping_rate = models.DecimalField(max_digits=10, decimal_places=2, default=250)
    free_shipping_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=5000)
    handling_time = models.CharField(max_length=20, choices=HandlingTime.choices, default=HandlingTime.ONE_TO_TWO_DAYS)

    # Payment gateways
    cod_enabled = models.BooleanField(default=True)
    card_enabled = models.BooleanField(default=False)
    jazzcash_enabled = models.BooleanField(default=False)
    easypaisa_enabled = models.BooleanField(default=False)

    # Vendor payouts (§6.7 / Phase 6+ — see module docstring)
    payout_hold_days = models.PositiveSmallIntegerField(
        default=3, help_text="Days after delivery before a vendor's earnings on that order become payout-eligible.",
    )
    payout_cycle_days = models.PositiveSmallIntegerField(
        default=7, help_text="Minimum days between payout batches for the same vendor.",
    )

    # Email notifications (see module docstring — not all wired to real triggers yet)
    notify_new_orders = models.BooleanField(default=True)
    notify_new_vendor_applications = models.BooleanField(default=True)
    notify_low_stock = models.BooleanField(default=True)
    notify_payout_requests = models.BooleanField(default=True)

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
