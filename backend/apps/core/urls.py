from django.urls import path

from .views import AdminSettingsView, PublicSettingsView, health_check

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("settings/admin/", AdminSettingsView.as_view(), name="admin-settings"),
    path("settings/public/", PublicSettingsView.as_view(), name="public-settings"),
]
