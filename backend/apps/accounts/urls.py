from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("addresses", views.AddressViewSet, basename="address")

admin_router = DefaultRouter()
admin_router.register("vendor-applications", views.AdminVendorApplicationViewSet, basename="admin-vendor-application")

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
    path("admin/mfa/verify/", views.MFALoginVerifyView.as_view(), name="auth-mfa-verify"),
    path("admin/mfa/status/", views.MFAStatusView.as_view(), name="mfa-status"),
    path("admin/mfa/setup/", views.MFASetupView.as_view(), name="mfa-setup"),
    path("admin/mfa/confirm/", views.MFAConfirmView.as_view(), name="mfa-confirm"),
    path("admin/mfa/disable/", views.MFADisableView.as_view(), name="mfa-disable"),
    path("admin/mfa/recovery-codes/regenerate/", views.MFARegenerateRecoveryCodesView.as_view(), name="mfa-recovery-regenerate"),
]

account_patterns = [
    path("me/", views.MeView.as_view(), name="account-me"),
    path("change-password/", views.ChangePasswordView.as_view(), name="account-change-password"),
    path("", include(router.urls)),
]

admin_patterns = [
    path("vendors/", views.AdminVendorListView.as_view(), name="admin-vendor-list"),
    path("vendors/<int:pk>/suspend/", views.AdminVendorSuspendView.as_view(), name="admin-vendor-suspend"),
    path("", include(admin_router.urls)),
]

urlpatterns = [
    path("auth/", include(auth_patterns)),
    path("account/", include(account_patterns)),
    path("vendor-applications/", views.VendorApplicationCreateView.as_view(), name="vendor-application-create"),
    path("vendors/<int:pk>/store/", views.VendorStorefrontView.as_view(), name="vendor-storefront"),
    path("admin/", include(admin_patterns)),
]
