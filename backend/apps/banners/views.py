"""
See models.py module docstring for the full business-rule writeup this
implements. Endpoint map:

  Public:  GET  /api/banners/public/carousel/
  Vendor:  GET  /api/banners/vendor/settings/
           GET  /api/banners/vendor/availability/
           GET  /api/banners/vendor/applications/      POST (create)
           GET  /api/banners/vendor/applications/<id>/
           GET  /api/banners/vendor/my-banners/
  Admin:   GET/PATCH /api/banners/admin/settings/
           GET  /api/banners/admin/applications/?status=pending
           POST /api/banners/admin/applications/<id>/approve/
           POST /api/banners/admin/applications/<id>/reject/
           POST /api/banners/admin/publish/
           GET  /api/banners/admin/banners/
           POST /api/banners/admin/banners/<id>/record-payment/
           POST /api/banners/admin/banners/<id>/suspend/
"""

from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsVendorRole
from apps.core.audit import log_admin_action

from .models import Banner, BannerApplication, BannerPayment, PlatformSettings
from .serializers import (
    BannerApplicationCreateSerializer,
    BannerApplicationSerializer,
    BannerSerializer,
    PlatformSettingsSerializer,
    PublicBannerSerializer,
)

User = get_user_model()

# Statuses that currently occupy one of the limited carousel slots.
SLOT_OCCUPYING_BANNER_STATUSES = [Banner.Status.AWAITING_PAYMENT, Banner.Status.SCHEDULED, Banner.Status.LIVE]


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------

class PublicCarouselView(APIView):
    """Home page hero carousel — only genuinely live-today banners, real-time."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        today = timezone.localdate()
        settings_row = PlatformSettings.get_solo()
        banners = (
            Banner.objects.filter(status=Banner.Status.LIVE, live_start_date__lte=today, live_end_date__gte=today)
            .order_by("slot_position")[: settings_row.carousel_slot_limit]
        )
        return Response(PublicBannerSerializer(banners, many=True, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Vendor
# ---------------------------------------------------------------------------

class VendorSettingsView(APIView):
    """Read-only view of the current price/day and slot limit for the application form."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]

    def get(self, request):
        return Response(PlatformSettingsSerializer(PlatformSettings.get_solo()).data)


class VendorAvailabilityView(APIView):
    """Tells the application form whether a slot is free right now, and if
    not, the soonest date one is expected to open up."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]

    def get(self, request):
        settings_row = PlatformSettings.get_solo()
        occupying = Banner.objects.filter(status__in=SLOT_OCCUPYING_BANNER_STATUSES)
        occupied_count = occupying.count()
        slots_available = max(settings_row.carousel_slot_limit - occupied_count, 0)

        next_available_date = None
        if slots_available == 0:
            soonest_ending = (
                occupying.exclude(live_end_date__isnull=True).order_by("live_end_date").first()
            )
            base_date = soonest_ending.live_end_date if soonest_ending else timezone.localdate()
            next_available_date = base_date + timedelta(days=1)

        return Response({
            "carousel_slot_limit": settings_row.carousel_slot_limit,
            "slots_occupied": occupied_count,
            "slots_available": slots_available,
            "next_available_date": next_available_date,
        })


class VendorBannerApplicationViewSet(viewsets.ModelViewSet):
    """Vendor create + view of their own applications. No update/delete —
    once submitted, a vendor waits for admin action (matches the PRD's
    approval-flow pattern used elsewhere)."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]
    http_method_names = ["get", "post", "head", "options"]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        return BannerApplicationCreateSerializer if self.action == "create" else BannerApplicationSerializer

    def get_queryset(self):
        return BannerApplication.objects.filter(vendor=self.request.user)


