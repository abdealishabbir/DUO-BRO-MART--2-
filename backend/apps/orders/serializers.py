from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.products.models import Product

from .models import DELIVERY_ESTIMATE_DAYS, DELIVERY_FEES, Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "product_slug", "quantity", "unit_price", "line_total", "image"]
        read_only_fields = fields

    def get_image(self, obj):
        if not obj.product:
            return None
        first_image = obj.product.images.first()
        if not first_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(first_image.image.url) if request else first_image.image.url


class OrderItemInputSerializer(serializers.Serializer):
    """One cart line as sent by the client at checkout."""

    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class OrderSerializer(serializers.ModelSerializer):
    """Full order detail — customer history, tracking, vendor/admin views."""

    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_code", "status", "payment_status", "payment_method", "wallet_provider",
            "delivery_method", "courier_name", "admin_notes",
            "shipping_full_name", "shipping_phone_number", "shipping_email", "shipping_province",
            "shipping_city", "shipping_address_line", "shipping_is_rural", "shipping_landmark",
            "billing_same_as_shipping", "billing_full_name", "billing_phone_number",
            "billing_province", "billing_city", "billing_address_line",
            "subtotal", "shipping_fee", "total", "estimated_delivery_days",
            "items", "created_at", "updated_at",
        ]
        read_only_fields = fields


class OrderCreateSerializer(serializers.Serializer):
    """
    §4.6: creates the order, decrements stock, snapshots the shipping/
    billing address and each line's price — all inside one transaction
    so a mid-way failure (e.g. insufficient stock on item 3) leaves
    nothing half-created.
    """

    items = OrderItemInputSerializer(many=True)

    shipping_full_name = serializers.CharField(max_length=150)
    shipping_phone_number = serializers.CharField(max_length=17)
    shipping_email = serializers.EmailField()
    shipping_province = serializers.ChoiceField(choices=Order.shipping_province.field.choices)
    shipping_city = serializers.CharField(max_length=100)
    shipping_address_line = serializers.CharField(max_length=255)
    shipping_is_rural = serializers.BooleanField(default=False)
    shipping_landmark = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    billing_same_as_shipping = serializers.BooleanField(default=True)
    billing_full_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    billing_phone_number = serializers.CharField(max_length=17, required=False, allow_blank=True, default="")
    billing_province = serializers.ChoiceField(choices=Order.shipping_province.field.choices, required=False, allow_blank=True, default="")
    billing_city = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    billing_address_line = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    delivery_method = serializers.ChoiceField(choices=Order.DeliveryMethod.choices)
    payment_method = serializers.ChoiceField(choices=Order.PaymentMethod.choices)
    wallet_provider = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Cart is empty.")
        return items

    def validate(self, data):
        if data["shipping_is_rural"] and not data["shipping_landmark"]:
            raise serializers.ValidationError({"shipping_landmark": "Required for rural delivery."})
        if data["payment_method"] == Order.PaymentMethod.WALLET and not data.get("wallet_provider"):
            raise serializers.ValidationError({"wallet_provider": "Required for wallet payment."})
        for line in data["items"]:
            product = line["product"]
            if product.status != Product.Status.APPROVED or not product.is_active:
                raise serializers.ValidationError({"items": f'"{product.name}" is no longer available.'})
            if line["quantity"] > product.stock_quantity:
                raise serializers.ValidationError({"items": f'Only {product.stock_quantity} left in stock for "{product.name}".'})
        return data

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context["request"]

        subtotal = Decimal("0.00")
        line_specs = []
        for line in items_data:
            product = Product.objects.select_for_update().get(pk=line["product"].pk)
            if line["quantity"] > product.stock_quantity:
                raise serializers.ValidationError({"items": f'Only {product.stock_quantity} left in stock for "{product.name}".'})
            unit_price = product.discounted_price
            subtotal += unit_price * line["quantity"]
            line_specs.append((product, line["quantity"], unit_price))

        shipping_fee = DELIVERY_FEES[validated_data["delivery_method"]]
        total = subtotal + shipping_fee

        billing_same = validated_data["billing_same_as_shipping"]
        order = Order.objects.create(
            customer=request.user if request.user.is_authenticated else None,
            shipping_full_name=validated_data["shipping_full_name"],
            shipping_phone_number=validated_data["shipping_phone_number"],
            shipping_email=validated_data["shipping_email"],
            shipping_province=validated_data["shipping_province"],
            shipping_city=validated_data["shipping_city"],
            shipping_address_line=validated_data["shipping_address_line"],
            shipping_is_rural=validated_data["shipping_is_rural"],
            shipping_landmark=validated_data["shipping_landmark"],
            billing_same_as_shipping=billing_same,
            billing_full_name="" if billing_same else validated_data["billing_full_name"],
            billing_phone_number="" if billing_same else validated_data["billing_phone_number"],
            billing_province="" if billing_same else validated_data["billing_province"],
            billing_city="" if billing_same else validated_data["billing_city"],
            billing_address_line="" if billing_same else validated_data["billing_address_line"],
            delivery_method=validated_data["delivery_method"],
            payment_method=validated_data["payment_method"],
            wallet_provider=validated_data.get("wallet_provider", ""),
            # No real payment gateway is wired up yet (§4.5) — COD stays
            # unpaid until collection, card/wallet are treated as paid
            # immediately since that flow is a UI preview, not a live charge.
            payment_status=Order.PaymentStatus.PENDING if validated_data["payment_method"] == Order.PaymentMethod.COD else Order.PaymentStatus.PAID,
            subtotal=subtotal,
            shipping_fee=shipping_fee,
            total=total,
            estimated_delivery_days=DELIVERY_ESTIMATE_DAYS[validated_data["delivery_method"]],
        )

        for product, quantity, unit_price in line_specs:
            OrderItem.objects.create(
                order=order,
                product=product,
                vendor=product.vendor,
                product_name=product.name,
                product_slug=product.slug,
                quantity=quantity,
                unit_price=unit_price,
            )
            product.stock_quantity -= quantity
            product.save(update_fields=["stock_quantity"])

        return order
