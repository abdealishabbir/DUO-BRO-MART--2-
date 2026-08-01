"""
See models.py module docstring for the full business-rule writeup this
implements. Endpoint map:

  Public:  GET  /api/products/categories/
           GET  /api/products/?category=&brand=&min_price=&max_price=&deals=1&sort=&search=&page=
           GET  /api/products/<slug>/

  Vendor:  GET/POST    /api/products/vendor/products/
           GET/PATCH   /api/products/vendor/products/<id>/
           POST        /api/products/vendor/products/<id>/submit/
           POST        /api/products/vendor/products/<id>/upload-image/
           GET/POST    /api/products/vendor/change-requests/
           GET/POST    /api/products/vendor/stock-requests/

  Admin:   GET   /api/products/admin/products/?status=pending&category=<id>&search=<q>
           PATCH /api/products/admin/products/<id>/   (edit catalog data)
           DELETE /api/products/admin/products/<id>/  (cascades to images/requests)
           POST  /api/products/admin/products/<id>/approve/
           POST  /api/products/admin/products/<id>/reject/
           GET  /api/products/admin/change-requests/?status=pending
           POST /api/products/admin/change-requests/<id>/approve/
           POST /api/products/admin/change-requests/<id>/reject/
           GET  /api/products/admin/stock-requests/?status=pending
           POST /api/products/admin/stock-requests/<id>/approve/
           POST /api/products/admin/stock-requests/<id>/reject/
           GET   /api/products/admin/commission-rates/          (§6.6)
           PATCH /api/products/admin/commission-rates/
           GET   /api/products/admin/pricing/?search=&category=  (§6.6 Pricing Manager)
           GET   /api/products/vendor/analytics/?range=7d|30d|90d  (§6.7/Phase 6+ real analytics)
"""

from decimal import Decimal, InvalidOperation

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.accounts.permissions import IsAdminRole, IsVendorRole, ReadOnlyOrIsAdmin

from .models import Category, CommissionRate, PROVISIONAL_COMMISSION_RATE, Product, ProductChangeRequest, ProductImage, ProductView, StockChangeRequest
from .serializers import (
    AdminPricingSerializer,
    AdminProductUpdateSerializer,
    CategorySerializer,
    CommissionRateSerializer,
    ProductChangeRequestCreateSerializer,
    ProductChangeRequestSerializer,
    ProductCreateSerializer,
    ProductImageSerializer,
    ProductSerializer,
    PublicProductDetailSerializer,
    PublicProductListSerializer,
    StockChangeRequestCreateSerializer,
    StockChangeRequestSerializer,
)


# ---------------------------------------------------------------------------
# Public / shared
# ---------------------------------------------------------------------------

class CategoryViewSet(viewsets.ModelViewSet):
    """Public read (Shop page category filter), admin-only writes (§6.2 taxonomy)."""

    permission_classes = [ReadOnlyOrIsAdmin]
    serializer_class = CategorySerializer
    queryset = Category.objects.all()


