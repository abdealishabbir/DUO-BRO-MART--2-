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
    """§8.2: dynamic sitemap — static routes + every approved/active product,
    category with at least one visible product, and active vendor storefronts.

    This makes the site properly crawlable/indexable by Google (which does
    render JS and reads this sitemap to prioritise what to crawl). It does NOT
    fix link-preview cards on WhatsApp/Facebook/Twitter — those crawlers fetch
    raw HTML without running JS, so they always see the single static index.html.
    Fixing that needs server-side rendering or prerendering — tracked in
    DEFERRED_ITEMS.md as a separate, larger piece of work.
    """
    from django.conf import settings
    from django.http import HttpResponse

    from django.contrib.auth import get_user_model
    from apps.products.models import Category, Product

    base = settings.FRONTEND_URL.rstrip("/")
    entries = []

    # static routes
    entries.append({"loc": base, "priority": "1.0"})
    entries.append({"loc": f"{base}/shop", "priority": "0.9"})

    # Only categories that actually have visible products — an empty
    # category page wastes crawl budget and misleads search engines.
    categories_with_products = Category.objects.filter(
        products__status=Product.Status.APPROVED, products__is_active=True
    ).distinct()
    # "categories" (plural) matches what Shop.jsx's filtersFromParams reads.
    # ?category= (singular) is silently ignored by the Shop page.
    for c in categories_with_products:
        entries.append({"loc": f"{base}/shop?categories={c.slug}", "priority": "0.5"})

    # products with lastmod for freshness signals
    for p in Product.objects.filter(status=Product.Status.APPROVED, is_active=True).only("slug", "updated_at"):
        entry = {"loc": f"{base}/product/{p.slug}", "priority": "0.7"}
        if getattr(p, "updated_at", None):
            entry["lastmod"] = p.updated_at.date().isoformat()
        entries.append(entry)

    # Only vendors who have at least one live product — a storefront page
    # with zero products is not a useful index entry.
    User = get_user_model()
    active_vendor_ids = (
        Product.objects.filter(status=Product.Status.APPROVED, is_active=True)
        .values_list("vendor_id", flat=True)
        .distinct()
    )
    vendors = User.objects.filter(id__in=active_vendor_ids, role=User.Role.VENDOR, is_active=True)
    for v in vendors:
        entries.append({"loc": f"{base}/store/{v.id}", "priority": "0.6"})

    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for e in entries:
        parts = [f"<loc>{e['loc']}</loc>"]
        if "lastmod" in e:
            parts.append(f"<lastmod>{e['lastmod']}</lastmod>")
        if "priority" in e:
            parts.append(f"<priority>{e['priority']}</priority>")
        xml.append(f"<url>{''.join(parts)}</url>")
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