class VendorMyBannersView(APIView):
    """Real-time payment/penalty status for the vendor's own banner(s) — §2.5-style self-service view."""

    permission_classes = [permissions.IsAuthenticated, IsVendorRole]

    def get(self, request):
        banners = Banner.objects.filter(vendor=request.user).prefetch_related("payments")
        return Response(BannerSerializer(banners, many=True, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

class AdminSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        return Response(PlatformSettingsSerializer(PlatformSettings.get_solo()).data)

    def patch(self, request):
        obj = PlatformSettings.get_solo()
        serializer = PlatformSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = BannerApplicationSerializer

    def get_queryset(self):
        qs = BannerApplication.objects.select_related("vendor").all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        application = self.get_object()
        if application.status != BannerApplication.Status.PENDING:
            return Response({"detail": "Only pending applications can be approved."}, status=status.HTTP_400_BAD_REQUEST)
        application.status = BannerApplication.Status.APPROVED
        application.decided_at = timezone.now()
        application.admin_notes = request.data.get("admin_notes", application.admin_notes)
        application.save(update_fields=["status", "decided_at", "admin_notes"])
        log_admin_action(request.user, "banner_application.approved", application)
        return Response(BannerApplicationSerializer(application, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        application = self.get_object()
        if application.status != BannerApplication.Status.PENDING:
            return Response({"detail": "Only pending applications can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
        application.status = BannerApplication.Status.REJECTED
        application.decided_at = timezone.now()
        application.admin_notes = request.data.get("admin_notes", application.admin_notes)
        application.save(update_fields=["status", "decided_at", "admin_notes"])
        log_admin_action(request.user, "banner_application.rejected", application, details=application.admin_notes)
        return Response(BannerApplicationSerializer(application, context={"request": request}).data)


class AdminPublishView(APIView):
    """
    Turns an APPROVED application into a live-tracking Banner. Admin may
    override the vendor's submitted image/headline/CTA here (§ "he will
    upload photo text cta and slot"), and must choose the slot position.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        application_id = request.data.get("application_id")
        try:
            application = BannerApplication.objects.get(pk=application_id, status=BannerApplication.Status.APPROVED)
        except BannerApplication.DoesNotExist:
            return Response({"detail": "No approved application with that id."}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(application, "banner"):
            return Response({"detail": "This application has already been published."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            slot_position = int(request.data.get("slot_position"))
        except (TypeError, ValueError):
            return Response({"detail": "slot_position is required."}, status=status.HTTP_400_BAD_REQUEST)

        settings_row = PlatformSettings.get_solo()
        occupied = Banner.objects.filter(
            status__in=SLOT_OCCUPYING_BANNER_STATUSES, slot_position=slot_position
        ).exists()
        if slot_position < 1 or slot_position > settings_row.carousel_slot_limit:
            return Response({"detail": f"slot_position must be between 1 and {settings_row.carousel_slot_limit}."}, status=status.HTTP_400_BAD_REQUEST)
        if occupied:
            return Response({"detail": "That slot is already occupied."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        is_prepaid = application.payment_type == BannerApplication.PaymentType.PREPAID

        banner = Banner.objects.create(
            application=application,
            vendor=application.vendor,
            image=request.FILES.get("image") or application.image,
            headline=request.data.get("headline") or application.headline,
            description=request.data.get("description", application.description),
            cta_label=request.data.get("cta_label") or application.cta_label,
            cta_url=request.data.get("cta_url") or application.cta_url,
            slot_position=slot_position,
            payment_type=application.payment_type,
            price_per_day=application.price_per_day_snapshot,
            days=application.requested_days,
            total_price=application.total_price,
            status=Banner.Status.AWAITING_PAYMENT if is_prepaid else Banner.Status.SCHEDULED,
            live_start_date=None if is_prepaid else today + timedelta(days=1),
            live_end_date=None if is_prepaid else today + timedelta(days=application.requested_days),
        )
        return Response(BannerSerializer(banner, context={"request": request}).data, status=status.HTTP_201_CREATED)


class AdminBannerViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = BannerSerializer

    def get_queryset(self):
        return Banner.objects.select_related("vendor").prefetch_related("payments").all()

    @action(detail=True, methods=["post"], url_path="record-payment")
    def record_payment(self, request, pk=None):
        banner = self.get_object()
        try:
            amount = Decimal(str(request.data.get("amount")))
            assert amount > 0
        except (TypeError, ValueError, InvalidOperation, AssertionError):
            return Response({"detail": "amount must be a positive number."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            BannerPayment.objects.create(
                banner=banner, amount=amount, note=request.data.get("note", ""), recorded_by=request.user,
            )
            banner.paid_amount = banner.paid_amount + amount
            today = timezone.localdate()

            # Prepaid: full payment received -> schedule to go live tomorrow.
            if banner.status == Banner.Status.AWAITING_PAYMENT and banner.paid_amount >= banner.total_price:
                banner.status = Banner.Status.SCHEDULED
                banner.live_start_date = today + timedelta(days=1)
                banner.live_end_date = banner.live_start_date + timedelta(days=banner.days - 1)

            # Postpaid, already overdue: fully settling total + accrued penalty closes it out.
            elif banner.status == Banner.Status.OVERDUE and banner.paid_amount >= (banner.total_price + banner.penalty_amount):
                banner.status = Banner.Status.COMPLETED

            banner.save()

        return Response(BannerSerializer(banner, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        """Manual override — the daily job also does this automatically at the 3-day-overdue mark."""
        banner = self.get_object()
        banner.status = Banner.Status.SUSPENDED
        banner.save(update_fields=["status"])
        banner.vendor.is_active = False
        banner.vendor.save(update_fields=["is_active"])
        return Response(BannerSerializer(banner, context={"request": request}).data)