class PublicProductViewSet(ReadOnlyModelViewSet):
    """
    Storefront catalog (Home/Shop/Product Detail) — the only products a
    customer can ever see are approved + active (§6.2 approval gate).
    Looked up by slug, not id, since that's what the storefront URLs use.
    """

    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"
    throttle_scope = "public-catalog"

    def get_serializer_class(self):
        return PublicProductDetailSerializer if self.action == "retrieve" else PublicProductListSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Best-effort view logging for vendor Analytics (§6.7/Phase 6+) —
        # never let a logging hiccup break the page itself.
        try:
            source = request.query_params.get("src", "direct")
            if source not in ProductView.Source.values:
                source = ProductView.Source.OTHER
            ProductView.objects.create(product=instance, source=source)
        except Exception:
            pass
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def get_queryset(self):
        qs = (
            Product.objects.filter(status=Product.Status.APPROVED, is_active=True)
            .select_related("vendor", "category")
            .prefetch_related("images")
        )

        category = self.request.query_params.get("category")
        if category:
            slugs = [s for s in category.split(",") if s]
            qs = qs.filter(category__slug__in=slugs)

        brand = self.request.query_params.get("brand")
        if brand:
            brands = [b for b in brand.split(",") if b]
            qs = qs.filter(brand__in=brands)

        min_price = self.request.query_params.get("min_price")
        if min_price:
            qs = qs.filter(base_price__gte=min_price)

        max_price = self.request.query_params.get("max_price")
        if max_price:
            qs = qs.filter(base_price__lte=max_price)

        deals_only = self.request.query_params.get("deals")
        if deals_only == "1":
            qs = qs.filter(active_discount_percent__isnull=False)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(brand__icontains=search) | Q(description__icontains=search))

        ordering = self.request.query_params.get("sort")
        if ordering == "price-asc":
            qs = qs.order_by("base_price")
        elif ordering == "price-desc":
            qs = qs.order_by("-base_price")
        # default (including "newest") keeps Product.Meta's "-created_at"

        return qs

    @action(detail=False, methods=["get"])
    def brands(self, request):
        """Distinct brand names across the visible (approved+active) catalog — powers the Shop page brand filter."""
        names = (
            Product.objects.filter(status=Product.Status.APPROVED, is_active=True)
            .order_by("brand")
            .values_list("brand", flat=True)
            .distinct()
        )
        return Response(list(names))


# ---------------------------------------------------------------------------
# Vendor
# ---------------------------------------------------------------------------

class VendorAnalyticsView(APIView):
    """
    §6.7/Phase 6+ vendor Analytics — replaces the old placeholder. Built
    entirely from data that genuinely exists: real orders (apps.orders)
    for revenue/units/top products, and ProductView for traffic/conversion.
    Deliberately NOT included: session-level funnels, returning-vs-new
    visitor splits, or geographic breakdowns — none of that data is
    captured anywhere yet (see DUOBROMART.md's Payout & Analytics Ledger
    Subsystem section for what a fuller build would need).
    """

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]

    RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}

    def get(self, request):
        from datetime import timedelta

        from apps.orders.models import Order, OrderItem

        days = self.RANGE_DAYS.get(request.query_params.get("range"), 30)
        since = timezone.now() - timedelta(days=days)
        vendor = request.user

        items = OrderItem.objects.filter(
            vendor=vendor, order__created_at__gte=since,
        ).exclude(order__status=Order.Status.CANCELLED).select_related("order")

        revenue = sum((i.net_to_vendor for i in items), 0)
        units_sold = sum((i.quantity for i in items), 0)
        order_ids = {i.order_id for i in items}

        top_products = {}
        for i in items:
            entry = top_products.setdefault(i.product_name, {"units": 0, "revenue": 0})
            entry["units"] += i.quantity
            entry["revenue"] += i.net_to_vendor
        top_products = sorted(
            ({"name": name, **v} for name, v in top_products.items()),
            key=lambda r: r["revenue"], reverse=True,
        )[:5]

        views_qs = ProductView.objects.filter(product__vendor=vendor, viewed_at__gte=since)
        total_views = views_qs.count()
        source_breakdown = {
            choice: views_qs.filter(source=choice).count() for choice in ProductView.Source.values
        }

        conversion_rate = round((len(order_ids) / total_views) * 100, 2) if total_views else None

        return Response({
            "range_days": days,
            "revenue": revenue,
            "order_count": len(order_ids),
            "units_sold": units_sold,
            "total_views": total_views,
            "conversion_rate": conversion_rate,
            "traffic_sources": source_breakdown,
            "top_products": top_products,
        })


