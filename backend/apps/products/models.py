"""
Product catalog + vendor request subsystem (PRD §6.2-§6.5).

Business rules implemented here:
  - A vendor creates a Product against the platform's fixed Category
    taxonomy (mandatory — feeds storefront placement and the Shop filter)
    with a mandatory brand name (also mandatory — feeds the Brand filter,
    §6.4). New products start life as DRAFT, the vendor submits them for
    review (PENDING), and an admin APPROVES (goes live, appears in New
    Arrivals + its category) or REJECTS (returned with a reason).
  - Every subsequent discount/deal/price change a vendor wants is *not*
    applied directly to the Product — it's filed as a ProductChangeRequest
    and only takes effect once an admin approves it (§6.3). This mirrors
    the Product approval pattern rather than introducing a new one.
  - Stock **decrements** automatically and atomically at order time
    (apps.orders.serializers.OrderCreateSerializer — real Order backend,
    Phase 6). Stock **increases** always go through a StockChangeRequest
    an admin must approve first, so a vendor can't fake availability (§6.5).
  - Selling price shown to customers is the vendor's base_price plus
    platform commission. The commission rate is admin-editable per
    category via CommissionRate (§6.6); a category with no override yet
    falls back to PROVISIONAL_COMMISSION_RATE below.
  - §7.2: a product at or below LOW_STOCK_THRESHOLD units is "low stock"
    — the storefront shows scarcity messaging ("Only N left") instead of
    a generic in-stock badge, and crossing the threshold triggers a
    low-stock admin email (apps.orders.serializers, gated on
    PlatformSettings.notify_low_stock — see §6.7).
"""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

# Provisional flat platform commission until a category gets its own
# CommissionRate row (§6.6) — see Product.commission_rate_percent.
PROVISIONAL_COMMISSION_RATE = Decimal("0.10")

# §7.2: at or below this many units, a product is "low stock" — drives
# storefront scarcity messaging and the low-stock admin alert.
LOW_STOCK_THRESHOLD = 5


class Category(models.Model):
    """
    Fixed platform taxonomy a vendor must choose from (§6.2) — not
    vendor-creatable. Admin-managed (see ReadOnlyOrIsAdmin in views.py);
    public read access powers the Shop page category filter.
    """

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class CommissionRate(models.Model):
    """
    §6.6: admin-editable per-category commission, replacing the flat
    PROVISIONAL_COMMISSION_RATE. A category with no CommissionRate row
    yet falls back to that provisional rate (see
    Product.commission_rate_percent) — so nothing breaks for a category
    the admin hasn't explicitly configured.
    """

    category = models.OneToOneField(Category, on_delete=models.CASCADE, related_name="commission_rate")
    rate_percent = models.DecimalField(max_digits=5, decimal_places=2, help_text="e.g. 10.00 for 10%.")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.category.name}: {self.rate_percent}%"


