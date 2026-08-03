from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import PlatformSettings

User = get_user_model()


def make_user(role, email):
    user = User(username=email, email=email, role=role)
    user.set_password("Str0ngPass1")
    user.save()
    return user


class PlatformSettingsTests(APITestCase):
    def setUp(self):
        self.admin = make_user(User.Role.ADMIN, "admin@example.com")
        self.vendor = make_user(User.Role.VENDOR, "vendor@example.com")

    def test_defaults_created_on_first_access(self):
        settings_obj = PlatformSettings.get_solo()
        self.assertEqual(settings_obj.store_name, "Duo Bro Mart")
        self.assertTrue(settings_obj.cod_enabled)

    def test_singleton_always_same_row(self):
        first = PlatformSettings.get_solo()
        first.store_name = "Renamed"
        first.save()
        second = PlatformSettings.get_solo()
        self.assertEqual(second.pk, first.pk)
        self.assertEqual(second.store_name, "Renamed")

    def test_public_endpoint_no_auth_required(self):
        resp = self.client.get(reverse("public-settings"))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("cod_enabled", resp.data)
        self.assertNotIn("notify_new_orders", resp.data)

    def test_admin_can_view_and_update_settings(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(reverse("admin-settings"), {"free_shipping_threshold": "3000.00", "card_enabled": True}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(str(resp.data["free_shipping_threshold"]), "3000.00")
        self.assertTrue(resp.data["card_enabled"])

    def test_non_admin_cannot_view_settings(self):
        self.client.force_authenticate(user=self.vendor)
        resp = self.client.get(reverse("admin-settings"))
        self.assertEqual(resp.status_code, 403)

    def test_anonymous_cannot_view_admin_settings(self):
        resp = self.client.get(reverse("admin-settings"))
        self.assertEqual(resp.status_code, 401)


class AuditLogTests(APITestCase):
    """§8.4: the unified admin audit trail. See models.AuditLogEntry for scope."""

    def setUp(self):
        self.admin = make_user(User.Role.ADMIN, "admin@example.com")
        self.vendor = make_user(User.Role.VENDOR, "vendor@example.com")

    def login_as(self, user):
        self.client.force_authenticate(user=user)

    def test_log_admin_action_creates_entry_with_expected_fields(self):
        from .audit import log_admin_action
        from .models import AuditLogEntry, PlatformSettings

        target = PlatformSettings.get_solo()
        entry = log_admin_action(self.admin, "settings.updated", target, details="changed store_name")

        self.assertEqual(entry.actor, self.admin)
        self.assertEqual(entry.action, "settings.updated")
        self.assertEqual(entry.target_type, "PlatformSettings")
        self.assertEqual(entry.target_id, target.pk)
        self.assertEqual(entry.details, "changed store_name")
        self.assertEqual(AuditLogEntry.objects.count(), 1)

    def test_unauthenticated_actor_is_recorded_as_none_not_crash(self):
        """A defensive case: log_admin_action must never itself become a
        source of 500s if ever called with something that isn't a real
        authenticated user (e.g. AnonymousUser)."""
        from django.contrib.auth.models import AnonymousUser

        from .audit import log_admin_action
        from .models import PlatformSettings

        target = PlatformSettings.get_solo()
        entry = log_admin_action(AnonymousUser(), "settings.updated", target)
        self.assertIsNone(entry.actor)

    def test_admin_can_list_audit_log(self):
        from .audit import log_admin_action
        from .models import PlatformSettings

        log_admin_action(self.admin, "settings.updated", PlatformSettings.get_solo())
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-audit-log"))
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["action"], "settings.updated")

    def test_non_admin_cannot_view_audit_log(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("admin-audit-log"))
        self.assertEqual(resp.status_code, 403)

    def test_anonymous_cannot_view_audit_log(self):
        resp = self.client.get(reverse("admin-audit-log"))
        self.assertEqual(resp.status_code, 401)

    def test_filter_by_action(self):
        from .audit import log_admin_action
        from .models import PlatformSettings

        target = PlatformSettings.get_solo()
        log_admin_action(self.admin, "settings.updated", target)
        log_admin_action(self.admin, "product.approved", target)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-audit-log"), {"action": "product.approved"})
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["action"], "product.approved")

    def test_filter_by_target_type(self):
        from .audit import log_admin_action
        from .models import PlatformSettings

        target = PlatformSettings.get_solo()
        log_admin_action(self.admin, "settings.updated", target)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-audit-log"), {"target_type": "Order"})
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 0)

    def test_actor_name_falls_back_to_username_without_first_last_name(self):
        from .audit import log_admin_action
        from .models import PlatformSettings

        target = PlatformSettings.get_solo()
        log_admin_action(self.admin, "settings.updated", target)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-audit-log"))
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(results[0]["actor_name"], "admin@example.com")


class AuditLogIntegrationTests(APITestCase):
    """Confirms log_admin_action is actually wired into real admin actions
    across every app it was hooked into — not just unit-tested in isolation."""

    def setUp(self):
        self.admin = make_user(User.Role.ADMIN, "admin@example.com")
        self.client.force_authenticate(user=self.admin)

    def test_product_approval_is_logged(self):
        from apps.products.models import Category, Product

        from .models import AuditLogEntry

        vendor = make_user(User.Role.VENDOR, "vendor@example.com")
        category, _ = Category.objects.get_or_create(name="Audit Test Category")
        product = Product.objects.create(
            vendor=vendor, category=category, name="Test Product", description="X", brand="Y",
            base_price=100, stock_quantity=5, status=Product.Status.PENDING,
        )
        self.client.post(reverse("admin-product-approve", args=[product.id]))
        entry = AuditLogEntry.objects.get(action="product.approved", target_id=product.id)
        self.assertEqual(entry.actor, self.admin)
        self.assertEqual(entry.target_type, "Product")

    def test_order_status_change_is_logged_only_when_status_actually_changes(self):
        from decimal import Decimal

        from apps.orders.models import Order

        from .models import AuditLogEntry

        order = Order.objects.create(
            order_code="DBM-AUDIT-1",
            shipping_full_name="A", shipping_phone_number="03001234567", shipping_email="a@example.com",
            shipping_province="sindh", shipping_city="Karachi", shipping_address_line="X",
            subtotal=Decimal("100.00"), shipping_fee=Decimal("0.00"), total=Decimal("100.00"),
        )
        # courier_name-only edit — must NOT create a log entry
        self.client.patch(reverse("admin-order-update", args=[order.id]), {"courier_name": "TCS"}, format="json")
        self.assertEqual(AuditLogEntry.objects.filter(target_type="Order").count(), 0)

        # actual status change — must create exactly one
        self.client.patch(reverse("admin-order-update", args=[order.id]), {"status": "processing"}, format="json")
        entries = AuditLogEntry.objects.filter(target_type="Order", action="order.status_changed")
        self.assertEqual(entries.count(), 1)
        self.assertIn("pending", entries.first().details)
        self.assertIn("processing", entries.first().details)
