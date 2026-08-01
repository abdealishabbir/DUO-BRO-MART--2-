"""§6.7/§7.7 admin notification toggle for new orders — same pattern as
apps.products.utils.maybe_send_low_stock_alert and
apps.accounts.utils.maybe_send_new_vendor_application_alert."""

from django.conf import settings
from django.core.mail import send_mail


def maybe_send_new_order_alert(order) -> None:
    from apps.core.models import PlatformSettings

    settings_row = PlatformSettings.get_solo()
    if not settings_row.notify_new_orders:
        return

    send_mail(
        subject=f"New order: {order.order_code}",
        message=(
            f"Order {order.order_code} was just placed by {order.shipping_full_name} "
            f"({order.shipping_phone_number}).\n\n"
            f"Total: Rs. {order.total} — Payment: {order.get_payment_method_display()}\n"
            f"Delivery: {order.shipping_city}, {order.shipping_province}"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings_row.store_email],
        fail_silently=True,  # a missed alert email should never fail the customer's checkout
    )


def maybe_send_payout_ready_alert(payouts) -> None:
    """
    Fires once per generate_payouts() run, not once per batch — a single
    admin action can legitimately produce dozens of eligible vendor
    batches at once, and one email listing all of them beats a burst of
    near-identical ones. "Payout Requests" (the Admin Settings label,
    §7.7) really means "payout batches ready for you to review and pay",
    since vendors don't request these — they're generated automatically.
    """
    from apps.core.models import PlatformSettings

    settings_row = PlatformSettings.get_solo()
    if not settings_row.notify_payout_requests:
        return

    lines = [
        f"  - {(f'{p.vendor.first_name} {p.vendor.last_name}'.strip() or p.vendor.username)}"
        f": Rs. {p.total_amount} ({p.period_start} → {p.period_end})"
        for p in payouts
    ]
    send_mail(
        subject=f"{len(payouts)} payout batch{'es' if len(payouts) != 1 else ''} ready for review",
        message=(
            f"{len(payouts)} new vendor payout batch{'es were' if len(payouts) != 1 else ' was'} "
            "just generated and are awaiting manual transfer + Mark Paid:\n\n" + "\n".join(lines) +
            "\n\nReview them in the admin Payouts panel."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings_row.store_email],
        fail_silently=True,
    )
