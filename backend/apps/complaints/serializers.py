from rest_framework import serializers

from .models import Complaint


class ComplaintCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ["id", "order_item", "reason", "description"]
        read_only_fields = ["id"]

    def validate_order_item(self, order_item):
        request = self.context["request"]
        if order_item.order.customer_id != request.user.id:
            raise serializers.ValidationError("This isn't one of your orders.")
        if Complaint.objects.filter(order_item=order_item).exists():
            raise serializers.ValidationError("A complaint has already been filed for this item.")
        return order_item

    def create(self, validated_data):
        validated_data["customer"] = self.context["request"].user
        return Complaint.objects.create(**validated_data)


class ComplaintSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="order_item.product_name", read_only=True)
    order_code = serializers.CharField(source="order_item.order.order_code", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    vendor_name = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            "id", "order_item", "order_code", "product_name", "customer_email", "vendor_name",
            "reason", "description", "status", "resolution_notes", "resolved_at", "created_at",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        vendor = obj.order_item.vendor
        if not vendor:
            return None
        return f"{vendor.first_name} {vendor.last_name}".strip() or vendor.username
