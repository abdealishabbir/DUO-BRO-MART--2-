"""
Endpoint map:
  POST /api/feedback/                   (submit — logged-in customer only)
  GET  /api/feedback/mine/              (feedback this customer has already left)
  GET  /api/feedback/eligible-orders/   (delivered orders with no feedback yet — "Confirm Your Order" flow)
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import generics, permissions, serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer

from .models import MAX_FEEDBACK_IMAGES, Feedback, FeedbackImage
from .serializers import FeedbackCreateSerializer, FeedbackSerializer


class FeedbackCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FeedbackCreateSerializer
    # JSON kept for existing/legacy callers; multipart is what photo uploads need.
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def perform_create(self, serializer):
        images = self.request.FILES.getlist("images")
        if len(images) > MAX_FEEDBACK_IMAGES:
            raise serializers.ValidationError({"images": f"You can upload up to {MAX_FEEDBACK_IMAGES} photos."})

        try:
            with transaction.atomic():
                feedback = serializer.save()
                for image in images:
                    feedback_image = FeedbackImage(feedback=feedback, image=image)
                    feedback_image.full_clean()  # runs validate_feedback_image; raises on a bad file
                    feedback_image.save()
        except DjangoValidationError as exc:
            # Roll back the whole submission (including the Feedback row created
            # above) rather than leaving feedback saved with only some photos —
            # matches the transaction-boundary discipline used elsewhere in this
            # codebase (§ email-after-commit fix).
            raise serializers.ValidationError({"images": exc.messages})


class MyFeedbackView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FeedbackSerializer

    def get_queryset(self):
        return Feedback.objects.filter(customer=self.request.user)


class EligibleFeedbackOrdersView(APIView):
    """Delivered orders belonging to this customer with no feedback yet."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(
            customer=request.user, status=Order.Status.DELIVERED, feedback__isnull=True,
        ).prefetch_related("items")
        return Response(OrderSerializer(orders, many=True, context={"request": request}).data)
