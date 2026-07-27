"""
Endpoint map:

  Public:   POST /api/orders/                       (create — guest or logged in)
            GET  /api/orders/track/?order_code=&contact=

  Customer: GET  /api/orders/mine/

  Vendor:   GET  /api/orders/vendor/                (orders containing this vendor's products)

  Admin:    GET   /api/orders/admin/
            PATCH /api/orders/admin/<id>/            (status/courier/admin_notes)
"""

from rest_framework import permissions, status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsVendorRole

from .models import Order
from .serializers import OrderCreateSerializer, OrderSerializer


class OrderCreateView(APIView):
    """§4.6: place an order — guest checkout allowed."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order, context={"request": request}).data, status=status.HTTP_201_CREATED)


class MyOrdersView(ListAPIView):
    """A logged-in customer's own order history."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user).prefetch_related("items")


class TrackOrderView(APIView):
    """
    §4.6: public order tracking by order_code + the email or phone used
    at checkout — deliberately not scoped to "the logged-in user" since
    guests must be able to track too.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        order_code = request.query_params.get("order_code", "").strip()
        contact = request.query_params.get("contact", "").strip()
        if not order_code or not contact:
            return Response({"detail": "order_code and contact are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.prefetch_related("items").get(order_code=order_code)
        except Order.DoesNotExist:
            return Response({"detail": "No order found with that ID."}, status=status.HTTP_404_NOT_FOUND)

        contact_normalized = contact.lower().replace(" ", "")
        matches_email = order.shipping_email.lower() == contact_normalized
        matches_phone = order.shipping_phone_number.replace(" ", "") == contact.replace(" ", "")
        if not (matches_email or matches_phone):
            return Response({"detail": "The email or phone number doesn't match this order."}, status=status.HTTP_404_NOT_FOUND)

        return Response(OrderSerializer(order, context={"request": request}).data)


class VendorOrdersView(ListAPIView):
    """§5.6: orders containing at least one of this vendor's products."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(items__vendor=self.request.user).distinct().prefetch_related("items")


class AdminOrdersView(ListAPIView):
    """§6.4: all orders, optionally filtered by status."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = Order.objects.all().prefetch_related("items")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(order_code__icontains=search)
        return qs


class AdminOrderUpdateView(APIView):
    """§6.4: admin moves an order through pending -> processing -> shipped -> delivered (or cancelled)."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    ALLOWED_FIELDS = {"status", "courier_name", "admin_notes", "payment_status"}

    def patch(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        updates = {k: v for k, v in request.data.items() if k in self.ALLOWED_FIELDS}
        if "status" in updates and updates["status"] not in Order.Status.values:
            return Response({"status": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        if "payment_status" in updates and updates["payment_status"] not in Order.PaymentStatus.values:
            return Response({"payment_status": "Invalid payment status."}, status=status.HTTP_400_BAD_REQUEST)

        for field, value in updates.items():
            setattr(order, field, value)
        if updates:
            order.save(update_fields=list(updates.keys()) + ["updated_at"])
        return Response(OrderSerializer(order, context={"request": request}).data)
