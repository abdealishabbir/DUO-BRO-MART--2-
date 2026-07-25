import io
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from .models import Banner, BannerApplication, PlatformSettings

User = get_user_model()


def make_image():
    buf = io.BytesIO()
    Image.new("RGB", (1600, 500), color="red").save(buf, format="PNG")
    return SimpleUploadedFile("test.png", buf.getvalue(), content_type="image/png")


def make_user(role, email, **extra):
    user = User(username=email, email=email, role=role, **extra)
    user.set_password("Str0ngPass1")
    user.save()
    return user


class BannerTestBase(APITestCase):
    def setUp(self):
        self.vendor = make_user(User.Role.VENDOR, "vendor@example.com")
        self.admin = make_user(User.Role.ADMIN, "admin@example.com")
        PlatformSettings.objects.create(pk=1, banner_price_per_day=Decimal("200.00"), carousel_slot_limit=5)

    def login_as(self, user):
        self.client.force_authenticate(user=user)


class VendorApplicationTests(BannerTestBase):
    def test_vendor_can_submit_application_with_price_snapshot(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-banner-application-list"), {
            "image": make_image(),
            "headline": "Big Eid Sale",
            "description": "50% off",
            "cta_label": "Shop Now",
            "cta_url": "/shop",
            "requested_days": 7,
            "payment_type": "postpaid",
        }, format="multipart")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["price_per_day_snapshot"], "200.00")
        self.assertEqual(resp.data["total_price"], "1400.00")
        self.assertEqual(resp.data["status"], "pending")

    def test_wrong_dimensions_rejected(self):
        self.login_as(self.vendor)
        buf = io.BytesIO()
        Image.new("RGB", (800, 300), color="blue").save(buf, format="PNG")
        wrong_size_image = SimpleUploadedFile("wrong.png", buf.getvalue(), content_type="image/png")
        resp = self.client.post(reverse("vendor-banner-application-list"), {
            "image": wrong_size_image, "headline": "x", "cta_url": "/x",
            "requested_days": 2, "payment_type": "prepaid",
        }, format="multipart")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("1600x500", str(resp.data))

    def test_correct_dimensions_accepted(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-banner-application-list"), {
            "image": make_image(), "headline": "x", "cta_url": "/x",
            "requested_days": 2, "payment_type": "prepaid",
        }, format="multipart")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_non_png_jpeg_format_rejected(self):
        self.login_as(self.vendor)
        buf = io.BytesIO()
        Image.new("RGB", (1600, 500), color="green").save(buf, format="BMP")
        bmp_image = SimpleUploadedFile("test.bmp", buf.getvalue(), content_type="image/bmp")
        resp = self.client.post(reverse("vendor-banner-application-list"), {
            "image": bmp_image, "headline": "x", "cta_url": "/x",
            "requested_days": 2, "payment_type": "prepaid",
        }, format="multipart")
        self.assertEqual(resp.status_code, 400)

    def test_vendor_sees_only_own_applications(self):
        other_vendor = make_user(User.Role.VENDOR, "other@example.com")
        BannerApplication.objects.create(
            vendor=other_vendor, image=make_image(), headline="Other", cta_url="/x",
            requested_days=3, payment_type="prepaid", price_per_day_snapshot=200, total_price=600,
        )
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-banner-application-list"))
        self.assertEqual(len(resp.data["results"] if "results" in resp.data else resp.data), 0)

    def test_customer_cannot_submit_application(self):
        customer = make_user(User.Role.CUSTOMER, "cust@example.com")
        self.login_as(customer)
        resp = self.client.post(reverse("vendor-banner-application-list"), {
            "image": make_image(), "headline": "x", "cta_url": "/x", "requested_days": 1, "payment_type": "prepaid",
        }, format="multipart")
        self.assertEqual(resp.status_code, 403)

    def test_requested_days_over_90_rejected(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-banner-application-list"), {
            "image": make_image(), "headline": "x", "cta_url": "/x", "requested_days": 91, "payment_type": "prepaid",
        }, format="multipart")
        self.assertEqual(resp.status_code, 400)


