"""
See models.py module docstring for the full business-rule writeup this
implements. Endpoint map:

  Public:  GET  /api/products/categories/

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
"""

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.accounts.permissions import IsAdminRole, IsVendorRole, ReadOnlyOrIsAdmin

from .models import Category, Product, ProductChangeRequest, ProductImage, StockChangeRequest
from .serializers import (
    AdminProductUpdateSerializer,
    CategorySerializer,
    ProductChangeRequestCreateSerializer,
    ProductChangeRequestSerializer,
    ProductCreateSerializer,
    ProductImageSerializer,
    ProductSerializer,
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


# ---------------------------------------------------------------------------
# Vendor
# ---------------------------------------------------------------------------

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
        product.status = Product.Status.APPROVED
        product.decided_at = timezone.now()
        product.admin_notes = request.data.get("admin_notes", product.admin_notes)
        product.save(update_fields=["status", "decided_at", "admin_notes"])
        return Response(ProductSerializer(product, context={"request": request}).data)

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
