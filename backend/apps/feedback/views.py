"""
Endpoint map:
  POST /api/feedback/                   (submit — logged-in customer only)
  GET  /api/feedback/mine/              (feedback this customer has already left)
  GET  /api/feedback/eligible-orders/   (delivered orders with no feedback yet — "Confirm Your Order" flow)
"""

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer

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


class EligibleFeedbackOrdersView(APIView):
    """Delivered orders belonging to this customer with no feedback yet."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(
            customer=request.user, status=Order.Status.DELIVERED, feedback__isnull=True,
        ).prefetch_related("items")
        return Response(OrderSerializer(orders, many=True, context={"request": request}).data)