class VendorAvailabilityTests(BannerTestBase):
    def test_availability_full_when_slots_used(self):
        PlatformSettings.objects.filter(pk=1).update(carousel_slot_limit=1)
        app = BannerApplication.objects.create(
            vendor=self.vendor, image=make_image(), headline="A", cta_url="/x",
            requested_days=5, payment_type="postpaid", price_per_day_snapshot=200, total_price=1000,
            status=BannerApplication.Status.APPROVED,
        )
        Banner.objects.create(
            application=app, vendor=self.vendor, image=make_image(), headline="A", cta_url="/x",
            slot_position=1, payment_type="postpaid", price_per_day=200, days=5, total_price=1000,
            status=Banner.Status.LIVE,
            live_start_date=timezone.localdate(), live_end_date=timezone.localdate() + timedelta(days=4),
        )
        self.login_as(self.vendor)
        resp = self.client.get(reverse("banner-vendor-availability"))
        self.assertEqual(resp.data["slots_available"], 0)
        self.assertIsNotNone(resp.data["next_available_date"])


class AdminApprovalPublishTests(BannerTestBase):
    def setUp(self):
        super().setUp()
        self.application = BannerApplication.objects.create(
            vendor=self.vendor, image=make_image(), headline="Eid Sale", cta_url="/shop",
            requested_days=7, payment_type=BannerApplication.PaymentType.POSTPAID,
            price_per_day_snapshot=200, total_price=1400,
        )

    def test_admin_approve_then_publish_postpaid_schedules_for_tomorrow(self):
        self.login_as(self.admin)
        approve_resp = self.client.post(reverse("admin-banner-application-approve", args=[self.application.id]))
        self.assertEqual(approve_resp.status_code, 200)

        publish_resp = self.client.post(reverse("banner-admin-publish"), {
            "application_id": self.application.id, "slot_position": 1,
        }, format="multipart")
        self.assertEqual(publish_resp.status_code, 201, publish_resp.data)
        self.assertEqual(publish_resp.data["status"], "scheduled")
        self.assertEqual(publish_resp.data["live_start_date"], str(timezone.localdate() + timedelta(days=1)))

    def test_publish_rejects_non_approved_application(self):
        self.login_as(self.admin)
        resp = self.client.post(reverse("banner-admin-publish"), {
            "application_id": self.application.id, "slot_position": 1,
        }, format="multipart")
        self.assertEqual(resp.status_code, 400)

    def test_publish_prepaid_awaits_payment_not_scheduled(self):
        self.application.payment_type = BannerApplication.PaymentType.PREPAID
        self.application.save()
        self.login_as(self.admin)
        self.client.post(reverse("admin-banner-application-approve", args=[self.application.id]))
        resp = self.client.post(reverse("banner-admin-publish"), {
            "application_id": self.application.id, "slot_position": 1,
        }, format="multipart")
        self.assertEqual(resp.data["status"], "awaiting_payment")
        self.assertIsNone(resp.data["live_start_date"])

    def test_cannot_publish_to_occupied_slot(self):
        self.login_as(self.admin)
        self.client.post(reverse("admin-banner-application-approve", args=[self.application.id]))
        self.client.post(reverse("banner-admin-publish"), {"application_id": self.application.id, "slot_position": 1}, format="multipart")

        app2 = BannerApplication.objects.create(
            vendor=self.vendor, image=make_image(), headline="B", cta_url="/x",
            requested_days=3, payment_type="postpaid", price_per_day_snapshot=200, total_price=600,
            status=BannerApplication.Status.APPROVED,
        )
        resp = self.client.post(reverse("banner-admin-publish"), {"application_id": app2.id, "slot_position": 1}, format="multipart")
        self.assertEqual(resp.status_code, 400)

    def test_vendor_cannot_approve_applications(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("admin-banner-application-approve", args=[self.application.id]))
        self.assertEqual(resp.status_code, 403)


