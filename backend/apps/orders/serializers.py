from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.products.models import Product
from apps.products.utils import maybe_send_low_stock_alert

from .models import DELIVERY_ESTIMATE_DAYS, DELIVERY_FEES, Coupon, Order, OrderItem


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            "id", "code", "discount_type", "discount_value", "min_order_value",
            "max_uses", "used_count", "valid_from", "valid_until", "is_active", "created_at",
        ]
        read_only_fields = ["id", "used_count", "created_at"]


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    net_to_vendor = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    commission_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    vendor_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id", "product", "product_name", "product_slug", "quantity", "unit_price", "line_total",
            "net_to_vendor", "commission_amount", "vendor_id", "vendor_name", "image",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        if not obj.vendor:
            return None
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username

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
    commission_total = serializers.SerializerMethodField()
    coupon_code = serializers.CharField(source="coupon.code", read_only=True, default=None)
    net_to_vendor_total = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_code", "status", "payment_status", "payment_method", "wallet_provider",
            "delivery_method", "courier_name", "admin_notes",
            "shipping_full_name", "shipping_phone_number", "shipping_email", "shipping_province",
            "shipping_city", "shipping_address_line", "shipping_is_rural", "shipping_landmark",
            "billing_same_as_shipping", "billing_full_name", "billing_phone_number",
            "billing_province", "billing_city", "billing_address_line",
            "subtotal", "discount_amount", "coupon_code", "shipping_fee", "total", "estimated_delivery_days", "delivered_at",
            "commission_total", "net_to_vendor_total",
            "items", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_commission_total(self, obj):
        return sum((item.commission_amount for item in obj.items.all()), Decimal("0.00"))

    def get_net_to_vendor_total(self, obj):
        return sum((item.net_to_vendor for item in obj.items.all()), Decimal("0.00"))


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
    coupon_code = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Cart is empty.")
        return items

    def validate(self, data):
        if data["shipping_is_rural"] and not data["shipping_landmark"]:
            raise serializers.ValidationError({"shipping_landmark": "Required for rural delivery."})
        if data["payment_method"] == Order.PaymentMethod.WALLET and not data.get("wallet_provider"):
            raise serializers.ValidationError({"wallet_provider": "Required for wallet payment."})

        # §6.7: admin can disable a payment gateway from Settings — enforce
        # it here too, not just by hiding the option in the UI, in case a
        # stale client still submits it.
        from apps.core.models import PlatformSettings

        platform_settings = PlatformSettings.get_solo()
        method = data["payment_method"]
        gateway_enabled = {
            Order.PaymentMethod.COD: platform_settings.cod_enabled,
            Order.PaymentMethod.CARD: platform_settings.card_enabled,
            Order.PaymentMethod.WALLET: (
                platform_settings.jazzcash_enabled or platform_settings.easypaisa_enabled
            ) if method == Order.PaymentMethod.WALLET else True,
        }
        if not gateway_enabled.get(method, True):
            raise serializers.ValidationError({"payment_method": "This payment method isn't currently available."})
        if method == Order.PaymentMethod.WALLET:
            provider = (data.get("wallet_provider") or "").lower()
            if "jazzcash" in provider and not platform_settings.jazzcash_enabled:
                raise serializers.ValidationError({"wallet_provider": "JazzCash isn't currently available."})
            if "easypaisa" in provider and not platform_settings.easypaisa_enabled:
                raise serializers.ValidationError({"wallet_provider": "EasyPaisa isn't currently available."})

        for line in data["items"]:
            product = line["product"]
            if product.status != Product.Status.APPROVED or not product.is_active:
                raise serializers.ValidationError({"items": f'"{product.name}" is no longer available.'})
            if line["quantity"] > product.stock_quantity:
                raise serializers.ValidationError({"items": f'Only {product.stock_quantity} left in stock for "{product.name}".'})

        if data.get("coupon_code"):
            from .models import Coupon

            try:
                coupon = Coupon.objects.get(code__iexact=data["coupon_code"].strip())
            except Coupon.DoesNotExist:
                raise serializers.ValidationError({"coupon_code": "Invalid coupon code."})
            estimated_subtotal = sum((line["product"].discounted_price * line["quantity"] for line in data["items"]), Decimal("0.00"))
            valid, message = coupon.is_valid_for(estimated_subtotal)
            if not valid:
                raise serializers.ValidationError({"coupon_code": message})
            data["_coupon"] = coupon

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
            line_specs.append((product, line["quantity"], unit_price, product.base_price))

        shipping_fee = DELIVERY_FEES[validated_data["delivery_method"]]
        # §6.7: admin-configured free-shipping threshold overrides the
        # delivery method's normal fee once the cart clears it.
        from apps.core.models import PlatformSettings

        if subtotal >= PlatformSettings.get_solo().free_shipping_threshold:
            shipping_fee = Decimal("0.00")

        coupon = validated_data.get("_coupon")
        discount_amount = coupon.discount_amount(subtotal) if coupon else Decimal("0.00")
        total = subtotal - discount_amount + shipping_fee

        billing_same = validated_data["billing_same_as_shipping"]
        order = Order.objects.create(
            customer=request.user if request.user.is_authenticated else None,
            coupon=coupon,
            discount_amount=discount_amount,
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

        for product, quantity, unit_price, base_price in line_specs:
            OrderItem.objects.create(
                order=order,
                product=product,
                vendor=product.vendor,
                product_name=product.name,
                product_slug=product.slug,
                quantity=quantity,
                unit_price=unit_price,
                unit_base_price=base_price,
            )
            stock_before = product.stock_quantity
            product.stock_quantity -= quantity
            product.save(update_fields=["stock_quantity"])
            maybe_send_low_stock_alert(product, stock_before)

        if coupon:
            coupon.used_count += 1
            coupon.save(update_fields=["used_count"])

        return order
