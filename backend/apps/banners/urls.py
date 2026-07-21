from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

vendor_router = DefaultRouter()
vendor_router.register("applications", views.VendorBannerApplicationViewSet, basename="vendor-banner-application")

admin_router = DefaultRouter()
admin_router.register("applications", views.AdminApplicationViewSet, basename="admin-banner-application")
admin_router.register("banners", views.AdminBannerViewSet, basename="admin-banner")

urlpatterns = [
    path("public/carousel/", views.PublicCarouselView.as_view(), name="banner-public-carousel"),

    path("vendor/settings/", views.VendorSettingsView.as_view(), name="banner-vendor-settings"),
    path("vendor/availability/", views.VendorAvailabilityView.as_view(), name="banner-vendor-availability"),
    path("vendor/my-banners/", views.VendorMyBannersView.as_view(), name="banner-vendor-my-banners"),
    path("vendor/", include(vendor_router.urls)),

    path("admin/settings/", views.AdminSettingsView.as_view(), name="banner-admin-settings"),
    path("admin/publish/", views.AdminPublishView.as_view(), name="banner-admin-publish"),
    path("admin/", include(admin_router.urls)),
]
