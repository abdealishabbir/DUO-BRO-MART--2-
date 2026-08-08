from rest_framework import serializers

from apps.orders.models import Order

from .models import Feedback, FeedbackImage


def _rating_field():
    return serializers.IntegerField(min_value=1, max_value=5)


class FeedbackCreateSerializer(serializers.ModelSerializer):
    # Not a model field — only used to verify a guest's ownership of the
    # order (same email/phone-at-checkout check as TrackOrderView /
    # OrderCancelView). Ignored once a logged-in owner is already verified.
    contact = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Feedback
        fields = ["order", "contact", "delivery_rating", "packaging_rating", "quality_rating", "service_rating", "overall_rating", "review_text", "would_recommend"]

    delivery_rating = _rating_field()
    packaging_rating = _rating_field()
    quality_rating = _rating_field()
    service_rating = _rating_field()
    overall_rating = _rating_field()

    def validate_order(self, order):
        request = self.context["request"]
        owns_order = request.user.is_authenticated and order.customer_id == request.user.id
        if not owns_order:
            contact = (self.initial_data.get("contact") or "").strip()
            contact_normalized = contact.lower().replace(" ", "")
            matches_email = order.shipping_email.lower() == contact_normalized
            matches_phone = order.shipping_phone_number.replace(" ", "") == contact.replace(" ", "")
            owns_order = bool(contact) and (matches_email or matches_phone)
        if not owns_order:
            raise serializers.ValidationError("This isn't your order.")
        if order.status != Order.Status.DELIVERED:
            raise serializers.ValidationError("Feedback can only be left once an order is delivered.")
        if Feedback.objects.filter(order=order).exists():
            raise serializers.ValidationError("You've already left feedback for this order.")
        return order

    def create(self, validated_data):
        validated_data.pop("contact", None)
        request = self.context["request"]
        validated_data["customer"] = request.user if request.user.is_authenticated else None
        return Feedback.objects.create(**validated_data)


class FeedbackImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackImage
        fields = ["id", "image"]
        read_only_fields = fields


class FeedbackSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source="order.order_code", read_only=True)
    images = FeedbackImageSerializer(many=True, read_only=True)

    class Meta:
        model = Feedback
        fields = [
            "id", "order", "order_code", "delivery_rating", "packaging_rating", "quality_rating",
            "service_rating", "overall_rating", "review_text", "would_recommend", "created_at", "images",
        ]
        read_only_fields = fields
