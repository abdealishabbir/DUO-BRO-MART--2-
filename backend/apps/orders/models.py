"""
Real Order/OrderItem backend (PRD §4.6, §10.3), replacing Phase 4's
mock/localStorage checkout system.

Design notes:
  - The shipping (and optional billing) address is snapshotted directly
    onto the Order as plain fields rather than a FK to accounts.Address.
    An Order must survive a customer editing/deleting their saved
    address later, and guest checkout has no Address row to point to
    at all — so a snapshot is the only option that works for both.
  - order_code is the customer-facing id ("DBM-<year>-<seq>"), generated
    per calendar year (§10.3 ERD: 'DBM-YYYY-XXXXXX').
  - OrderItem.product uses on_delete=SET_NULL (not CASCADE): admin
    product deletion (§6.2) must never destroy order history. The
    product's name/price are also snapshotted onto the line item so a
    receipt still renders correctly even after the product is gone.
  - Stock decrements happen at order-creation time in the view (atomic,
    inside the same transaction as OrderItem creation) — this is the
    "real-time" decrement the products app's docstring already
    anticipated (see apps/products/models.py).
  - Guest checkout is allowed (customer nullable) since TrackOrder
    supports looking an order up by order_code + contact info without
    being logged in.
"""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.accounts.models import Address

# Mirrors frontend/src/pages/customer/CheckoutShipping.jsx DELIVERY_METHODS
# and frontend/src/lib/currency.js DEFAULT_SHIPPING_RATE — kept as one
# constant map so it's a one-line change if pricing changes, same pattern
# as products.models.PROVISIONAL_COMMISSION_RATE.
DELIVERY_FEES = {
    "standard": Decimal("250.00"),
    "express": Decimal("450.00"),
    "urgent": Decimal("800.00"),
}
DELIVERY_ESTIMATE_DAYS = {
    "standard": 7,
    "express": 4,
    "urgent": 2,
}


def _generate_order_code():
    year = timezone.now().year
    count_this_year = Order.objects.filter(created_at__year=year).count() + 1
    return f"DBM-{year}-{count_this_year:04d}"


class Coupon(models.Model):
    """§8.3: simple admin-managed discount codes, applied once per order at checkout."""

    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percent Off"
        FIXED = "fixed", "Fixed Amount Off"

    code = models.CharField(max_length=30, unique=True)
    discount_type = models.CharField(max_length=10, choices=DiscountType.choices)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="e.g. 10 for 10% or Rs. 10 fixed off, depending on discount_type.")
    min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(null=True, blank=True, help_text="Blank = unlimited.")
    used_count = models.PositiveIntegerField(default=0)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code

    def is_valid_for(self, subtotal):
        now = timezone.now()
        if not self.is_active:
            return False, "This coupon is no longer active."
        if self.valid_from and now < self.valid_from:
            return False, "This coupon isn't active yet."
        if self.valid_until and now > self.valid_until:
            return False, "This coupon has expired."
        if self.max_uses is not None and self.used_count >= self.max_uses:
            return False, "This coupon has reached its usage limit."
        if subtotal < self.min_order_value:
            return False, f"This coupon requires a minimum order of Rs. {self.min_order_value}."
        return True, ""

    def discount_amount(self, subtotal):
        if self.discount_type == self.DiscountType.PERCENT:
            return (subtotal * self.discount_value / Decimal("100")).quantize(Decimal("0.01"))
        return min(self.discount_value, subtotal)


