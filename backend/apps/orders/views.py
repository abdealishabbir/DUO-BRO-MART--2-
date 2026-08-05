"""
Endpoint map:

  Public:   POST /api/orders/                       (create — guest or logged in)
            GET  /api/orders/track/?order_code=&contact=
            POST /api/orders/cancel/                  (§8.4: self-service, pending-only)

  Customer: GET  /api/orders/mine/

  Vendor:   GET  /api/orders/vendor/                (orders containing this vendor's products)
            GET  /api/orders/vendor/payouts/         (§6.7/Phase 6+ payout ledger: balance + history)
            GET  /api/orders/vendor/payouts/export/  (CSV download of vendor payout history)

  Admin:    GET   /api/orders/admin/
            PATCH /api/orders/admin/<id>/            (status/courier/admin_notes)
            GET   /api/orders/admin/dashboard/        (§6.1 KPI dashboard)
            /api/orders/admin/coupons/                (§8.3 CRUD)
            GET   /api/orders/admin/payouts/           (list every payout batch)
            POST  /api/orders/admin/payouts/generate/  (batch-generate eligible payouts)
            POST  /api/orders/admin/payouts/<id>/mark-paid/
            GET   /api/orders/admin/export/orders/    (CSV of all orders)
            GET   /api/orders/admin/export/payouts/   (CSV of all payout batches)
"""

from datetime import timedelta
from decimal import Decimal
import csv

from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsVendorRole
from apps.core.audit import log_admin_action
from apps.products.models import Product

from .models import Coupon, Order, OrderItem, Payout
from .payouts import eligible_order_items_for_vendor, generate_payouts, next_eligible_at_for_vendor
from .serializers import CouponSerializer, OrderCreateSerializer, OrderSerializer, PayoutSerializer



