"""
Phase 1: a single public health-check endpoint, used to confirm the
Docker Compose stack (Postgres + Redis + Django + React) is wired
correctly end to end before any real feature is built on top of it.

§6.7 adds platform-wide settings on top of that shell.
"""

from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole

from .models import PlatformSettings
from .serializers import PlatformSettingsSerializer, PublicPlatformSettingsSerializer


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

    base = settings.FRONTEND_URL.rstrip("/")
    urls = [base, f"{base}/shop"]
    urls += [f"{base}/shop?category={c.slug}" for c in Category.objects.all()]
    urls += [
        f"{base}/product/{p.slug}"
        for p in Product.objects.filter(status=Product.Status.APPROVED, is_active=True).only("slug")
    ]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f"<url><loc>{u}</loc></url>" for u in urls]
    xml.append("</urlset>")
    return HttpResponse("\n".join(xml), content_type="application/xml")
