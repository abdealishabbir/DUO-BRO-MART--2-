from rest_framework import serializers

from apps.orders.models import Order

from .models import Feedback, FeedbackImage


def _rating_field():
    return serializers.IntegerField(min_value=1, max_value=5)


class FeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ["order", "delivery_rating", "packaging_rating", "quality_rating", "service_rating", "overall_rating", "review_text", "would_recommend"]

    delivery_rating = _rating_field()
    packaging_rating = _rating_field()
    quality_rating = _rating_field()
    service_rating = _rating_field()
    overall_rating = _rating_field()

    def validate_order(self, order):
        request = self.context["request"]
        if order.customer_id != request.user.id:
            raise serializers.ValidationError("This isn't your order.")
        if order.status != Order.Status.DELIVERED:
            raise serializers.ValidationError("Feedback can only be left once an order is delivered.")
        if Feedback.objects.filter(order=order).exists():
            raise serializers.ValidationError("You've already left feedback for this order.")
        return order

    def create(self, validated_data):
        validated_data["customer"] = self.context["request"].user
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
