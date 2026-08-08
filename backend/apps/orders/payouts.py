"""
§6.7/Phase 6+: vendor payout eligibility + batch generation.

Mirrors the "hold, then cycle" pattern every real marketplace uses —
Amazon holds funds ~7 days post-delivery before they're payout-eligible,
on a 14-day cycle; Etsy holds a reserve and lets sellers pick a
daily/weekly/biweekly/monthly deposit schedule. Duo Bro Mart doesn't have
a live bank/wallet transfer integration, so this produces the same
eligible-earnings-in-a-batch shape and leaves the actual transfer as an
admin action (Payout.mark_paid) — see models.Payout docstring.
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import Order, OrderItem, Payout, PayoutItem
from .notifications import maybe_send_payout_ready_alert


def eligible_order_items_for_vendor(vendor, as_of=None):
    """
    Delivered order items belonging to `vendor` that:
      - were delivered at least `vendor`'s effective payout_hold_days ago
        (their own override if set, else PlatformSettings.payout_hold_days), and
      - haven't already been claimed by an earlier Payout (OneToOne guard).
    """
    from apps.core.models import PlatformSettings

    as_of = as_of or timezone.now()
    hold_days = (
        vendor.payout_hold_days_override
        if vendor.payout_hold_days_override is not None
        else PlatformSettings.get_solo().payout_hold_days
    )
    cutoff = as_of - timedelta(days=hold_days)

    return (
        OrderItem.objects.filter(
            vendor=vendor,
            order__status=Order.Status.DELIVERED,
            order__delivered_at__lte=cutoff,
            payout_item__isnull=True,
        )
        .select_related("order")
        .order_by("order__delivered_at")
    )


def next_eligible_at_for_vendor(vendor):
    """When a vendor's next payout batch is allowed — their own payout_cycle_days_override if set, else PlatformSettings.payout_cycle_days. None if they've never been paid."""
    from apps.core.models import PlatformSettings

    last = Payout.objects.filter(vendor=vendor).order_by("-created_at").first()
    if not last:
        return None
    cycle_days = (
        vendor.payout_cycle_days_override
        if vendor.payout_cycle_days_override is not None
        else PlatformSettings.get_solo().payout_cycle_days
    )
    return last.created_at + timedelta(days=cycle_days)


def generate_payouts(vendor=None):
    """
    Creates one Payout per eligible vendor (or just the given one) covering
    every currently-eligible, not-yet-claimed order item — skipping any
    vendor still inside their payout_cycle_days cooldown from their last
    batch. Returns the list of newly created Payout rows (empty batches,
    i.e. nothing eligible, are never created).
    """
    created = _generate_payouts_atomic(vendor)
    if created:
        maybe_send_payout_ready_alert(created)
    return created


@transaction.atomic
def _generate_payouts_atomic(vendor=None):
    from django.contrib.auth import get_user_model

    UserModel = get_user_model()
    vendors = [vendor] if vendor else UserModel.objects.filter(role=UserModel.Role.VENDOR)

    now = timezone.now()
    created = []
    for v in vendors:
        next_eligible = next_eligible_at_for_vendor(v)
        if next_eligible and now < next_eligible:
            continue

        items = list(eligible_order_items_for_vendor(v, as_of=now))
        if not items:
            continue

        total = sum((i.net_to_vendor for i in items), Decimal("0.00"))
        delivered_dates = [i.order.delivered_at.date() for i in items]

        payout = Payout.objects.create(
            vendor=v,
            period_start=min(delivered_dates),
            period_end=max(delivered_dates),
            total_amount=total,
        )
        PayoutItem.objects.bulk_create(
            [PayoutItem(payout=payout, order_item=i, amount=i.net_to_vendor) for i in items]
        )
        created.append(payout)

    return created
