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