class Order(models.Model):
    class DeliveryMethod(models.TextChoices):
        STANDARD = "standard", "Standard"
        EXPRESS = "express", "Express"
        URGENT = "urgent", "Urgent"

    class PaymentMethod(models.TextChoices):
        COD = "cod", "Cash on Delivery"
        CARD = "card", "Credit/Debit Card"
        WALLET = "wallet", "Mobile Wallet"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    order_code = models.CharField(max_length=20, unique=True, editable=False)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders",
        help_text="Null for a guest checkout.",
    )

    # --- Shipping address snapshot (see module docstring) ---
    shipping_full_name = models.CharField(max_length=150)
    shipping_phone_number = models.CharField(max_length=17)
    shipping_email = models.EmailField()
    shipping_province = models.CharField(max_length=30, choices=Address.PROVINCE_CHOICES)
    shipping_city = models.CharField(max_length=100)
    shipping_address_line = models.CharField(max_length=255)
    shipping_is_rural = models.BooleanField(default=False)
    shipping_landmark = models.CharField(max_length=255, blank=True)

    # --- Billing address snapshot (only populated if different from shipping) ---
    billing_same_as_shipping = models.BooleanField(default=True)
    billing_full_name = models.CharField(max_length=150, blank=True)
    billing_phone_number = models.CharField(max_length=17, blank=True)
    billing_province = models.CharField(max_length=30, choices=Address.PROVINCE_CHOICES, blank=True)
    billing_city = models.CharField(max_length=100, blank=True)
    billing_address_line = models.CharField(max_length=255, blank=True)

    delivery_method = models.CharField(max_length=20, choices=DeliveryMethod.choices, default=DeliveryMethod.STANDARD)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.COD)
    wallet_provider = models.CharField(max_length=30, blank=True, help_text="NayaPay/Easypaisa/JazzCash — only for payment_method=wallet.")
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True, help_text="Internal note, e.g. reason for cancellation.")
    courier_name = models.CharField(max_length=100, blank=True)

    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    estimated_delivery_days = models.PositiveSmallIntegerField(default=7)
    delivered_at = models.DateTimeField(null=True, blank=True, help_text="Stamped automatically when status becomes 'delivered' (§7.3 return-window countdown).")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.order_code:
            self.order_code = _generate_order_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_code

    @property
    def is_rural_collection(self):
        return self.shipping_is_rural


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    # SET_NULL, not CASCADE — see module docstring. Snapshots below keep
    # the line item fully renderable even if the product is later removed.
    product = models.ForeignKey("products.Product", on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items")
    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sold_order_items")

    product_name = models.CharField(max_length=200)
    product_slug = models.SlugField(max_length=220)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price actually charged per unit at order time.")
    unit_base_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00"),
        help_text="Vendor's base_price at order time — lets commission/net-to-vendor (§6.4/§6.6) stay correct even after the product's price changes or the product itself is deleted.",
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} x {self.product_name} ({self.order.order_code})"

    @property
    def line_total(self):
        return (self.unit_price * self.quantity).quantize(Decimal("0.01"))

    @property
    def net_to_vendor(self):
        """What the vendor actually receives — their base_price snapshot × quantity, regardless of any discount applied to the customer-facing price."""
        return (self.unit_base_price * self.quantity).quantize(Decimal("0.01"))

    @property
    def commission_amount(self):
        """Platform's cut — sale price minus what goes to the vendor. Reflects whatever per-category commission rate (§6.6, apps/products/models.CommissionRate) was in effect at order time, since unit_price is snapshotted from Product.discounted_price."""
        return (self.line_total - self.net_to_vendor).quantize(Decimal("0.01"))


class Payout(models.Model):
    """
    §6.7/Phase 6+ vendor payout ledger — replaces the old "Payouts" page
    placeholder. There's no live bank/wallet transfer integration (no
    NayaPay/Easypaisa payout API is wired up), so this mirrors how every
    real marketplace actually works day-to-day even *with* that
    integration: earnings accrue, get batched into a payout covering a
    period, and an admin (or the automated transfer, once that exists)
    marks it paid — see apps.orders.payouts.generate_payouts_for_vendor()
    for the eligibility rules (hold period + cycle spacing, same shape as
    Amazon's 7-day hold/14-day cycle or Etsy's reserve+deposit schedule).
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        PAID = "paid", "Paid"

    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payouts")
    period_start = models.DateField()
    period_end = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reference = models.CharField(max_length=100, blank=True, help_text="Bank/wallet transaction reference, entered by the admin when marking this paid.")
    admin_notes = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payout #{self.id} — {self.vendor} — Rs. {self.total_amount} ({self.status})"


class PayoutItem(models.Model):
    """One delivered order line folded into a payout batch. OneToOne on
    order_item is the double-payment guard — once an item is claimed by a
    Payout, generate_payouts_for_vendor() will never pick it up again,
    even across separate batches."""

    payout = models.ForeignKey(Payout, on_delete=models.CASCADE, related_name="items")
    order_item = models.OneToOneField(OrderItem, on_delete=models.CASCADE, related_name="payout_item")
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Snapshot of order_item.net_to_vendor at batch-generation time.")

    def __str__(self):
        return f"Rs. {self.amount} from {self.order_item}"
