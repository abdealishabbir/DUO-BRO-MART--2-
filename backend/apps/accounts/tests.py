import io

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from .models import Address, EmailVerificationToken, PasswordResetToken, VendorApplication
from .utils import is_locked_out, record_failed_login

User = get_user_model()

VALID_PASSWORD = "Str0ngPass1"


def make_customer(email="alice@example.com", password=VALID_PASSWORD, **extra):
    extra.setdefault("role", User.Role.CUSTOMER)
    extra.setdefault("phone_number", "03001234567")
    user = User(username=email, email=email, **extra)
    user.set_password(password)
    user.save()
    return user


class _ClearsCacheMixin:
    """Lockout counters live in the cache, not the DB, so TestCase's
    transaction rollback doesn't reset them between tests — clear explicitly."""

    def setUp(self):
        super().setUp()
        cache.clear()


class SignupTests(_ClearsCacheMixin, APITestCase):
    def test_signup_creates_user_and_sends_verification_email(self):
        resp = self.client.post(reverse("auth-signup"), {
            "full_name": "Ali Khan",
            "phone_number": "03001234567",
            "email": "ali@example.com",
            "password": VALID_PASSWORD,
            "confirm_password": VALID_PASSWORD,
            "terms_accepted": True,
        })
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(User.objects.filter(email="ali@example.com").exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verify-email", mail.outbox[0].body)
        # login cookies should be set immediately (design decision: no email-verify gate on login)
        self.assertIn("dbm_access", resp.cookies)
        self.assertIn("dbm_refresh", resp.cookies)

    def test_signup_rejects_duplicate_email(self):
        make_customer(email="dupe@example.com")
        resp = self.client.post(reverse("auth-signup"), {
            "full_name": "Dupe User",
            "phone_number": "03001234567",
            "email": "dupe@example.com",
            "password": VALID_PASSWORD,
            "confirm_password": VALID_PASSWORD,
            "terms_accepted": True,
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data)

    def test_signup_rejects_weak_password(self):
        resp = self.client.post(reverse("auth-signup"), {
            "full_name": "Weak Pw",
            "phone_number": "03001234567",
            "email": "weak@example.com",
            "password": "alllowercase1",  # no uppercase
            "confirm_password": "alllowercase1",
            "terms_accepted": True,
        })
        self.assertEqual(resp.status_code, 400)

    def test_signup_rejects_bad_phone_format(self):
        resp = self.client.post(reverse("auth-signup"), {
            "full_name": "Bad Phone",
            "phone_number": "12345",
            "email": "badphone@example.com",
            "password": VALID_PASSWORD,
            "confirm_password": VALID_PASSWORD,
            "terms_accepted": True,
        })
        self.assertEqual(resp.status_code, 400)

    def test_signup_requires_terms_accepted(self):
        resp = self.client.post(reverse("auth-signup"), {
            "full_name": "No Terms",
            "phone_number": "03001234567",
            "email": "noterms@example.com",
            "password": VALID_PASSWORD,
            "confirm_password": VALID_PASSWORD,
            "terms_accepted": False,
        })
        self.assertEqual(resp.status_code, 400)

    def test_signup_requires_matching_passwords(self):
        resp = self.client.post(reverse("auth-signup"), {
            "full_name": "Mismatch",
            "phone_number": "03001234567",
            "email": "mismatch@example.com",
            "password": VALID_PASSWORD,
            "confirm_password": "Different1",
            "terms_accepted": True,
        })
        self.assertEqual(resp.status_code, 400)


class EmailVerificationTests(_ClearsCacheMixin, APITestCase):
    def test_verify_email_marks_user_verified_and_is_single_use(self):
        user = make_customer()
        token = EmailVerificationToken.objects.create(user=user)

        resp = self.client.post(reverse("auth-verify-email", args=[token.token]))
        self.assertEqual(resp.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        # second use of the same token must fail
        resp2 = self.client.post(reverse("auth-verify-email", args=[token.token]))
        self.assertEqual(resp2.status_code, 400)


class LoginTests(_ClearsCacheMixin, APITestCase):
    def test_login_success_sets_cookies_and_returns_user(self):
        make_customer()
        resp = self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn("dbm_access", resp.cookies)
        self.assertIn("dbm_refresh", resp.cookies)
        self.assertEqual(resp.data["user"]["email"], "alice@example.com")

    def test_login_wrong_password_fails(self):
        make_customer()
        resp = self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": "wrong"})
        self.assertEqual(resp.status_code, 400)

    def test_vendor_cannot_login_via_customer_endpoint(self):
        user = make_customer(email="vendor@example.com", role=User.Role.VENDOR)
        resp = self.client.post(reverse("auth-login"), {"email": "vendor@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 400)

    def test_lockout_after_five_failed_attempts(self):
        make_customer()
        for _ in range(5):
            self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": "wrong"})
        self.assertTrue(is_locked_out("alice@example.com"))

        resp = self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 429)

    def test_successful_login_clears_lockout_counter(self):
        make_customer()
        record_failed_login("alice@example.com")
        resp = self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(is_locked_out("alice@example.com"))

    def test_me_endpoint_requires_authentication_cookie(self):
        resp = self.client.get(reverse("account-me"))
        self.assertEqual(resp.status_code, 401)

    def test_me_endpoint_works_after_login(self):
        make_customer()
        self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        resp = self.client.get(reverse("account-me"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "alice@example.com")

    def test_logout_clears_cookies_and_blacklists_refresh(self):
        make_customer()
        self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        resp = self.client.post(reverse("auth-logout"))
        self.assertEqual(resp.status_code, 200)
        # Cookies should be expired/cleared
        self.assertEqual(resp.cookies["dbm_access"].value, "")

        me_resp = self.client.get(reverse("account-me"))
        self.assertEqual(me_resp.status_code, 401)


class ForgotResetPasswordTests(_ClearsCacheMixin, APITestCase):
    def test_forgot_password_generic_response_for_unknown_email(self):
        resp = self.client.post(reverse("auth-forgot-password"), {"email": "nobody@example.com"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)  # no email actually sent, but response looks identical

    def test_forgot_password_sends_email_for_known_user(self):
        make_customer()
        resp = self.client.post(reverse("auth-forgot-password"), {"email": "alice@example.com"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(PasswordResetToken.objects.filter(user__email="alice@example.com").exists())

    def test_reset_password_with_valid_token(self):
        user = make_customer()
        token = PasswordResetToken.objects.create(user=user)

        resp = self.client.post(reverse("auth-reset-password"), {
            "token": token.token,
            "new_password": "NewStr0ngPass1",
            "confirm_password": "NewStr0ngPass1",
        })
        self.assertEqual(resp.status_code, 200)

        user.refresh_from_db()
        self.assertTrue(user.check_password("NewStr0ngPass1"))

    def test_reset_password_token_is_single_use(self):
        user = make_customer()
        token = PasswordResetToken.objects.create(user=user)
        self.client.post(reverse("auth-reset-password"), {
            "token": token.token, "new_password": "NewStr0ngPass1", "confirm_password": "NewStr0ngPass1",
        })
        resp2 = self.client.post(reverse("auth-reset-password"), {
            "token": token.token, "new_password": "AnotherPass2", "confirm_password": "AnotherPass2",
        })
        self.assertEqual(resp2.status_code, 400)

    def test_reset_password_invalidates_existing_sessions(self):
        user = make_customer()
        login_resp = self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        self.assertEqual(login_resp.status_code, 200)

        token = PasswordResetToken.objects.create(user=user)
        self.client.post(reverse("auth-reset-password"), {
            "token": token.token, "new_password": "NewStr0ngPass1", "confirm_password": "NewStr0ngPass1",
        })

        # The refresh token issued at login should now be blacklisted.
        refresh_resp = self.client.post(reverse("auth-refresh"))
        self.assertEqual(refresh_resp.status_code, 401)


class VendorAdminLoginTests(_ClearsCacheMixin, APITestCase):
    def test_vendor_login_success_reports_must_change_password(self):
        make_customer(email="vendor@example.com", role=User.Role.VENDOR, must_change_password=True)
        resp = self.client.post(reverse("auth-vendor-login"), {"email": "vendor@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["user"]["must_change_password"])

    def test_customer_cannot_login_via_vendor_endpoint(self):
        make_customer()
        resp = self.client.post(reverse("auth-vendor-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 400)

    def test_admin_login_success(self):
        make_customer(email="admin@example.com", role=User.Role.ADMIN)
        resp = self.client.post(reverse("auth-admin-login"), {"email": "admin@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 200)

    def test_vendor_cannot_login_via_admin_endpoint(self):
        make_customer(email="vendor2@example.com", role=User.Role.VENDOR)
        resp = self.client.post(reverse("auth-admin-login"), {"email": "vendor2@example.com", "password": VALID_PASSWORD})
        self.assertEqual(resp.status_code, 400)


class ChangePasswordTests(_ClearsCacheMixin, APITestCase):
    def test_change_password_requires_current_password(self):
        make_customer()
        self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})
        resp = self.client.post(reverse("account-change-password"), {
            "current_password": "wrong",
            "new_password": "NewStr0ngPass1",
            "confirm_password": "NewStr0ngPass1",
        })
        self.assertEqual(resp.status_code, 400)

    def test_change_password_success_clears_must_change_flag(self):
        user = make_customer(email="vendor3@example.com", role=User.Role.VENDOR, must_change_password=True)
        self.client.post(reverse("auth-vendor-login"), {"email": "vendor3@example.com", "password": VALID_PASSWORD})
        resp = self.client.post(reverse("account-change-password"), {
            "current_password": VALID_PASSWORD,
            "new_password": "NewStr0ngPass1",
            "confirm_password": "NewStr0ngPass1",
        })
        self.assertEqual(resp.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.must_change_password)


class ProfileAndAddressTests(_ClearsCacheMixin, APITestCase):
    def setUp(self):
        make_customer()
        self.client.post(reverse("auth-login"), {"email": "alice@example.com", "password": VALID_PASSWORD})

    def test_update_profile(self):
        resp = self.client.patch(reverse("account-me"), {"first_name": "Alicia"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["first_name"], "Alicia")

    def test_create_and_list_address(self):
        resp = self.client.post(reverse("address-list"), {
            "label": "Home",
            "full_name": "Alice Khan",
            "phone_number": "03001234567",
            "province": "sindh",
            "city": "Karachi",
            "address_line": "House 12, Street 5",
            "landmark": "Near ABC Masjid",
            "is_default": True,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

        list_resp = self.client.get(reverse("address-list"))
        self.assertEqual(len(list_resp.data["results"] if "results" in list_resp.data else list_resp.data), 1)

    def test_address_isolated_per_user(self):
        other = make_customer(email="bob@example.com")
        Address.objects.create(
            user=other, label="Home", full_name="Bob", phone_number="03001234567",
            province="punjab", city="Lahore", address_line="Street 1",
        )
        resp = self.client.get(reverse("address-list"))
        data = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(data), 0)  # alice sees none of bob's addresses


class GoogleLoginTests(_ClearsCacheMixin, APITestCase):
    def test_google_login_fails_cleanly_when_not_configured(self):
        resp = self.client.post(reverse("auth-google"), {"id_token": "fake"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("isn't configured", resp.data["detail"])


class CreateVendorAccountCommandTests(TestCase):
    def test_command_creates_vendor_with_must_change_password(self):
        from django.core.management import call_command

        call_command("create_vendor_account", "newvendor@example.com", "--name", "Test Vendor")
        user = User.objects.get(email="newvendor@example.com")
        self.assertEqual(user.role, User.Role.VENDOR)
        self.assertTrue(user.must_change_password)
        self.assertEqual(len(mail.outbox), 1)


class SuperuserRoleTests(TestCase):
    def test_createsuperuser_gets_admin_role(self):
        user = User.objects.create_superuser(username="root@example.com", email="root@example.com", password=VALID_PASSWORD)
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertTrue(user.is_platform_admin)


class ThrottleTests(_ClearsCacheMixin, APITestCase):
    """
    throttle_classes is set explicitly on each view (not left to
    settings-derived defaults — see views.py), so it's active in every
    environment including tests. Its rate ("auth-write": "10/min", see
    settings.py) is a plain import-time snapshot inside DRF's own
    SimpleRateThrottle, so overriding it per-test via override_settings
    doesn't work — this test exercises the real configured rate instead.
    """

    def test_auth_endpoints_are_throttled_per_ip_after_ten_requests(self):
        for _ in range(10):
            r = self.client.post(reverse("auth-forgot-password"), {"email": "nobody@example.com"})
            self.assertNotEqual(r.status_code, 429)
        blocked = self.client.post(reverse("auth-forgot-password"), {"email": "nobody@example.com"})
        self.assertEqual(blocked.status_code, 429)


def make_image(name="cnic.png"):
    buf = io.BytesIO()
    Image.new("RGB", (600, 400), color="blue").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def make_admin(email="admin@example.com"):
    admin = User(username=email, email=email, role=User.Role.ADMIN)
    admin.set_password(VALID_PASSWORD)
    admin.save()
    return admin


VALID_APPLICATION = {
    "business_name": "Ali's Store",
    "owner_name": "Ali Khan",
    "email": "ali@example.com",
    "phone_number": "03001234567",
    "business_type": "Retailer",
    "description": "We sell handmade goods.",
    "cnic_number": "42101-1234567-1",
    "bank_name": "HBL",
    "account_title": "Ali Khan",
    "account_number": "1234567890",
    "account_cnic": "42101-1234567-1",
}


class VendorApplicationSubmitTests(_ClearsCacheMixin, APITestCase):
    def test_can_submit_application(self):
        resp = self.client.post(
            reverse("vendor-application-create"),
            {**VALID_APPLICATION, "cnic_front": make_image("front.png"), "cnic_back": make_image("back.png")},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(VendorApplication.objects.count(), 1)
        self.assertEqual(VendorApplication.objects.first().status, VendorApplication.Status.PENDING)

    def test_missing_cnic_images_rejected(self):
        resp = self.client.post(reverse("vendor-application-create"), VALID_APPLICATION, format="multipart")
        self.assertEqual(resp.status_code, 400)


class NewVendorApplicationAlertTests(_ClearsCacheMixin, APITestCase):
    """§6.7/§7.7 admin notification: New Vendor Application toggle."""

    def submit(self):
        return self.client.post(
            reverse("vendor-application-create"),
            {**VALID_APPLICATION, "cnic_front": make_image("front.png"), "cnic_back": make_image("back.png")},
            format="multipart",
        )

    def test_alert_sent_on_submission_by_default(self):
        resp = self.submit()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("New vendor application", mail.outbox[0].subject)

    def test_no_alert_when_notify_new_vendor_applications_disabled(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.notify_new_vendor_applications = False
        settings_obj.save()

        self.submit()
        self.assertEqual(len(mail.outbox), 0)


class AdminVendorApplicationReviewTests(_ClearsCacheMixin, APITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.application = VendorApplication.objects.create(
            **VALID_APPLICATION,
            cnic_front=make_image("front.png"),
            cnic_back=make_image("back.png"),
        )

    def login_as_admin(self):
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_list_pending_applications(self):
        self.login_as_admin()
        resp = self.client.get(reverse("admin-vendor-application-list"), {"status": "pending"})
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]["cnic_matches"])

    def test_cnic_mismatch_flagged(self):
        mismatched = VendorApplication.objects.create(
            **{**VALID_APPLICATION, "email": "other@example.com", "account_cnic": "11111-1111111-1"},
            cnic_front=make_image("front.png"), cnic_back=make_image("back.png"),
        )
        self.assertFalse(mismatched.cnic_matches)

    def test_approve_creates_vendor_account_and_sends_email(self):
        self.login_as_admin()
        resp = self.client.post(reverse("admin-vendor-application-approve", args=[self.application.id]))
        self.assertEqual(resp.status_code, 200, resp.data)

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, VendorApplication.Status.APPROVED)
        self.assertIsNotNone(self.application.created_vendor)

        vendor = self.application.created_vendor
        self.assertEqual(vendor.role, User.Role.VENDOR)
        self.assertTrue(vendor.must_change_password)
        self.assertEqual(len(mail.outbox), 1)

    def test_reject_records_reason_without_creating_account(self):
        self.login_as_admin()
        resp = self.client.post(reverse("admin-vendor-application-reject", args=[self.application.id]), {"admin_notes": "CNIC mismatch"})
        self.assertEqual(resp.status_code, 200, resp.data)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, VendorApplication.Status.REJECTED)
        self.assertEqual(self.application.admin_notes, "CNIC mismatch")
        self.assertIsNone(self.application.created_vendor)

    def test_cannot_decide_twice(self):
        self.login_as_admin()
        self.client.post(reverse("admin-vendor-application-approve", args=[self.application.id]))
        second = self.client.post(reverse("admin-vendor-application-reject", args=[self.application.id]))
        self.assertEqual(second.status_code, 400)

    def test_non_admin_cannot_review(self):
        vendor = make_customer(email="vendor@example.com", role=User.Role.VENDOR)
        self.client.force_authenticate(user=vendor)
        resp = self.client.get(reverse("admin-vendor-application-list"))
        self.assertEqual(resp.status_code, 403)


class AdminVendorListTests(_ClearsCacheMixin, APITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.vendor = make_customer(email="vendor@example.com", role=User.Role.VENDOR, first_name="Ali", last_name="Khan")

    def login_as_admin(self):
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_list_vendors(self):
        self.login_as_admin()
        resp = self.client.get(reverse("admin-vendor-list"))
        self.assertEqual(resp.status_code, 200)
        businesses = [v["business_name"] for v in resp.data]
        self.assertIn("Ali Khan", businesses)

    def test_admin_can_suspend_and_reactivate_vendor(self):
        self.login_as_admin()
        resp = self.client.post(reverse("admin-vendor-suspend", args=[self.vendor.id]), {"action": "suspend"})
        self.assertEqual(resp.status_code, 200)
        self.vendor.refresh_from_db()
        self.assertFalse(self.vendor.is_active)

        resp = self.client.post(reverse("admin-vendor-suspend", args=[self.vendor.id]), {"action": "reactivate"})
        self.assertEqual(resp.status_code, 200)
        self.vendor.refresh_from_db()
        self.assertTrue(self.vendor.is_active)

    def test_suspended_vendor_cannot_log_in(self):
        self.vendor.set_password(VALID_PASSWORD)
        self.vendor.save()
        self.login_as_admin()
        self.client.post(reverse("admin-vendor-suspend", args=[self.vendor.id]), {"action": "suspend"})
        self.client.force_authenticate(user=None)

        resp = self.client.post(reverse("auth-vendor-login"), {"email": "vendor@example.com", "password": VALID_PASSWORD})
        self.assertNotEqual(resp.status_code, 200)

    def test_non_admin_cannot_list_vendors(self):
        self.client.force_authenticate(user=self.vendor)
        resp = self.client.get(reverse("admin-vendor-list"))
        self.assertEqual(resp.status_code, 403)