class OrderCreateView(APIView):
    """§4.6/§8.4: place an order — guest checkout allowed.

    Idempotency (§8.4): a client sends the same `idempotency_key` on a
    retry of the *same* checkout attempt (network timeout, double-click,
    etc.) — a slow response doesn't mean the first request failed, so
    blindly retrying without this could create two real orders and
    double-decrement stock. First call creates and returns 201; a retry
    with the same key returns the original order with 200, no new order,
    no second stock decrement. See models.Order.idempotency_key.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "order-create"

    def post(self, request):
        idempotency_key = (request.data.get("idempotency_key") or "").strip()
        if idempotency_key:
            existing = Order.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                return Response(OrderSerializer(existing, context={"request": request}).data, status=status.HTTP_200_OK)

        serializer = OrderCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            order = serializer.save()
        except IntegrityError:
            # Two near-simultaneous requests with the same key both passed
            # the check above before either committed; the DB's unique
            # constraint on idempotency_key caught the duplicate at the
            # database level — return whichever one actually won instead
            # of a 500.
            if idempotency_key:
                existing = Order.objects.filter(idempotency_key=idempotency_key).first()
                if existing:
                    return Response(OrderSerializer(existing, context={"request": request}).data, status=status.HTTP_200_OK)
            raise
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


class OrderCancelView(APIView):
    """
    §8.4: customer self-service cancellation. Deliberately scoped
    assumption (flagging it rather than burying it): only allowed while
    the order is still 'pending' — matches how COD/courier logistics
    actually work here, once a vendor starts processing/packing an item
    self-service cancel would leave a real-world mess (packed goods,
    dispatched courier pickup) that a simple status flip can't undo.
    Past 'pending', cancellation is an admin/support action instead (see
    AdminOrderUpdateView). Restocks every item and reverses coupon usage
    so the platform's numbers stay accurate — same ownership check
    TrackOrderView uses (logged-in owner, or a guest who can prove the
    email/phone used at checkout), since guests must be able to cancel too.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "order-track"

    @transaction.atomic
    def post(self, request):
        order_code = (request.data.get("order_code") or "").strip()
        if not order_code:
            return Response({"detail": "order_code is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.select_for_update().prefetch_related("items").get(order_code=order_code)
        except Order.DoesNotExist:
            return Response({"detail": "No order found with that ID."}, status=status.HTTP_404_NOT_FOUND)

        owns_order = request.user.is_authenticated and order.customer_id == request.user.id
        if not owns_order:
            contact = (request.data.get("contact") or "").strip()
            contact_normalized = contact.lower().replace(" ", "")
            matches_email = order.shipping_email.lower() == contact_normalized
            matches_phone = order.shipping_phone_number.replace(" ", "") == contact.replace(" ", "")
            owns_order = bool(contact) and (matches_email or matches_phone)

        if not owns_order:
            return Response({"detail": "The email or phone number doesn't match this order."}, status=status.HTTP_404_NOT_FOUND)

        if order.status != Order.Status.PENDING:
            return Response(
                {"detail": "This order is already being processed and can no longer be cancelled automatically — contact support for help."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for item in order.items.all():
            if item.product_id:
                Product.objects.filter(pk=item.product_id).update(stock_quantity=F("stock_quantity") + item.quantity)
        if order.coupon_id:
            Coupon.objects.filter(pk=order.coupon_id).update(used_count=F("used_count") - 1)

        order.status = Order.Status.CANCELLED
        order.admin_notes = (order.admin_notes + "\n" if order.admin_notes else "") + "Cancelled by customer."
        order.save(update_fields=["status", "admin_notes"])

        return Response(OrderSerializer(order, context={"request": request}).data)


class VendorOrdersView(ListAPIView):
    """§5.6: orders containing at least one of this vendor's products."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(items__vendor=self.request.user).distinct().prefetch_related("items")


class VendorPayoutsView(APIView):
    """
    §6.7/Phase 6+: a vendor's own payout ledger — current accruing
    (not-yet-batched) balance, when their next batch is allowed, and the
    full history of past payout batches. See apps.orders.payouts for the
    eligibility rules.
    """

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]

    def get(self, request):
        vendor = request.user
        pending_items = eligible_order_items_for_vendor(vendor)
        pending_balance = sum((i.net_to_vendor for i in pending_items), Decimal("0.00"))

        payouts = Payout.objects.filter(vendor=vendor).prefetch_related("items")

        return Response({
            "pending_balance": pending_balance,
            "pending_item_count": pending_items.count(),
            "next_eligible_at": next_eligible_at_for_vendor(vendor),
            "lifetime_paid": sum(
                (p.total_amount for p in payouts if p.status == Payout.Status.PAID), Decimal("0.00")
            ),
            "payouts": PayoutSerializer(payouts, many=True, context={"request": request}).data,
        })


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

        old_status = order.status
        for field, value in updates.items():
            setattr(order, field, value)
        if updates.get("status") == Order.Status.DELIVERED and not order.delivered_at:
            order.delivered_at = timezone.now()
            updates["delivered_at"] = order.delivered_at
        if updates:
            order.save(update_fields=list(updates.keys()) + ["updated_at"])
        if "status" in updates and updates["status"] != old_status:
            log_admin_action(request.user, "order.status_changed", order, details=f"{old_status} -> {updates['status']}")
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


class AdminPayoutViewSet(viewsets.ReadOnlyModelViewSet):
    """
    §6.7/Phase 6+: admin's payout ledger — list every batch ever generated,
    trigger generation of new eligible batches, and mark a batch paid once
    the transfer has actually been sent (no live bank/wallet API — see
    models.Payout docstring).
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = PayoutSerializer

    def get_queryset(self):
        qs = Payout.objects.select_related("vendor").prefetch_related("items").all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        vendor_filter = self.request.query_params.get("vendor")
        if vendor_filter:
            qs = qs.filter(vendor_id=vendor_filter)
        return qs

    @action(detail=False, methods=["post"])
    def generate(self, request):
        created = generate_payouts()
        return Response(
            {
                "created_count": len(created),
                "payouts": PayoutSerializer(created, many=True, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        payout = self.get_object()
        if payout.status == Payout.Status.PAID:
            return Response({"detail": "This payout is already marked paid."}, status=status.HTTP_400_BAD_REQUEST)
        payout.status = Payout.Status.PAID
        payout.reference = request.data.get("reference", payout.reference)
        payout.admin_notes = request.data.get("admin_notes", payout.admin_notes)
        payout.paid_at = timezone.now()
        payout.save(update_fields=["status", "reference", "admin_notes", "paid_at"])
        log_admin_action(request.user, "payout.marked_paid", payout, details=f"Rs. {payout.total_amount} — ref: {payout.reference}")
        return Response(PayoutSerializer(payout, context={"request": request}).data)


# ---------------------------------------------------------------------------
# CSV export views
# ---------------------------------------------------------------------------

def _csv_response(filename):
    """Returns an HttpResponse pre-configured for CSV download."""
    resp = HttpResponse(content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    # BOM so Excel on Windows opens UTF-8 CSVs correctly without
    # needing an import wizard — harmless for every other consumer.
    resp.write("\ufeff")
    return resp


class AdminOrdersExportView(APIView):
    """
    GET /api/orders/admin/export/orders/
    Download every order (optionally filtered by ?status=, ?from=YYYY-MM-DD,
    ?to=YYYY-MM-DD) as a CSV — one row per order, tab-separated product list
    in the Items column rather than one row per item, so the spreadsheet is
    readable without a pivot table.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = Order.objects.prefetch_related("items").order_by("-created_at")

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)

        resp = _csv_response(f"orders_{timezone.now().strftime('%Y%m%d')}.csv")
        writer = csv.writer(resp)
        writer.writerow([
            "Order Code", "Date", "Status", "Payment Method",
            "Customer Name", "Customer Email", "Customer Phone",
            "Province", "City", "Address", "Rural",
            "Items", "Subtotal (PKR)", "Discount (PKR)", "Shipping (PKR)", "Total (PKR)",
            "Coupon Code",
        ])

        for order in qs:
            items_summary = " | ".join(
                f"{i.product_name} x{i.quantity} @ Rs.{i.unit_price}"
                for i in order.items.all()
            )
            writer.writerow([
                order.order_code,
                order.created_at.strftime("%Y-%m-%d %H:%M"),
                order.status,
                order.payment_method,
                order.shipping_full_name,
                order.shipping_email,
                order.shipping_phone_number,
                order.shipping_province,
                order.shipping_city,
                order.shipping_address_line,
                "Yes" if order.shipping_is_rural else "No",
                items_summary,
                order.subtotal,
                order.discount_amount,
                order.shipping_fee,
                order.total,
                order.coupon.code if order.coupon else "",
            ])
        return resp


class AdminPayoutsExportView(APIView):
    """
    GET /api/orders/admin/export/payouts/
    Download every payout batch as CSV — one row per batch, line items
    as a summary count/total rather than expanding every order (the
    admin can drill into individual batches in the UI if needed).
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = (
            Payout.objects.select_related("vendor")
            .prefetch_related("items__order_item__order")
            .order_by("-created_at")
        )

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        resp = _csv_response(f"payouts_{timezone.now().strftime('%Y%m%d')}.csv")
        writer = csv.writer(resp)
        writer.writerow([
            "Payout ID", "Vendor", "Vendor Email",
            "Period Start", "Period End",
            "Status", "Total Amount (PKR)", "Order Count",
            "Reference", "Paid At", "Admin Notes", "Created At",
        ])

        for payout in qs:
            writer.writerow([
                payout.id,
                f"{payout.vendor.first_name} {payout.vendor.last_name}".strip() or payout.vendor.username,
                payout.vendor.email,
                payout.period_start,
                payout.period_end,
                payout.status,
                payout.total_amount,
                payout.items.count(),
                payout.reference or "",
                payout.paid_at.strftime("%Y-%m-%d %H:%M") if payout.paid_at else "",
                payout.admin_notes or "",
                payout.created_at.strftime("%Y-%m-%d %H:%M"),
            ])
        return resp


class VendorPayoutsExportView(APIView):
    """
    GET /api/orders/vendor/payouts/export/
    A vendor downloads their own payout history as CSV — same data
    VendorPayoutsView returns, formatted for a spreadsheet.
    """

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]

    def get(self, request):
        qs = (
            Payout.objects.filter(vendor=request.user)
            .prefetch_related("items")
            .order_by("-created_at")
        )

        resp = _csv_response(f"my_payouts_{timezone.now().strftime('%Y%m%d')}.csv")
        writer = csv.writer(resp)
        writer.writerow([
            "Payout ID", "Period Start", "Period End",
            "Status", "Total Amount (PKR)", "Order Count",
            "Reference", "Paid At", "Created At",
        ])

        for payout in qs:
            writer.writerow([
                payout.id,
                payout.period_start,
                payout.period_end,
                payout.status,
                payout.total_amount,
                payout.items.count(),
                payout.reference or "",
                payout.paid_at.strftime("%Y-%m-%d %H:%M") if payout.paid_at else "",
                payout.created_at.strftime("%Y-%m-%d %H:%M"),
            ])
        return resp
