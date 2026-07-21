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

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("django-admin/", admin.site.urls),  # Django's own admin, not the platform Admin Panel (that's /api/admin/ + React /admin/*)
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/banners/", include("apps.banners.urls")),
]
