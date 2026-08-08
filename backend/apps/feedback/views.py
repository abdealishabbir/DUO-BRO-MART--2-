"""
Endpoint map:
  POST /api/feedback/                   (submit — logged-in customer OR
                                          guest verified by order_code+contact
                                          in the request body, same pattern as
                                          apps.orders.views.OrderCancelView)
  GET  /api/feedback/mine/              (feedback this customer has already left)
  GET  /api/feedback/eligible-orders/   (no params: this customer's delivered,
                                          not-yet-reviewed orders, auth required.
                                          ?order_code=&contact=: single-order
                                          guest lookup, "Confirm Your Order" flow)
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
    # AllowAny at the transport layer — FeedbackCreateSerializer.validate_order()
    # does the real ownership check (logged-in owner OR guest order_code+contact
    # match), same split responsibility as apps.orders.views.OrderCancelView.
    permission_classes = [permissions.AllowAny]
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
    """
    Two modes, same endpoint:
      - `?order_code=X&contact=Y`: single-order guest lookup — same
        verification apps.orders.views.TrackOrderView uses, since a guest
        checkout has no "my orders" list to filter by. Also works for a
        logged-in owner opening their own direct order-feedback link (the
        contact check is only consulted when they aren't already the
        order's owner).
      - no params: this customer's full list of delivered/not-yet-reviewed
        orders (the original "Confirm Your Order" listing) — requires auth,
        since without an order_code there's nothing else to scope a guest
        lookup to.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        order_code = (request.query_params.get("order_code") or "").strip()

        if order_code:
            try:
                order = Order.objects.prefetch_related("items").get(order_code=order_code)
            except Order.DoesNotExist:
                return Response([])

            owns_order = request.user.is_authenticated and order.customer_id == request.user.id
            if not owns_order:
                contact = (request.query_params.get("contact") or "").strip()
                contact_normalized = contact.lower().replace(" ", "")
                matches_email = order.shipping_email.lower() == contact_normalized
                matches_phone = order.shipping_phone_number.replace(" ", "") == contact.replace(" ", "")
                owns_order = bool(contact) and (matches_email or matches_phone)

            if not owns_order or order.status != Order.Status.DELIVERED or Feedback.objects.filter(order=order).exists():
                return Response([])
            return Response(OrderSerializer([order], many=True, context={"request": request}).data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required, or pass order_code and contact for a guest lookup."}, status=401)

        orders = Order.objects.filter(
            customer=request.user, status=Order.Status.DELIVERED, feedback__isnull=True,
        ).prefetch_related("items")
        return Response(OrderSerializer(orders, many=True, context={"request": request}).data)
