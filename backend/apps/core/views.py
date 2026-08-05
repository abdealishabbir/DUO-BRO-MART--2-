"""
Phase 1: a single public health-check endpoint, used to confirm the
Docker Compose stack (Postgres + Redis + Django + React) is wired
correctly end to end before any real feature is built on top of it.

§6.7 adds platform-wide settings on top of that shell.
"""

from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole

from .models import AuditLogEntry, PlatformSettings
from .serializers import AuditLogEntrySerializer, PlatformSettingsSerializer, PublicPlatformSettingsSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "service": "duobromart-backend",
            "phase": "1 — platform shell, routing & role entry",
        }
    )


class AdminSettingsView(APIView):
    """§6.7: admin reads/updates every platform setting."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        return Response(PlatformSettingsSerializer(PlatformSettings.get_solo()).data)

    def patch(self, request):
        settings_obj = PlatformSettings.get_solo()
        serializer = PlatformSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PublicSettingsView(APIView):
    """Storefront/checkout reads the subset it actually needs — e.g. which payment gateways are live right now."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(PublicPlatformSettingsSerializer(PlatformSettings.get_solo()).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def sitemap_xml(request):
    """§8.2: dynamic sitemap — static routes + every approved/active product + category."""
    from django.conf import settings
    from django.http import HttpResponse

    from apps.products.models import Category, Product
    from django.contrib.auth import get_user_model

    base = settings.FRONTEND_URL.rstrip("/")
    entries = []
    # static routes
    entries.append({"loc": base})
    entries.append({"loc": f"{base}/shop"})

    # categories (no lastmod)
    for c in Category.objects.all():
        entries.append({"loc": f"{base}/shop?category={c.slug}"})

    # products (include lastmod if available)
    for p in Product.objects.filter(status=Product.Status.APPROVED, is_active=True).only("slug", "updated_at"):
        loc = f"{base}/product/{p.slug}"
        entry = {"loc": loc}
        if getattr(p, "updated_at", None):
            entry["lastmod"] = p.updated_at.date().isoformat()
        entries.append(entry)

    # vendor storefronts
    User = get_user_model()
    vendors = User.objects.filter(role=User.Role.VENDOR, is_active=True).only("id")
    for v in vendors:
        entries.append({"loc": f"{base}/store/{v.id}"})

    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for e in entries:
        if "lastmod" in e:
            xml.append(f"<url><loc>{e['loc']}</loc><lastmod>{e['lastmod']}</lastmod></url>")
        else:
            xml.append(f"<url><loc>{e['loc']}</loc></url>")
    xml.append("</urlset>")
    return HttpResponse("\n".join(xml), content_type="application/xml")


class AdminAuditLogView(generics.ListAPIView):
    """§8.4: unified admin audit trail — see models.AuditLogEntry for scope."""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = AuditLogEntrySerializer

    def get_queryset(self):
        qs = AuditLogEntry.objects.select_related("actor").all()
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)
        return qs