class Product(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    sku = models.CharField(max_length=50, blank=True, help_text="Vendor's own inventory reference code (optional).")
    description = models.TextField()
    brand = models.CharField(max_length=100, help_text="Feeds the Shop page Brand filter (§6.4).")

    base_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Vendor's own price, before platform commission.")
    stock_quantity = models.PositiveIntegerField(default=0)

    # Lets a vendor pause an already-approved listing (hide it from the
    # storefront) without losing its approval — re-enabling doesn't need
    # another admin review, unlike status changes.
    is_active = models.BooleanField(default=True)

    # Free-form specs (size, color, model, etc.) — shape varies by category
    # so a fixed schema would fight the "any product type" requirement.
    attributes = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    admin_notes = models.TextField(blank=True, help_text="Rejection reason or review notes, shown to the vendor.")

    # Populated only once an admin *approves* a ProductChangeRequest
    # (§6.3) — these never change from a vendor action directly.
    active_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    deal_starts_at = models.DateTimeField(null=True, blank=True)
    deal_ends_at = models.DateTimeField(null=True, blank=True)
    bogo_eligible = models.BooleanField(default=False)
    gift_card_eligible = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)[:200]
            slug = base_slug
            n = 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base_slug}-{n}"
            self.slug = slug

        # §7.1: broadcast to any connected client whenever stock actually
        # changes — catches every path (order decrement, restock approval,
        # admin edit) from one place instead of repeating this at each call site.
        old_stock = None
        if self.pk:
            old_stock = Product.objects.filter(pk=self.pk).values_list("stock_quantity", flat=True).first()

        super().save(*args, **kwargs)

        if old_stock is not None and old_stock != self.stock_quantity:
            from .realtime import broadcast_stock_update

            broadcast_stock_update(self)

    def __str__(self):
        return f"{self.name} ({self.vendor})"

    @property
    def commission_rate_percent(self):
        """§6.6: this category's admin-set rate, or the provisional flat rate if none has been set yet."""
        try:
            return self.category.commission_rate.rate_percent
        except CommissionRate.DoesNotExist:
            return PROVISIONAL_COMMISSION_RATE * Decimal("100")

    @property
    def selling_price(self):
        """Vendor base price + this category's platform commission rate (§6.6)."""
        rate = self.commission_rate_percent / Decimal("100")
        return (self.base_price * (Decimal("1.00") + rate)).quantize(Decimal("0.01"))

    @property
    def is_deal_active(self):
        if self.active_discount_percent is None:
            return False
        if self.deal_starts_at and self.deal_ends_at:
            now = timezone.now()
            return self.deal_starts_at <= now <= self.deal_ends_at
        return True  # a permanent (non-time-boxed) discount

    @property
    def is_low_stock(self):
        """§7.2: in stock but scarce enough to warrant scarcity messaging — not the same as out of stock."""
        return 0 < self.stock_quantity <= LOW_STOCK_THRESHOLD

    @property
    def average_rating(self):
        """§7.3: real customer rating — average quality_rating from Feedback on orders that included this product. None until the first review."""
        from django.db.models import Avg

        from apps.feedback.models import Feedback

        result = Feedback.objects.filter(order__items__product=self).aggregate(avg=Avg("quality_rating"))["avg"]
        return round(result, 1) if result is not None else None

    @property
    def rating_count(self):
        from apps.feedback.models import Feedback

        return Feedback.objects.filter(order__items__product=self).count()

    @property
    def discounted_price(self):
        """selling_price after active_discount_percent, only while the deal window (if any) is active."""
        if not self.is_deal_active:
            return self.selling_price
        discount_multiplier = Decimal("1.00") - (self.active_discount_percent / Decimal("100"))
        return (self.selling_price * discount_multiplier).quantize(Decimal("0.01"))

    def submit_for_review(self):
        self.status = self.Status.PENDING
        self.submitted_at = timezone.now()
        self.save(update_fields=["status", "submitted_at"])


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/%Y/%m/")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"Image #{self.position} for {self.product.name}"


class ProductChangeRequest(models.Model):
    """
    §6.3: any discount %, deal type, or price change a vendor wants is
    filed here and only reflects on the Product once an admin approves
    it — the Product's own fields never change until then.
    """

    class ChangeType(models.TextChoices):
        DISCOUNT = "discount", "Discount %"
        PRICE_CHANGE = "price_change", "Price Change"
        FLASH_DEAL = "flash_deal", "Flash Deal"
        BOGO = "bogo", "Buy One Get One"
        GIFT_CARD_ELIGIBLE = "gift_card_eligible", "Gift-Card Eligible"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="change_requests")
    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="product_change_requests")
    change_type = models.CharField(max_length=30, choices=ChangeType.choices)

    new_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Used for PRICE_CHANGE requests.")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Used for DISCOUNT/FLASH_DEAL requests.")
    deal_starts_at = models.DateTimeField(null=True, blank=True)
    deal_ends_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, help_text="Vendor's own note/context for the admin reviewing this.")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_change_type_display()} request for {self.product.name}"


class StockChangeRequest(models.Model):
    """
    §6.5: stock **increases** (restocks) always need admin approval, so a
    vendor can't fake availability. Decrements happen automatically at
    order time elsewhere and never go through this model.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_requests")
    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="stock_change_requests")
    requested_increase = models.PositiveIntegerField()
    note = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"+{self.requested_increase} stock request for {self.product.name}"
