"""
RBAC permission classes (PRD §3.1 role hierarchy, §11 non-functional
requirement: "customers only access their own accounts/orders, vendors
only their own products/orders, admins can manage platform-wide state").

Phase 1: these classes exist and are unit-tested against the User.role
field, but nothing calls them yet since there are no protected endpoints
until Phase 2+. Views from Phase 2 onward should combine one role class
with an ownership class where relevant, e.g.:

    permission_classes = [IsAuthenticated, IsVendorRole, IsOwnerVendor]
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsCustomerRole(BasePermission):
    """Grants access only to authenticated users with role=customer."""

    message = "This action is only available to customer accounts."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_customer
        )


class IsVendorRole(BasePermission):
    """Grants access only to authenticated users with role=vendor."""

    message = "This action is only available to approved vendor accounts."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_vendor
        )


class IsAdminRole(BasePermission):
    """
    Grants access only to authenticated users with role=admin.
    This is the platform Admin (§7), distinct from Django's is_staff/
    is_superuser which govern /django-admin/ only.
    """

    message = "This action requires platform admin access."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_platform_admin
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level check: the requesting user must own the object (via an
    `owner_field` attribute the view declares, default "user"), or be a
    platform admin. Used from Phase 2+ for things like:
      - a customer viewing/editing only their own Order/Account
      - a vendor viewing/editing only their own Product/DealRequest
    """

    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_platform_admin:
            return True

        owner_field = getattr(view, "owner_field", "user")
        owner = getattr(obj, owner_field, None)
        return owner is not None and owner == request.user


class ReadOnlyOrIsAdmin(BasePermission):
    """
    Public read access (GET/HEAD/OPTIONS), writes restricted to admin.
    Useful for storefront-facing data admins curate, e.g. Category, Setting.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_platform_admin
        )