class PrepaidPaymentFlowTests(BannerTestBase):
    def setUp(self):
        super().setUp()
        app = BannerApplication.objects.create(
            vendor=self.vendor, image=make_image(), headline="Prepaid Promo", cta_url="/shop",
            requested_days=5, payment_type=BannerApplication.PaymentType.PREPAID,
            price_per_day_snapshot=200, total_price=1000, status=BannerApplication.Status.APPROVED,
            decided_at=timezone.now(),
        )
        self.banner = Banner.objects.create(
            application=app, vendor=self.vendor, image=make_image(), headline="Prepaid Promo", cta_url="/shop",
            slot_position=1, payment_type="prepaid", price_per_day=200, days=5, total_price=1000,
            status=Banner.Status.AWAITING_PAYMENT,
        )

    def test_partial_payment_does_not_go_live(self):
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-banner-record-payment", args=[self.banner.id]), {"amount": 400})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "awaiting_payment")
        self.assertEqual(resp.data["remaining_amount"], "600.00")

    def test_full_payment_schedules_for_tomorrow(self):
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-banner-record-payment", args=[self.banner.id]), {"amount": 1000})
        self.assertEqual(resp.data["status"], "scheduled")
        self.assertEqual(resp.data["live_start_date"], str(timezone.localdate() + timedelta(days=1)))
        self.assertEqual(resp.data["remaining_amount"], "0.00")

    def test_prepaid_penalty_always_zero(self):
        self.assertEqual(self.banner.penalty_amount, Decimal("0.00"))

    def test_stale_unpaid_prepaid_auto_cancelled_after_grace_period(self):
        self.banner.application.decided_at = timezone.now() - timedelta(days=4)
        self.banner.application.save()
        call_command("process_banner_billing")
        self.banner.refresh_from_db()
        self.assertEqual(self.banner.status, Banner.Status.CANCELLED)


class PostpaidPenaltySuspensionTests(BannerTestBase):
    def _make_live_banner(self, days_ago_ended, paid=Decimal("0.00")):
        app = BannerApplication.objects.create(
            vendor=self.vendor, image=make_image(), headline="Postpaid Promo", cta_url="/shop",
            requested_days=7, payment_type=BannerApplication.PaymentType.POSTPAID,
            price_per_day_snapshot=200, total_price=1400, status=BannerApplication.Status.APPROVED,
        )
        end_date = timezone.localdate() - timedelta(days=days_ago_ended)
        return Banner.objects.create(
            application=app, vendor=self.vendor, image=make_image(), headline="Postpaid Promo", cta_url="/shop",
            slot_position=1, payment_type="postpaid", price_per_day=200, days=7, total_price=1400,
            status=Banner.Status.LIVE, paid_amount=paid,
            live_start_date=end_date - timedelta(days=6), live_end_date=end_date,
        )

    def test_no_penalty_while_still_within_live_window(self):
        banner = self._make_live_banner(days_ago_ended=-2)  # ends 2 days from now
        self.assertEqual(banner.penalty_amount, Decimal("0.00"))
        self.assertFalse(banner.is_past_due)

    def test_penalty_accrues_after_due_date_if_unpaid(self):
        banner = self._make_live_banner(days_ago_ended=1)  # due yesterday, unpaid
        self.assertEqual(banner.days_overdue, 1)
        self.assertEqual(banner.penalty_amount, Decimal("100.00"))
        self.assertEqual(banner.remaining_amount, Decimal("1500.00"))  # 1400 + 100

    def test_penalty_caps_and_no_penalty_if_paid(self):
        banner = self._make_live_banner(days_ago_ended=10, paid=Decimal("1400.00"))
        self.assertEqual(banner.days_overdue, 0)  # paid in full -> no penalty regardless of lateness
        self.assertEqual(banner.penalty_amount, Decimal("0.00"))

    def test_daily_job_flags_overdue_and_suspends_at_day_three(self):
        banner = self._make_live_banner(days_ago_ended=1)
        call_command("process_banner_billing")
        banner.refresh_from_db()
        self.assertEqual(banner.status, Banner.Status.OVERDUE)
        self.vendor.refresh_from_db()
        self.assertTrue(self.vendor.is_active)  # not suspended yet, only 1 day overdue

        # Push it to day 3 overdue and run again.
        banner.live_end_date = timezone.localdate() - timedelta(days=3)
        banner.save()
        call_command("process_banner_billing")
        banner.refresh_from_db()
        self.vendor.refresh_from_db()
        self.assertEqual(banner.status, Banner.Status.SUSPENDED)
        self.assertFalse(self.vendor.is_active)

    def test_suspended_vendor_cannot_log_in(self):
        banner = self._make_live_banner(days_ago_ended=3)
        call_command("process_banner_billing")
        self.vendor.refresh_from_db()
        self.assertFalse(self.vendor.is_active)

        resp = self.client.post(reverse("auth-vendor-login"), {"email": "vendor@example.com", "password": "Str0ngPass1"})
        self.assertEqual(resp.status_code, 400)

    def test_admin_manual_suspend_override(self):
        banner = self._make_live_banner(days_ago_ended=1)
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-banner-suspend", args=[banner.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "suspended")
        self.vendor.refresh_from_db()
        self.assertFalse(self.vendor.is_active)

    def test_settling_overdue_balance_marks_completed(self):
        banner = self._make_live_banner(days_ago_ended=1)  # owes 1400 + 100 penalty = 1500
        call_command("process_banner_billing")  # flips to OVERDUE
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-banner-record-payment", args=[banner.id]), {"amount": 1500})
        self.assertEqual(resp.data["status"], "completed")


