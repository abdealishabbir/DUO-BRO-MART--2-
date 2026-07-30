"""
Root URL configuration.

Phase 1: only the health check and Django admin are live.
Reserved namespaces (filled in starting Phase 2, per PRD §10.4):
  /api/auth/...        customer/vendor/admin authentication
  /api/home/           home page feed (banners, deals, featured, new arrivals)
  /api/products/       shop listing + filters
  /api/cart/, /api/orders/
  /api/vendor/...
  /api/admin/...
  /api/feedback/, /api/complaints/
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("django-admin/", admin.site.urls),  # Django's own admin, not the platform Admin Panel (that's /api/admin/ + React /admin/*)
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/banners/", include("apps.banners.urls")),
    path("api/products/", include("apps.products.urls")),
    path("api/orders/", include("apps.orders.urls")),
    path("api/feedback/", include("apps.feedback.urls")),
    path("api/complaints/", include("apps.complaints.urls")),
]

# Django's dev server does not serve uploaded media files on its own — this
# wiring is required in DEBUG. In production, a real web server (nginx/S3)
# serves MEDIA_URL directly and this block is skipped entirely.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
