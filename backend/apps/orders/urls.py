from django.urls import path

from . import views

urlpatterns = [
    path("", views.OrderCreateView.as_view(), name="order-create"),
    path("mine/", views.MyOrdersView.as_view(), name="order-mine"),
    path("track/", views.TrackOrderView.as_view(), name="order-track"),
    path("vendor/", views.VendorOrdersView.as_view(), name="vendor-orders"),
    path("admin/", views.AdminOrdersView.as_view(), name="admin-orders"),
    path("admin/<int:pk>/", views.AdminOrderUpdateView.as_view(), name="admin-order-update"),
]
