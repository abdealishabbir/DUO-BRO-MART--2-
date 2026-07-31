from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("admin/coupons", views.AdminCouponViewSet, basename="admin-coupon")

urlpatterns = [
    path("", views.OrderCreateView.as_view(), name="order-create"),
    path("mine/", views.MyOrdersView.as_view(), name="order-mine"),
    path("track/", views.TrackOrderView.as_view(), name="order-track"),
    path("vendor/", views.VendorOrdersView.as_view(), name="vendor-orders"),
    path("admin/", views.AdminOrdersView.as_view(), name="admin-orders"),
    path("admin/dashboard/", views.AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/<int:pk>/", views.AdminOrderUpdateView.as_view(), name="admin-order-update"),
    path("", include(router.urls)),
]
