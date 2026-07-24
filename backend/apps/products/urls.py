from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")

vendor_router = DefaultRouter()
vendor_router.register("products", views.VendorProductViewSet, basename="vendor-product")
vendor_router.register("change-requests", views.VendorProductChangeRequestViewSet, basename="vendor-change-request")
vendor_router.register("stock-requests", views.VendorStockChangeRequestViewSet, basename="vendor-stock-request")

admin_router = DefaultRouter()
admin_router.register("products", views.AdminProductViewSet, basename="admin-product")
admin_router.register("change-requests", views.AdminProductChangeRequestViewSet, basename="admin-change-request")
admin_router.register("stock-requests", views.AdminStockChangeRequestViewSet, basename="admin-stock-request")

urlpatterns = [
    path("", include(router.urls)),
    path("vendor/", include(vendor_router.urls)),
    path("admin/", include(admin_router.urls)),
]
