from rest_framework import serializers

from apps.orders.models import Order, OrderItem

from .models import Feedback


def _rating_field():
    return serializers.IntegerField(min_value=1, max_value=5)


class FeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ["order_item", "service_rating", "packaging_rating", "quality_rating", "overall_rating", "comment"]

    service_rating = _rating_field()
    packaging_rating = _rating_field()
    quality_rating = _rating_field()
    overall_rating = _rating_field()

    def validate_order_item(self, order_item):
        request = self.context["request"]
        if order_item.order.customer_id != request.user.id:
            raise serializers.ValidationError("This isn't one of your orders.")
        if order_item.order.status != Order.Status.DELIVERED:
            raise serializers.ValidationError("Feedback can only be left once an order is delivered.")
        if Feedback.objects.filter(order_item=order_item).exists():
            raise serializers.ValidationError("You've already left feedback for this item.")
        return order_item

    def create(self, validated_data):
        validated_data["customer"] = self.context["request"].user
        return Feedback.objects.create(**validated_data)


class FeedbackSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="order_item.product_name", read_only=True)

    class Meta:
        model = Feedback
        fields = [
            "id", "order_item", "product_name", "service_rating", "packaging_rating",
            "quality_rating", "overall_rating", "comment", "created_at",
        ]
        read_only_fields = fields
