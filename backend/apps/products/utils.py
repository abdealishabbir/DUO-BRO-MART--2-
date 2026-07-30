"""§7.2: low-stock admin alert — the first real trigger for one of the
notification toggles Admin Settings (§6.7) introduced but didn't wire up
at the time."""

from django.conf import settings
from django.core.mail import send_mail


def maybe_send_low_stock_alert(product, stock_before: int) -> None:
    """
    Fires exactly once as a product *crosses into* low stock (not on
    every subsequent order while it stays low, and not if it was already
    low before this decrement) — otherwise a slow trickle of orders on an
    already-low-stock item would spam the same alert repeatedly.
    """
    from .models import LOW_STOCK_THRESHOLD

    from apps.core.models import PlatformSettings

    was_already_low = 0 < stock_before <= LOW_STOCK_THRESHOLD
    if was_already_low or not product.is_low_stock:
        return

    if not PlatformSettings.get_solo().notify_low_stock:
        return

    send_mail(
        subject=f"Low stock: {product.name}",
        message=(
            f"{product.name} (SKU {product.sku or '—'}, vendor: {product.vendor.email}) "
            f"has dropped to {product.stock_quantity} unit(s) remaining."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[PlatformSettings.get_solo().store_email],
        fail_silently=True,  # a missed alert email should never fail the customer's checkout
    )
