"""
Endpoint map:

  Public:   POST /api/orders/                       (create — guest or logged in)
            GET  /api/orders/track/?order_code=&contact=

  Customer: GET  /api/orders/mine/

  Vendor:   GET  /api/orders/vendor/                (orders containing this vendor's products)

  Admin:    GET   /api/orders/admin/
            PATCH /api/orders/admin/<id>/            (status/courier/admin_notes)
            GET   /api/orders/admin/dashboard/        (§6.1 KPI dashboard)
            /api/orders/admin/coupons/                (§8.3 CRUD)
"""

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsVendorRole

from .models import Coupon, Order, OrderItem
from .serializers import CouponSerializer, OrderCreateSerializer, OrderSerializer


class OrderCreateView(APIView):
    """§4.6: place an order — guest checkout allowed."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "order-create"

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
    throttle_scope = "order-track"

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
        if updates.get("status") == Order.Status.DELIVERED and not order.delivered_at:
            order.delivered_at = timezone.now()
            updates["delivered_at"] = order.delivered_at
        if updates:
            order.save(update_fields=list(updates.keys()) + ["updated_at"])
        return Response(OrderSerializer(order, context={"request": request}).data)


def _month_bounds(reference_date):
    start = reference_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start


def _pct_change(current, previous):
    if previous == 0:
        return None  # no baseline to compare against — frontend shows "—" rather than a misleading 0%/∞%
    return round(float((current - previous) / previous) * 100, 1)


class AdminDashboardView(APIView):
    """
    §6.1: KPI-first dashboard. Every number here is computed from real
    data (orders/products/vendor-applications) — cancelled orders are
    excluded from revenue/commission the same way §6.4's order table
    excludes them, so the numbers agree wherever they overlap.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        from apps.accounts.models import VendorApplication
        from apps.products.models import Product

        now = timezone.now()
        this_month_start = _month_bounds(now)
        last_month_start = _month_bounds(this_month_start - timedelta(days=1))

        live_orders = Order.objects.exclude(status=Order.Status.CANCELLED).prefetch_related("items")

        def revenue_and_commission(orders_qs):
            revenue = Decimal("0.00")
            commission = Decimal("0.00")
            for order in orders_qs:
                revenue += order.subtotal
                commission += sum((item.commission_amount for item in order.items.all()), Decimal("0.00"))
            return revenue, commission

        this_month_revenue, this_month_commission = revenue_and_commission(live_orders.filter(created_at__gte=this_month_start))
        last_month_revenue, last_month_commission = revenue_and_commission(
            live_orders.filter(created_at__gte=last_month_start, created_at__lt=this_month_start)
        )
        all_time_revenue, all_time_commission = revenue_and_commission(live_orders)

        recent_orders = []
        for order in Order.objects.all().prefetch_related("items")[:10]:
            first_item = order.items.first()
            product_label = first_item.product_name if first_item else "—"
            if order.items.count() > 1:
                product_label += f" +{order.items.count() - 1} more"
            recent_orders.append({
                "id": order.id,
                "order_code": order.order_code,
                "customer": order.shipping_full_name,
                "product": product_label,
                "sale_price": order.subtotal,
                "commission": sum((i.commission_amount for i in order.items.all()), Decimal("0.00")) if order.status != Order.Status.CANCELLED else None,
                "net_to_vendor": sum((i.net_to_vendor for i in order.items.all()), Decimal("0.00")) if order.status != Order.Status.CANCELLED else None,
                "status": order.status,
            })

        week_ago = now - timedelta(days=7)
        product_stats = {}
        for item in OrderItem.objects.filter(order__created_at__gte=week_ago).exclude(order__status=Order.Status.CANCELLED).select_related("product"):
            key = item.product_id or item.product_slug
            entry = product_stats.setdefault(key, {"name": item.product_name, "slug": item.product_slug, "units_sold": 0, "revenue": Decimal("0.00"), "image": None})
            entry["units_sold"] += item.quantity
            entry["revenue"] += item.line_total
            if entry["image"] is None and item.product:
                first_image = item.product.images.first()
                if first_image:
                    entry["image"] = request.build_absolute_uri(first_image.image.url)
        top_products = sorted(product_stats.values(), key=lambda p: p["units_sold"], reverse=True)[:5]

        return Response({
            "platform_revenue": {
                "total": all_time_revenue,
                "this_month": this_month_revenue,
                "change_pct": _pct_change(this_month_revenue, last_month_revenue),
            },
            "platform_commission": {
                "total": all_time_commission,
                "this_month": this_month_commission,
                "change_pct": _pct_change(this_month_commission, last_month_commission),
            },
            "active_products": Product.objects.filter(status=Product.Status.APPROVED, is_active=True).count(),
            "category_count": Product.objects.filter(status=Product.Status.APPROVED, is_active=True).values("category").distinct().count(),
            "pending_vendors": VendorApplication.objects.filter(status=VendorApplication.Status.PENDING).count(),
            "recent_orders": recent_orders,
            "top_products": top_products,
        })


class AdminCouponViewSet(viewsets.ModelViewSet):
    """§8.3: admin CRUD for discount codes."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = CouponSerializer
    queryset = Coupon.objects.all().order_by("-created_at")
