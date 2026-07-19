from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("addresses", views.AddressViewSet, basename="address")

auth_patterns = [
    path("signup/", views.SignupView.as_view(), name="auth-signup"),
    path("verify-email/<str:token>/", views.VerifyEmailView.as_view(), name="auth-verify-email"),
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("google/", views.GoogleLoginView.as_view(), name="auth-google"),
    path("forgot-password/", views.ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("reset-password/", views.ResetPasswordView.as_view(), name="auth-reset-password"),
    path("vendor/login/", views.VendorLoginView.as_view(), name="auth-vendor-login"),
    path("admin/login/", views.AdminLoginView.as_view(), name="auth-admin-login"),
]

account_patterns = [
    path("me/", views.MeView.as_view(), name="account-me"),
    path("change-password/", views.ChangePasswordView.as_view(), name="account-change-password"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("auth/", include(auth_patterns)),
    path("account/", include(account_patterns)),
]