class VendorProductViewSet(ModelViewSet):
    """A vendor's own product catalog — create, edit, submit for review,
    upload images. No delete once submitted (see destroy() below)."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        return ProductSerializer if self.action in ("list", "retrieve") else ProductCreateSerializer

    def get_queryset(self):
        return Product.objects.filter(vendor=self.request.user).select_related("category").prefetch_related("images")

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        if product.status != Product.Status.DRAFT:
            return Response(
                {"detail": "Only draft products (not yet submitted) can be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        product = self.get_object()
        if product.status not in (Product.Status.DRAFT, Product.Status.REJECTED):
            return Response(
                {"detail": "Only draft or rejected products can be (re-)submitted for review."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        product.submit_for_review()
        return Response(ProductSerializer(product, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="upload-image", parser_classes=[MultiPartParser, FormParser])
    def upload_image(self, request, pk=None):
        product = self.get_object()
        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"detail": "image file is required."}, status=status.HTTP_400_BAD_REQUEST)
        position = ProductImage.objects.filter(product=product).count()
        image = ProductImage.objects.create(product=product, image=image_file, position=position)
        return Response(ProductImageSerializer(image, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        product = self.get_object()
        if product.status != Product.Status.APPROVED:
            return Response(
                {"detail": "Only approved (live) products can be paused/unpaused."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        product.is_active = not product.is_active
        product.save(update_fields=["is_active"])
        return Response(ProductSerializer(product, context={"request": request}).data)


class VendorProductChangeRequestViewSet(ModelViewSet):
    """Vendor files discount/deal/price-change requests (§6.3). List/create
    only — once filed, the vendor waits for admin action."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        return ProductChangeRequestSerializer if self.action == "list" or self.action == "retrieve" else ProductChangeRequestCreateSerializer

    def get_queryset(self):
        return ProductChangeRequest.objects.filter(vendor=self.request.user).select_related("product")


