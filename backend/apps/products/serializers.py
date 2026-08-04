from django.utils import timezone
from rest_framework import serializers

from .models import Category, CommissionRate, Product, ProductChangeRequest, ProductImage, StockChangeRequest, Wishlist


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class CommissionRateSerializer(serializers.Serializer):
    """
    §6.6: one row per category — not a ModelSerializer since a category
    without a CommissionRate override yet still needs to show up (with
    the provisional fallback rate), which a plain ModelSerializer over
    CommissionRate.objects can't do on its own.
    """

    category_id = serializers.IntegerField()
    category_name = serializers.CharField()
    rate_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    is_custom = serializers.BooleanField(help_text="False = still using the provisional fallback rate.")


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "position"]
        read_only_fields = ["id"]


class PublicProductListSerializer(serializers.ModelSerializer):
    """
    Storefront catalog (Home/Shop) — approved+active products only (see
    PublicProductViewSet). average_rating/rating_count are real now
    (§7.3 Feedback) — None/0 until a product has its first delivered-order
    review, which the storefront should treat as "not yet rated", not "0 stars".
    """

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    vendor_name = serializers.SerializerMethodField()
    price = serializers.DecimalField(source="discounted_price", max_digits=10, decimal_places=2, read_only=True)
    original_price = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    average_rating = serializers.FloatField(read_only=True)
    rating_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "slug", "name", "brand", "category_name", "category_slug",
            "vendor", "vendor_name", "price", "original_price", "is_deal_active", "is_low_stock",
            "average_rating", "rating_count", "stock_quantity", "images",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username

    def get_original_price(self, obj):
        return obj.selling_price if obj.is_deal_active else None

    def get_images(self, obj):
        request = self.context.get("request")
        urls = [img.image.url for img in obj.images.all()]
        if request:
            return [request.build_absolute_uri(u) for u in urls]
        return urls


class PublicProductDetailSerializer(PublicProductListSerializer):
    """Adds description/attributes for the Product Detail page (vendor id
    is already on the base list serializer above, for storefront links)."""

    class Meta(PublicProductListSerializer.Meta):
        fields = PublicProductListSerializer.Meta.fields + ["description", "attributes"]
        read_only_fields = fields


class WishlistSerializer(serializers.ModelSerializer):
    product = PublicProductListSerializer(read_only=True)
    # A saved product can later be unapproved/deactivated/deleted by its
    # vendor or an admin — the wishlist row survives (only a hard delete
    # of the Product itself cascades), so the Wishlist page can tell the
    # customer "no longer available" instead of just silently 404ing.
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = Wishlist
        fields = ["id", "product", "is_available", "created_at"]
        read_only_fields = fields

    def get_is_available(self, obj):
        return obj.product.status == Product.Status.APPROVED and obj.product.is_active


class AdminPricingSerializer(serializers.ModelSerializer):
    """§6.6 Pricing Manager: read-only breakdown of sale price -> commission -> vendor receives, per product."""

    vendor_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    sale_price = serializers.DecimalField(source="selling_price", max_digits=10, decimal_places=2, read_only=True)
    commission_rate_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    commission_amount = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "vendor_name", "category_name", "sale_price", "commission_rate_percent",
            "commission_amount", "base_price", "stock_quantity", "status",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username

    def get_category_name(self, obj):
        # Unresolved "Other" category requests (§6.2) have no category yet.
        return obj.category.name if obj.category_id else f"Requested: {obj.requested_category_name}" if obj.requested_category_name else None

    def get_commission_amount(self, obj):
        return obj.selling_price - obj.base_price


