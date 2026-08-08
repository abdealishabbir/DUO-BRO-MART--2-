from rest_framework import serializers

from .models import Complaint


class ComplaintCreateSerializer(serializers.ModelSerializer):
    # Not a model field — only used to verify a guest's ownership of the
    # order this item belongs to (same check as apps.feedback's guest path).
    contact = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Complaint
        fields = ["id", "order_item", "contact", "reason", "description"]
        read_only_fields = ["id"]

    def validate_order_item(self, order_item):
        request = self.context["request"]
        order = order_item.order
        owns_order = request.user.is_authenticated and order.customer_id == request.user.id
        if not owns_order:
            contact = (self.initial_data.get("contact") or "").strip()
            contact_normalized = contact.lower().replace(" ", "")
            matches_email = order.shipping_email.lower() == contact_normalized
            matches_phone = order.shipping_phone_number.replace(" ", "") == contact.replace(" ", "")
            owns_order = bool(contact) and (matches_email or matches_phone)
        if not owns_order:
            raise serializers.ValidationError("This isn't one of your orders.")
        if Complaint.objects.filter(order_item=order_item).exists():
            raise serializers.ValidationError("A complaint has already been filed for this item.")
        return order_item

    def create(self, validated_data):
        validated_data.pop("contact", None)
        request = self.context["request"]
        validated_data["customer"] = request.user if request.user.is_authenticated else None
        return Complaint.objects.create(**validated_data)


class ComplaintSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="order_item.product_name", read_only=True)
    order_code = serializers.CharField(source="order_item.order.order_code", read_only=True)
    customer_email = serializers.SerializerMethodField()
    vendor_name = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            "id", "order_item", "order_code", "product_name", "customer_email", "vendor_name",
            "reason", "description", "status", "resolution_notes", "resolved_at", "created_at",
        ]
        read_only_fields = fields

    def get_customer_email(self, obj):
        # Falls back to the order's checkout email for a guest complaint
        # (customer is null) — same "the order is the real record" idea
        # used throughout the guest-checkout paths in this codebase.
        if obj.customer:
            return obj.customer.email
        return obj.order_item.order.shipping_email

    def get_vendor_name(self, obj):
        vendor = obj.order_item.vendor
        if not vendor:
            return None
        return f"{vendor.first_name} {vendor.last_name}".strip() or vendor.username