class VendorStockChangeRequestViewSet(ModelViewSet):
    """Vendor files a restock (stock increase) request (§6.5). List/create
    only — decrements happen automatically elsewhere, no request needed."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        return StockChangeRequestSerializer if self.action in ("list", "retrieve") else StockChangeRequestCreateSerializer

    def get_queryset(self):
        return StockChangeRequest.objects.filter(vendor=self.request.user).select_related("product")


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

class AdminProductViewSet(ModelViewSet):
    """
    §6.2: search/filter the full catalog, edit any product's catalog data,
    and delete (cascades to images/change-requests/stock-requests via FK
    on_delete=CASCADE — no extra cleanup needed here). Creation stays
    vendor-only; approve/reject stay their own actions below so the
    decided_at/admin_notes bookkeeping can't be bypassed by a plain edit.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    # POST is needed for the approve/reject actions below; plain creation
    # (POST to the list endpoint) is blocked explicitly via create() since
    # products can only ever be created by a vendor.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        return AdminProductUpdateSerializer if self.action in ("update", "partial_update") else ProductSerializer

    def create(self, request, *args, **kwargs):
        return Response({"detail": "Products can only be created by a vendor."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def get_queryset(self):
        qs = Product.objects.select_related("vendor", "category").prefetch_related("images").all()

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        category_filter = self.request.query_params.get("category")
        if category_filter:
            qs = qs.filter(category_id=category_filter)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(brand__icontains=search)
                | Q(sku__icontains=search)
                | Q(vendor__username__icontains=search)
                | Q(vendor__email__icontains=search)
                | Q(vendor__first_name__icontains=search)
                | Q(vendor__last_name__icontains=search)
            )

        return qs

    def update(self, request, *args, **kwargs):
        # PATCH-only in practice (see http_method_names) but DRF's generic
        # update() needs a response built from the full-detail serializer
        # so the client gets selling_price/vendor_name back, not just the
        # editable subset.
        super().update(request, *args, **kwargs)
        product = self.get_object()
        return Response(ProductSerializer(product, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        product = self.get_object()
        if product.status != Product.Status.PENDING:
            return Response({"detail": "Only pending products can be approved."}, status=status.HTTP_400_BAD_REQUEST)

        if product.has_category_mismatch:
            resolution_error = self._resolve_category(product, request.data)
            if resolution_error:
                return resolution_error

        product.status = Product.Status.APPROVED
        product.decided_at = timezone.now()
        product.admin_notes = request.data.get("admin_notes", product.admin_notes)
        product.save(update_fields=["status", "decided_at", "admin_notes", "category", "requested_category_name"])
        return Response(ProductSerializer(product, context={"request": request}).data)

    def _resolve_category(self, product, data):
        """
        §6.2: a product submitted under "Other" (no fixed category fit —
        e.g. an electric car listed as a toy) can't go live without a real
        Category. The admin must either:
          - assign an existing category: {"category_id": <id>}, or
          - create a brand-new one on the spot: {"new_category_name": "...",
            "commission_rate_percent": "10.00"} — which also sets that
            category's commission rate immediately, matching the same
            §6.6 CommissionRate mechanism every other category uses.
        Returns a DRF Response describing what's missing if neither was
        given, or None if the product's category was resolved successfully.
        """
        category_id = data.get("category_id")
        new_category_name = (data.get("new_category_name") or "").strip()

        if category_id:
            try:
                category = Category.objects.get(pk=category_id)
            except Category.DoesNotExist:
                return Response({"detail": "That category no longer exists."}, status=status.HTTP_404_NOT_FOUND)
            product.category = category
            product.requested_category_name = ""
            return None

        if new_category_name:
            commission_rate_percent = data.get("commission_rate_percent")
            if commission_rate_percent in (None, ""):
                return Response(
                    {"detail": "Set a commission rate for the new category."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                # request.data delivers this as a string — DecimalField
                # doesn't coerce it in-memory until re-fetched from the DB,
                # so leaving it as-is here would crash the very next read
                # of rate_percent (e.g. in Product.commission_rate_percent).
                commission_rate_percent = Decimal(str(commission_rate_percent))
            except InvalidOperation:
                return Response({"detail": "Commission rate must be a number."}, status=status.HTTP_400_BAD_REQUEST)
            category, _ = Category.objects.get_or_create(name=new_category_name)
            CommissionRate.objects.update_or_create(category=category, defaults={"rate_percent": commission_rate_percent})
            product.category = category
            product.requested_category_name = ""
            return None

        return Response(
            {
                "detail": (
                    f"This product doesn't match an existing category — the vendor requested "
                    f"\"{product.requested_category_name}\". Assign it to an existing category "
                    "(category_id) or create a new one (new_category_name + commission_rate_percent) "
                    "before approving."
                ),
                "requires_category_resolution": True,
                "requested_category_name": product.requested_category_name,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        product = self.get_object()
        if product.status != Product.Status.PENDING:
            return Response({"detail": "Only pending products can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
        product.status = Product.Status.REJECTED
        product.decided_at = timezone.now()
        product.admin_notes = request.data.get("admin_notes", product.admin_notes)
        product.save(update_fields=["status", "decided_at", "admin_notes"])
        return Response(ProductSerializer(product, context={"request": request}).data)


class AdminProductChangeRequestViewSet(ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = ProductChangeRequestSerializer

    def get_queryset(self):
        qs = ProductChangeRequest.objects.select_related("product", "vendor").all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def _apply_to_product(self, change_request):
        product = change_request.product
        if change_request.change_type == ProductChangeRequest.ChangeType.PRICE_CHANGE:
            product.base_price = change_request.new_price
        elif change_request.change_type in (ProductChangeRequest.ChangeType.DISCOUNT, ProductChangeRequest.ChangeType.FLASH_DEAL):
            product.active_discount_percent = change_request.discount_percent
            product.deal_starts_at = change_request.deal_starts_at
            product.deal_ends_at = change_request.deal_ends_at
        elif change_request.change_type == ProductChangeRequest.ChangeType.BOGO:
            product.bogo_eligible = True
        elif change_request.change_type == ProductChangeRequest.ChangeType.GIFT_CARD_ELIGIBLE:
            product.gift_card_eligible = True
        product.save()

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        change_request = self.get_object()
        if change_request.status != ProductChangeRequest.Status.PENDING:
            return Response({"detail": "Only pending requests can be approved."}, status=status.HTTP_400_BAD_REQUEST)
        change_request.status = ProductChangeRequest.Status.APPROVED
        change_request.decided_at = timezone.now()
        change_request.admin_notes = request.data.get("admin_notes", change_request.admin_notes)
        change_request.save(update_fields=["status", "decided_at", "admin_notes"])
        self._apply_to_product(change_request)
        return Response(ProductChangeRequestSerializer(change_request, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        change_request = self.get_object()
        if change_request.status != ProductChangeRequest.Status.PENDING:
            return Response({"detail": "Only pending requests can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
        change_request.status = ProductChangeRequest.Status.REJECTED
        change_request.decided_at = timezone.now()
        change_request.admin_notes = request.data.get("admin_notes", change_request.admin_notes)
        change_request.save(update_fields=["status", "decided_at", "admin_notes"])
        return Response(ProductChangeRequestSerializer(change_request, context={"request": request}).data)


class AdminStockChangeRequestViewSet(ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = StockChangeRequestSerializer

    def get_queryset(self):
        qs = StockChangeRequest.objects.select_related("product", "vendor").all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status != StockChangeRequest.Status.PENDING:
            return Response({"detail": "Only pending requests can be approved."}, status=status.HTTP_400_BAD_REQUEST)
        stock_request.status = StockChangeRequest.Status.APPROVED
        stock_request.decided_at = timezone.now()
        stock_request.admin_notes = request.data.get("admin_notes", stock_request.admin_notes)
        stock_request.save(update_fields=["status", "decided_at", "admin_notes"])

        product = stock_request.product
        product.stock_quantity += stock_request.requested_increase
        product.save(update_fields=["stock_quantity"])

        return Response(StockChangeRequestSerializer(stock_request, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status != StockChangeRequest.Status.PENDING:
            return Response({"detail": "Only pending requests can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
        stock_request.status = StockChangeRequest.Status.REJECTED
        stock_request.decided_at = timezone.now()
        stock_request.admin_notes = request.data.get("admin_notes", stock_request.admin_notes)
        stock_request.save(update_fields=["status", "decided_at", "admin_notes"])
        return Response(StockChangeRequestSerializer(stock_request, context={"request": request}).data)


class AdminCommissionRateView(APIView):
    """§6.6: per-category commission rates — one row per category, falling back to the provisional flat rate until overridden."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        rates_by_category = {r.category_id: r.rate_percent for r in CommissionRate.objects.all()}
        rows = [
            {
                "category_id": category.id,
                "category_name": category.name,
                "rate_percent": rates_by_category.get(category.id, PROVISIONAL_COMMISSION_RATE * 100),
                "is_custom": category.id in rates_by_category,
            }
            for category in Category.objects.all()
        ]
        return Response(CommissionRateSerializer(rows, many=True).data)

    def patch(self, request):
        """Body: {"rates": [{"category_id": 1, "rate_percent": "12.00"}, ...]} — saves every row in one call, matching the reference UI's single "Save Changes" button."""
        updates = request.data.get("rates", [])
        for entry in updates:
            try:
                category_id = int(entry["category_id"])
                rate_percent = entry["rate_percent"]
            except (KeyError, ValueError, TypeError):
                return Response({"detail": "Each rate needs category_id and rate_percent."}, status=status.HTTP_400_BAD_REQUEST)
            if not Category.objects.filter(id=category_id).exists():
                return Response({"detail": f"Category {category_id} not found."}, status=status.HTTP_404_NOT_FOUND)
            CommissionRate.objects.update_or_create(category_id=category_id, defaults={"rate_percent": rate_percent})
        return self.get(request)


class AdminPricingView(generics.ListAPIView):
    """§6.6 Pricing Manager: read-only sale-price/commission/vendor-receives breakdown across the catalog."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = AdminPricingSerializer

    def get_queryset(self):
        qs = Product.objects.select_related("vendor", "category").all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(vendor__username__icontains=search))
        return qs
