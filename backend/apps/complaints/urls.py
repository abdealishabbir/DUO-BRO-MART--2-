from django.urls import path

from . import views

urlpatterns = [
    path("", views.ComplaintCreateView.as_view(), name="complaint-create"),
    path("mine/", views.MyComplaintsView.as_view(), name="complaint-mine"),
    path("admin/", views.AdminComplaintsView.as_view(), name="admin-complaints"),
    path("admin/<int:pk>/", views.AdminComplaintResolveView.as_view(), name="admin-complaint-resolve"),
]
