from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("", views.PublicProductViewSet, basename="product")

vendor_router = DefaultRouter()
vendor_router.register("products", views.VendorProductViewSet, basename="vendor-product")
vendor_router.register("change-requests", views.VendorProductChangeRequestViewSet, basename="vendor-change-request")
vendor_router.register("stock-requests", views.VendorStockChangeRequestViewSet, basename="vendor-stock-request")

admin_router = DefaultRouter()
admin_router.register("products", views.AdminProductViewSet, basename="admin-product")
admin_router.register("change-requests", views.AdminProductChangeRequestViewSet, basename="admin-change-request")
admin_router.register("stock-requests", views.AdminStockChangeRequestViewSet, basename="admin-stock-request")

urlpatterns = [
    # Must come before the root router include below — PublicProductViewSet's
    # slug-based detail route ("<slug>/") is registered at the empty prefix
    # and would otherwise swallow "wishlist/..." as if it were a product slug.
    path("wishlist/ids/", views.WishlistIdsView.as_view(), name="wishlist-ids"),
    path("wishlist/toggle/", views.WishlistToggleView.as_view(), name="wishlist-toggle"),
    path("wishlist/", views.WishlistListView.as_view(), name="wishlist-list"),
    path("search-suggestions/", views.SearchSuggestionsView.as_view(), name="search-suggestions"),
    path("", include(router.urls)),
    path("vendor/analytics/", views.VendorAnalyticsView.as_view(), name="vendor-analytics"),
    path("vendor/analytics/export/", views.VendorAnalyticsExportView.as_view(), name="vendor-analytics-export"),
    path("vendor/", include(vendor_router.urls)),
    path("admin/commission-rates/", views.AdminCommissionRateView.as_view(), name="admin-commission-rates"),
    path("admin/pricing/", views.AdminPricingView.as_view(), name="admin-pricing"),
    path("admin/", include(admin_router.urls)),
]