class ProductCreateSerializer(serializers.ModelSerializer):
    """Vendor create/update — images are added separately via the
    upload_image action so a single multipart field per request stays
    simple (see views.py)."""

    class Meta:
        model = Product
        fields = [
            "id", "category", "requested_category_name", "name", "sku", "description", "brand",
            "base_price", "stock_quantity", "attributes", "is_active",
            "status", "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate_base_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

    def validate_stock_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative.")
        return value

    def validate(self, data):
        # A vendor picks either a fixed category, or (§6.2 "Other") types in
        # their own suggested category name for an admin to resolve later —
        # never both, never neither.
        category = data.get("category", getattr(self.instance, "category", None))
        requested_name = data.get("requested_category_name", getattr(self.instance, "requested_category_name", "")).strip()
        if category and requested_name:
            data["requested_category_name"] = ""
        elif not category and not requested_name:
            raise serializers.ValidationError({"category": "Select a category, or choose \"Other\" and enter your own."})
        elif requested_name:
            data["category"] = None
            data["requested_category_name"] = requested_name
        return data

    def create(self, validated_data):
        return Product.objects.create(vendor=self.context["request"].user, **validated_data)


class ProductSerializer(serializers.ModelSerializer):
    """Full detail — used by the vendor's own product list/detail and,
    later, the admin review queue (§7.2)."""

    vendor_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    has_category_mismatch = serializers.BooleanField(read_only=True)
    selling_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    discounted_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_deal_active = serializers.BooleanField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "vendor", "vendor_name", "category", "category_name", "requested_category_name",
            "has_category_mismatch", "name", "slug", "sku",
            "description", "brand", "base_price", "selling_price", "discounted_price",
            "active_discount_percent", "deal_starts_at", "deal_ends_at", "is_deal_active", "is_low_stock",
            "bogo_eligible", "gift_card_eligible", "stock_quantity", "is_active",
            "attributes", "status", "admin_notes", "images",
            "created_at", "updated_at", "submitted_at", "decided_at",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username

    def get_category_name(self, obj):
        return obj.category.name if obj.category_id else None


class AdminProductUpdateSerializer(serializers.ModelSerializer):
    """
    §6.2: admin can edit a product's catalog data directly (separate from
    the approve/reject decision itself, which stays on the approve/reject
    actions so decided_at/admin_notes bookkeeping isn't bypassed). Vendor,
    slug, and status are intentionally left out — status only changes via
    approve/reject, vendor/slug never change once created.
    """

    class Meta:
        model = Product
        fields = [
            "id", "category", "name", "sku", "description", "brand",
            "base_price", "stock_quantity", "attributes", "is_active",
        ]
        read_only_fields = ["id"]

    def validate(self, data):
        # Assigning a real category here (e.g. from the Edit form) resolves
        # any pending "Other" request just as cleanly as the dedicated
        # resolve-category flow (see AdminProductViewSet.approve()).
        if data.get("category"):
            self.instance.requested_category_name = ""
        return data

    def validate_base_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

    def validate_stock_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative.")
        return value


class ProductChangeRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductChangeRequest
        fields = [
            "id", "product", "change_type", "new_price", "discount_percent",
            "deal_starts_at", "deal_ends_at", "note", "status", "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, data):
        change_type = data.get("change_type")
        if change_type == ProductChangeRequest.ChangeType.PRICE_CHANGE and not data.get("new_price"):
            raise serializers.ValidationError({"new_price": "Required for a price change request."})
        if change_type in (ProductChangeRequest.ChangeType.DISCOUNT, ProductChangeRequest.ChangeType.FLASH_DEAL) and not data.get("discount_percent"):
            raise serializers.ValidationError({"discount_percent": "Required for discount/flash deal requests."})
        if data.get("discount_percent") is not None and not (0 < data["discount_percent"] <= 90):
            raise serializers.ValidationError({"discount_percent": "Must be between 0 and 90."})
        return data

    def validate_product(self, product):
        request_user = self.context["request"].user
        if product.vendor_id != request_user.id:
            raise serializers.ValidationError("You can only request changes on your own products.")
        return product

    def create(self, validated_data):
        return ProductChangeRequest.objects.create(vendor=self.context["request"].user, **validated_data)


class ProductChangeRequestSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    vendor_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductChangeRequest
        fields = [
            "id", "product", "product_name", "vendor", "vendor_name", "change_type",
            "new_price", "discount_percent", "deal_starts_at", "deal_ends_at", "note",
            "status", "admin_notes", "created_at", "decided_at",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username


class StockChangeRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockChangeRequest
        fields = ["id", "product", "requested_increase", "note", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_requested_increase(self, value):
        if value < 1:
            raise serializers.ValidationError("Must request at least 1 additional unit.")
        return value

    def validate_product(self, product):
        request_user = self.context["request"].user
        if product.vendor_id != request_user.id:
            raise serializers.ValidationError("You can only request a restock on your own products.")
        return product

    def create(self, validated_data):
        return StockChangeRequest.objects.create(vendor=self.context["request"].user, **validated_data)


class StockChangeRequestSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    vendor_name = serializers.SerializerMethodField()

    class Meta:
        model = StockChangeRequest
        fields = [
            "id", "product", "product_name", "vendor", "vendor_name",
            "requested_increase", "note", "status", "admin_notes", "created_at", "decided_at",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username