class PublicCarouselTests(BannerTestBase):
    def test_only_currently_live_banners_shown(self):
        today = timezone.localdate()

        def make_banner(status, start, end, slot):
            app = BannerApplication.objects.create(
                vendor=self.vendor, image=make_image(), headline=f"Slot {slot}", cta_url="/x",
                requested_days=5, payment_type="postpaid", price_per_day_snapshot=200, total_price=1000,
            )
            return Banner.objects.create(
                application=app, vendor=self.vendor, image=make_image(), headline=f"Slot {slot}", cta_url="/x",
                slot_position=slot, payment_type="postpaid", price_per_day=200, days=5, total_price=1000,
                status=status, live_start_date=start, live_end_date=end,
            )

        make_banner(Banner.Status.LIVE, today - timedelta(days=1), today + timedelta(days=3), slot=1)  # currently live
        make_banner(Banner.Status.SCHEDULED, today + timedelta(days=1), today + timedelta(days=5), slot=2)  # not yet
        make_banner(Banner.Status.OVERDUE, today - timedelta(days=10), today - timedelta(days=3), slot=3)  # expired
        make_banner(Banner.Status.LIVE, today - timedelta(days=1), today + timedelta(days=3), slot=4)  # currently live

        resp = self.client.get(reverse("banner-public-carousel"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)
        slots = sorted(b["slot_position"] for b in resp.data)
        self.assertEqual(slots, [1, 4])

    def test_carousel_respects_slot_limit(self):
        PlatformSettings.objects.filter(pk=1).update(carousel_slot_limit=2)
        today = timezone.localdate()
        for i in range(1, 5):
            app = BannerApplication.objects.create(
                vendor=self.vendor, image=make_image(), headline=f"Slot {i}", cta_url="/x",
                requested_days=5, payment_type="postpaid", price_per_day_snapshot=200, total_price=1000,
            )
            Banner.objects.create(
                application=app, vendor=self.vendor, image=make_image(), headline=f"Slot {i}", cta_url="/x",
                slot_position=i, payment_type="postpaid", price_per_day=200, days=5, total_price=1000,
                status=Banner.Status.LIVE, live_start_date=today, live_end_date=today + timedelta(days=4),
            )
        resp = self.client.get(reverse("banner-public-carousel"))
        self.assertEqual(len(resp.data), 2)


class AdminSettingsTests(BannerTestBase):
    def test_admin_can_update_price_and_slot_limit(self):
        self.login_as(self.admin)
        resp = self.client.patch(reverse("banner-admin-settings"), {
            "banner_price_per_day": "250.00", "carousel_slot_limit": 8,
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["banner_price_per_day"], "250.00")
        self.assertEqual(resp.data["carousel_slot_limit"], 8)

    def test_new_price_applies_to_next_application_immediately(self):
        self.login_as(self.admin)
        self.client.patch(reverse("banner-admin-settings"), {"banner_price_per_day": "500.00"}, format="json")

        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-banner-application-list"), {
            "image": make_image(), "headline": "x", "cta_url": "/x",
            "requested_days": 2, "payment_type": "prepaid",
        }, format="multipart")
        self.assertEqual(resp.data["price_per_day_snapshot"], "500.00")
        self.assertEqual(resp.data["total_price"], "1000.00")

    def test_vendor_cannot_change_settings(self):
        self.login_as(self.vendor)
        resp = self.client.patch(reverse("banner-admin-settings"), {"carousel_slot_limit": 99}, format="json")
        self.assertEqual(resp.status_code, 403)
