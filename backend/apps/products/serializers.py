from django.utils import timezone
from rest_framework import serializers

from .models import Category, Product, ProductChangeRequest, ProductImage, StockChangeRequest


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "position"]
        read_only_fields = ["id"]


class ProductCreateSerializer(serializers.ModelSerializer):
    """Vendor create/update — images are added separately via the
    upload_image action so a single multipart field per request stays
    simple (see views.py)."""

    class Meta:
        model = Product
        fields = [
            "id", "category", "name", "description", "brand",
            "base_price", "stock_quantity", "attributes",
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

    def create(self, validated_data):
        return Product.objects.create(vendor=self.context["request"].user, **validated_data)


class ProductSerializer(serializers.ModelSerializer):
    """Full detail — used by the vendor's own product list/detail and,
    later, the admin review queue (§7.2)."""

    vendor_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    selling_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    discounted_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_deal_active = serializers.BooleanField(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "vendor", "vendor_name", "category", "category_name", "name", "slug",
            "description", "brand", "base_price", "selling_price", "discounted_price",
            "active_discount_percent", "deal_starts_at", "deal_ends_at", "is_deal_active",
            "bogo_eligible", "gift_card_eligible", "stock_quantity",
            "attributes", "status", "admin_notes", "images",
            "created_at", "updated_at", "submitted_at", "decided_at",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username


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
