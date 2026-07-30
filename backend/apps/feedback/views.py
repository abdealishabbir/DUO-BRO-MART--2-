"""
Endpoint map:
  POST /api/feedback/                  (submit — logged-in customer only)
  GET  /api/feedback/mine/             (feedback this customer has already left)
  GET  /api/feedback/eligible-items/   (delivered order items with no feedback yet — powers "Rate your order")
"""

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, OrderItem

from .models import Feedback
from .serializers import FeedbackCreateSerializer, FeedbackSerializer


class FeedbackCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FeedbackCreateSerializer


class MyFeedbackView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FeedbackSerializer

    def get_queryset(self):
        return Feedback.objects.filter(customer=self.request.user)


class EligibleFeedbackItemsView(APIView):
    """Delivered order items belonging to this customer that don't have feedback yet."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = OrderItem.objects.filter(
            order__customer=request.user, order__status=Order.Status.DELIVERED, feedback__isnull=True,
        ).select_related("order")
        return Response([
            {"id": i.id, "order_code": i.order.order_code, "product_name": i.product_name, "product_slug": i.product_slug}
            for i in items
        ])
