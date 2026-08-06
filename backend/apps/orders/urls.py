from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("admin/coupons", views.AdminCouponViewSet, basename="admin-coupon")
router.register("admin/payouts", views.AdminPayoutViewSet, basename="admin-payout")

urlpatterns = [
    path("", views.OrderCreateView.as_view(), name="order-create"),
    path("mine/", views.MyOrdersView.as_view(), name="order-mine"),
    path("track/", views.TrackOrderView.as_view(), name="order-track"),
    path("cancel/", views.OrderCancelView.as_view(), name="order-cancel"),
    path("vendor/", views.VendorOrdersView.as_view(), name="vendor-orders"),
    path("vendor/payouts/", views.VendorPayoutsView.as_view(), name="vendor-payouts"),
    path("vendor/payouts/export/", views.VendorPayoutsExportView.as_view(), name="vendor-payouts-export"),
    path("admin/", views.AdminOrdersView.as_view(), name="admin-orders"),
    path("admin/dashboard/", views.AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/analytics/", views.AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("admin/analytics/export/", views.AdminAnalyticsExportView.as_view(), name="admin-analytics-export"),
    path("admin/<int:pk>/", views.AdminOrderUpdateView.as_view(), name="admin-order-update"),
    path("admin/export/orders/", views.AdminOrdersExportView.as_view(), name="admin-orders-export"),
    path("admin/export/payouts/", views.AdminPayoutsExportView.as_view(), name="admin-payouts-export"),
    path("", include(router.urls)),
]
