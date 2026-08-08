from decimal import Decimal

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.products.models import Category, Product

from .models import Order, OrderItem, Payout

User = get_user_model()


def make_user(role, email, **extra):
    user = User(username=email, email=email, role=role, **extra)
    user.set_password("Str0ngPass1")
    user.save()
    return user


VALID_SHIPPING = {
    "shipping_full_name": "Ayesha Khan",
    "shipping_phone_number": "03001234567",
    "shipping_email": "ayesha@example.com",
    "shipping_province": "sindh",
    "shipping_city": "Karachi",
    "shipping_address_line": "House 12, Street 4",
    "shipping_is_rural": False,
    "delivery_method": "standard",
    "payment_method": "cod",
}


class OrdersTestBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.vendor = make_user(User.Role.VENDOR, "vendor@example.com")
        self.other_vendor = make_user(User.Role.VENDOR, "other-vendor@example.com")
        self.admin = make_user(User.Role.ADMIN, "admin@example.com")
        self.customer = make_user(User.Role.CUSTOMER, "customer@example.com")
        self.category = Category.objects.create(name="Test Category")

    def login_as(self, user):
        self.client.force_authenticate(user=user)

    def make_product(self, vendor=None, base_price=Decimal("1000.00"), stock_quantity=10, **extra):
        defaults = dict(
            vendor=vendor or self.vendor,
            category=self.category,
            name="Test Product",
            description="A product for testing.",
            brand="TestBrand",
            base_price=base_price,
            stock_quantity=stock_quantity,
            status=Product.Status.APPROVED,
            is_active=True,
        )
        defaults.update(extra)
        return Product.objects.create(**defaults)


class OrderCreateTests(OrdersTestBase):
    def test_guest_can_place_order(self):
        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 2}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        order = Order.objects.get(order_code=resp.data["order_code"])
        self.assertIsNone(order.customer)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().quantity, 2)

    def test_logged_in_customer_order_is_tagged(self):
        product = self.make_product()
        self.login_as(self.customer)
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        order = Order.objects.get(order_code=resp.data["order_code"])
        self.assertEqual(order.customer, self.customer)

    def test_stock_decrements_on_order(self):
        product = self.make_product(stock_quantity=10)
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 3}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 7)

    def test_cannot_order_more_than_stock(self):
        product = self.make_product(stock_quantity=2)
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 5}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 2)

    def test_cannot_order_unapproved_product(self):
        product = self.make_product(status=Product.Status.PENDING)
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_rural_delivery_requires_landmark(self):
        product = self.make_product()
        payload = {**VALID_SHIPPING, "shipping_is_rural": True, "items": [{"product": product.id, "quantity": 1}]}
        resp = self.client.post(reverse("order-create"), payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("shipping_landmark", resp.data)

    def test_wallet_payment_requires_provider(self):
        product = self.make_product()
        payload = {**VALID_SHIPPING, "payment_method": "wallet", "items": [{"product": product.id, "quantity": 1}]}
        resp = self.client.post(reverse("order-create"), payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("wallet_provider", resp.data)

    def test_totals_computed_correctly(self):
        product = self.make_product(base_price=Decimal("1000.00"))
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "delivery_method": "express", "items": [{"product": product.id, "quantity": 2}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        # selling_price = base_price * 1.10 (provisional commission) = 1100.00
        self.assertEqual(Decimal(resp.data["subtotal"]), Decimal("2200.00"))
        self.assertEqual(Decimal(resp.data["shipping_fee"]), Decimal("450.00"))
        self.assertEqual(Decimal(resp.data["total"]), Decimal("2650.00"))

    def test_empty_cart_rejected(self):
        resp = self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": []}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_order_code_format(self):
        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertRegex(resp.data["order_code"], r"^DBM-\d{4}-\d{4}$")

    def test_commission_and_net_to_vendor_computed(self):
        # base_price 1000 -> selling_price 1100 (10% provisional commission)
        product = self.make_product(base_price=Decimal("1000.00"))
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 2}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        item = resp.data["items"][0]
        self.assertEqual(Decimal(item["net_to_vendor"]), Decimal("2000.00"))
        self.assertEqual(Decimal(item["commission_amount"]), Decimal("200.00"))
        self.assertEqual(Decimal(resp.data["net_to_vendor_total"]), Decimal("2000.00"))
        self.assertEqual(Decimal(resp.data["commission_total"]), Decimal("200.00"))

    def test_commission_survives_product_deletion(self):
        product = self.make_product(base_price=Decimal("1000.00"), name="Soon Deleted 2")
        create_resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        order_id = create_resp.data["id"]
        product.delete()

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-orders"))
        results = resp.data["results"] if "results" in resp.data else resp.data
        order = next(o for o in results if o["id"] == order_id)
        self.assertEqual(Decimal(order["net_to_vendor_total"]), Decimal("1000.00"))


class OrderIdempotencyTests(OrdersTestBase):
    """§8.4: a retried checkout request (double-click, timeout+retry) must
    never create a second real order or double-decrement stock."""

    def test_retry_with_same_key_returns_original_order_not_a_duplicate(self):
        product = self.make_product(stock_quantity=10)
        body = {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 2}], "idempotency_key": "attempt-abc-123"}

        first = self.client.post(reverse("order-create"), body, format="json")
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post(reverse("order-create"), body, format="json")
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data["order_code"], second.data["order_code"])
        self.assertEqual(Order.objects.count(), 1)

    def test_retry_does_not_double_decrement_stock(self):
        product = self.make_product(stock_quantity=10)
        body = {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 3}], "idempotency_key": "attempt-xyz"}

        self.client.post(reverse("order-create"), body, format="json")
        self.client.post(reverse("order-create"), body, format="json")
        self.client.post(reverse("order-create"), body, format="json")

        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 7)  # decremented exactly once, not three times

    def test_different_keys_create_separate_orders(self):
        product = self.make_product(stock_quantity=10)
        first = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}], "idempotency_key": "key-1"},
            format="json",
        )
        second = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}], "idempotency_key": "key-2"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertNotEqual(first.data["order_code"], second.data["order_code"])
        self.assertEqual(Order.objects.count(), 2)

    def test_no_key_behaves_exactly_as_before(self):
        """Idempotency is opt-in — an old/unpatched client that never sends
        a key must keep working exactly as it always did."""
        product = self.make_product(stock_quantity=10)
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(Order.objects.get(order_code=resp.data["order_code"]).idempotency_key)

    def test_two_guests_can_each_omit_the_key_without_colliding(self):
        """Multiple NULL idempotency_key rows must coexist under the unique
        constraint — Postgres treats NULLs as distinct, but worth locking
        in as a real regression test rather than trusting that blindly."""
        product = self.make_product(stock_quantity=10)
        for _ in range(3):
            resp = self.client.post(
                reverse("order-create"),
                {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
                format="json",
            )
            self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Order.objects.count(), 3)


class OrderTrackingTests(OrdersTestBase):
    def _place_order(self, product, **overrides):
        payload = {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}], **overrides}
        return self.client.post(reverse("order-create"), payload, format="json")

    def test_can_track_by_email(self):
        product = self.make_product()
        create_resp = self._place_order(product)
        resp = self.client.get(reverse("order-track"), {"order_code": create_resp.data["order_code"], "contact": "ayesha@example.com"})
        self.assertEqual(resp.status_code, 200)

    def test_can_track_by_phone(self):
        product = self.make_product()
        create_resp = self._place_order(product)
        resp = self.client.get(reverse("order-track"), {"order_code": create_resp.data["order_code"], "contact": "03001234567"})
        self.assertEqual(resp.status_code, 200)

    def test_wrong_contact_rejected(self):
        product = self.make_product()
        create_resp = self._place_order(product)
        resp = self.client.get(reverse("order-track"), {"order_code": create_resp.data["order_code"], "contact": "wrong@example.com"})
        self.assertEqual(resp.status_code, 404)

    def test_unknown_order_code(self):
        resp = self.client.get(reverse("order-track"), {"order_code": "DBM-2026-9999", "contact": "x@example.com"})
        self.assertEqual(resp.status_code, 404)


class OrderCancelTests(OrdersTestBase):
    """§8.4: customer self-service cancellation — pending-only, restocks,
    reverses coupon usage. See views.OrderCancelView docstring for the
    scope assumption (pending-only, not "any time before shipped")."""

    def _place_order(self, product, quantity=1, **overrides):
        payload = {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": quantity}], **overrides}
        return self.client.post(reverse("order-create"), payload, format="json")

    def test_guest_can_cancel_with_matching_email(self):
        product = self.make_product(stock_quantity=10)
        create_resp = self._place_order(product, quantity=3)
        resp = self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "ayesha@example.com"})
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], "cancelled")

    def test_guest_can_cancel_with_matching_phone(self):
        product = self.make_product(stock_quantity=10)
        create_resp = self._place_order(product)
        resp = self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "03001234567"})
        self.assertEqual(resp.status_code, 200, resp.data)

    def test_wrong_contact_cannot_cancel(self):
        product = self.make_product(stock_quantity=10)
        create_resp = self._place_order(product)
        resp = self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "someone-else@example.com"})
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(Order.objects.get(order_code=create_resp.data["order_code"]).status, Order.Status.PENDING)

    def test_logged_in_customer_can_cancel_own_order_without_contact(self):
        product = self.make_product(stock_quantity=10)
        self.login_as(self.customer)
        create_resp = self._place_order(product)
        resp = self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"]})
        self.assertEqual(resp.status_code, 200, resp.data)

    def test_logged_in_customer_cannot_cancel_someone_elses_order(self):
        product = self.make_product(stock_quantity=10)
        create_resp = self._place_order(product)  # guest order
        self.login_as(self.customer)
        resp = self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"]})
        self.assertEqual(resp.status_code, 404)

    def test_cancel_restocks_the_product(self):
        product = self.make_product(stock_quantity=10)
        create_resp = self._place_order(product, quantity=4)
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 6)  # decremented at order time

        self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "ayesha@example.com"})
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 10)  # restored on cancel

    def test_cannot_cancel_once_processing(self):
        product = self.make_product(stock_quantity=10)
        create_resp = self._place_order(product)
        order = Order.objects.get(order_code=create_resp.data["order_code"])
        order.status = Order.Status.PROCESSING
        order.save(update_fields=["status"])

        resp = self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "ayesha@example.com"})
        self.assertEqual(resp.status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PROCESSING)

    def test_cannot_cancel_already_cancelled_order(self):
        product = self.make_product(stock_quantity=10)
        create_resp = self._place_order(product)
        self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "ayesha@example.com"})
        second = self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "ayesha@example.com"})
        self.assertEqual(second.status_code, 400)

    def test_cancel_reverses_coupon_usage(self):
        from decimal import Decimal

        from .models import Coupon

        coupon = Coupon.objects.create(code="SAVE10", discount_type=Coupon.DiscountType.PERCENT, discount_value=Decimal("10.00"), used_count=1)
        product = self.make_product(stock_quantity=10, base_price=Decimal("1000.00"))
        create_resp = self._place_order(product, coupon_code="SAVE10")
        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 2)

        self.client.post(reverse("order-cancel"), {"order_code": create_resp.data["order_code"], "contact": "ayesha@example.com"})
        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

    def test_missing_order_code_rejected(self):
        resp = self.client.post(reverse("order-cancel"), {"contact": "ayesha@example.com"})
        self.assertEqual(resp.status_code, 400)


class CustomerOrderHistoryTests(OrdersTestBase):
    def test_customer_sees_only_own_orders(self):
        product = self.make_product()
        self.login_as(self.customer)
        self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]}, format="json")
        self.client.force_authenticate(user=None)
        # a guest order that shouldn't show up for this customer
        self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]}, format="json")

        self.login_as(self.customer)
        resp = self.client.get(reverse("order-mine"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"] if "results" in resp.data else resp.data), 1)

    def test_anonymous_cannot_view_order_history(self):
        resp = self.client.get(reverse("order-mine"))
        self.assertEqual(resp.status_code, 401)


class VendorOrdersTests(OrdersTestBase):
    def test_vendor_sees_orders_with_their_products(self):
        own_product = self.make_product(vendor=self.vendor)
        other_product = self.make_product(vendor=self.other_vendor, name="Other Vendor Product")
        self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": own_product.id, "quantity": 1}]}, format="json")
        self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": other_product.id, "quantity": 1}]}, format="json")

        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-orders"))
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)

    def test_customer_cannot_access_vendor_orders(self):
        self.login_as(self.customer)
        resp = self.client.get(reverse("vendor-orders"))
        self.assertEqual(resp.status_code, 403)


class AdminOrdersTests(OrdersTestBase):
    def test_admin_can_list_all_orders(self):
        product = self.make_product()
        self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]}, format="json")
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-orders"))
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)

    def test_vendor_cannot_access_admin_orders(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("admin-orders"))
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_update_order_status(self):
        product = self.make_product()
        create_resp = self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]}, format="json")
        order_id = create_resp.data["id"]

        self.login_as(self.admin)
        resp = self.client.patch(reverse("admin-order-update", args=[order_id]), {"status": "processing", "courier_name": "TCS"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, "processing")
        self.assertEqual(order.courier_name, "TCS")

    def test_admin_cannot_set_invalid_status(self):
        product = self.make_product()
        create_resp = self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]}, format="json")
        order_id = create_resp.data["id"]

        self.login_as(self.admin)
        resp = self.client.patch(reverse("admin-order-update", args=[order_id]), {"status": "not-a-real-status"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_vendor_cannot_update_order(self):
        product = self.make_product()
        create_resp = self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]}, format="json")
        order_id = create_resp.data["id"]

        self.login_as(self.vendor)
        resp = self.client.patch(reverse("admin-order-update", args=[order_id]), {"status": "processing"}, format="json")
        self.assertEqual(resp.status_code, 403)


class OrderItemDeletedProductTests(OrdersTestBase):
    """§6.2: admin deleting a product must never destroy order history."""

    def test_order_item_survives_product_deletion(self):
        product = self.make_product(name="Soon Deleted")
        create_resp = self.client.post(reverse("order-create"), {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]}, format="json")
        order_id = create_resp.data["id"]
        product.delete()

        order = Order.objects.get(pk=order_id)
        item = order.items.first()
        self.assertIsNone(item.product)
        self.assertEqual(item.product_name, "Soon Deleted")


class AdminDashboardTests(OrdersTestBase):
    def _place_order(self, product, quantity=1):
        return self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": quantity}]},
            format="json",
        )

    def test_non_admin_cannot_access_dashboard(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(resp.status_code, 403)

    def test_dashboard_reports_kpis(self):
        product = self.make_product(base_price=Decimal("1000.00"))
        self._place_order(product, quantity=2)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(Decimal(resp.data["platform_revenue"]["total"]), Decimal("2200.00"))
        self.assertEqual(Decimal(resp.data["platform_commission"]["total"]), Decimal("200.00"))
        self.assertEqual(resp.data["active_products"], 1)

    def test_cancelled_orders_excluded_from_revenue(self):
        product = self.make_product(base_price=Decimal("1000.00"))
        create_resp = self._place_order(product)
        order_id = create_resp.data["id"]

        self.login_as(self.admin)
        self.client.patch(reverse("admin-order-update", args=[order_id]), {"status": "cancelled"}, format="json")

        resp = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(Decimal(resp.data["platform_revenue"]["total"]), Decimal("0.00"))

    def test_recent_orders_included(self):
        product = self.make_product()
        self._place_order(product)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(len(resp.data["recent_orders"]), 1)
        self.assertIn("order_code", resp.data["recent_orders"][0])

    def test_top_products_reflects_units_sold(self):
        product = self.make_product(name="Popular Item")
        self._place_order(product, quantity=5)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(resp.data["top_products"][0]["name"], "Popular Item")
        self.assertEqual(resp.data["top_products"][0]["units_sold"], 5)

    def test_pending_vendors_count(self):
        from apps.accounts.models import VendorApplication

        VendorApplication.objects.create(
            business_name="X", owner_name="Y", email="x@example.com", phone_number="03001234567",
            business_type="Retailer", description="d", cnic_number="1", cnic_front="x.jpg", cnic_back="y.jpg",
            bank_name="b", account_title="t", account_number="n", account_cnic="1",
        )
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(resp.data["pending_vendors"], 1)


class AdminAnalyticsTests(OrdersTestBase):
    """Platform-wide analytics (§Phase 8 date-range work) — preset ranges,
    custom ranges, top products/vendors, and the CSV export."""

    def _place_order(self, product, quantity=1):
        return self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": quantity}]},
            format="json",
        )

    def test_non_admin_cannot_access_analytics(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("admin-analytics"))
        self.assertEqual(resp.status_code, 403)

    def test_default_range_reports_revenue_and_commission(self):
        product = self.make_product(base_price=Decimal("1000.00"))
        self._place_order(product, quantity=2)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-analytics"))
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["range_days"], 30)
        self.assertEqual(Decimal(resp.data["platform_revenue"]), Decimal("2200.00"))
        self.assertEqual(Decimal(resp.data["platform_commission"]), Decimal("200.00"))
        self.assertEqual(resp.data["units_sold"], 2)
        self.assertEqual(resp.data["order_count"], 1)

    def test_cancelled_orders_excluded(self):
        product = self.make_product(base_price=Decimal("1000.00"))
        create_resp = self._place_order(product)
        order_id = create_resp.data["id"]

        self.login_as(self.admin)
        self.client.patch(reverse("admin-order-update", args=[order_id]), {"status": "cancelled"}, format="json")

        resp = self.client.get(reverse("admin-analytics"))
        self.assertEqual(Decimal(resp.data["platform_revenue"]), Decimal("0.00"))

    def test_custom_range_filters_correctly(self):
        from django.utils import timezone

        product = self.make_product(base_price=Decimal("1000.00"))
        self._place_order(product)
        order = Order.objects.first()
        order.created_at = timezone.now() - timedelta(days=60)
        order.save(update_fields=["created_at"])

        self.login_as(self.admin)
        # 30d preset should miss it (order is 60 days old)
        resp = self.client.get(reverse("admin-analytics"), {"range": "30d"})
        self.assertEqual(Decimal(resp.data["platform_revenue"]), Decimal("0.00"))

        # A custom range spanning the order's actual date should catch it
        from_date = (timezone.now() - timedelta(days=65)).date().isoformat()
        to_date = (timezone.now() - timedelta(days=55)).date().isoformat()
        resp = self.client.get(reverse("admin-analytics"), {"from": from_date, "to": to_date})
        self.assertEqual(Decimal(resp.data["platform_revenue"]), Decimal("1100.00"))

    def test_invalid_custom_range_rejected(self):
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-analytics"), {"from": "2026-05-01", "to": "2026-04-01"})
        self.assertEqual(resp.status_code, 400)

    def test_top_vendors_and_top_products(self):
        product_a = self.make_product(vendor=self.vendor, name="Vendor A Item", base_price=Decimal("1000.00"))
        product_b = self.make_product(vendor=self.other_vendor, name="Vendor B Item", base_price=Decimal("500.00"))
        self._place_order(product_a, quantity=3)
        self._place_order(product_b, quantity=1)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-analytics"))
        self.assertEqual(resp.data["top_products"][0]["name"], "Vendor A Item")
        vendor_names = [v["name"] for v in resp.data["top_vendors"]]
        self.assertEqual(len(vendor_names), 2)

    def test_export_csv_downloads_with_preset_range(self):
        product = self.make_product(base_price=Decimal("1000.00"))
        self._place_order(product, quantity=2)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-analytics-export"), {"range": "30d"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/csv; charset=utf-8")
        body = resp.content.decode("utf-8-sig")
        self.assertIn("Vendor", body)
        self.assertIn("Test Product", body)

    def test_export_csv_downloads_with_custom_range(self):
        from django.utils import timezone

        product = self.make_product(base_price=Decimal("1000.00"))
        self._place_order(product, quantity=1)

        self.login_as(self.admin)
        # Use localdate() (Asia/Karachi), matching what make_aware() in the
        # view assumes for a bare from/to date — timezone.now().date() would
        # give the UTC date instead, which can be a different calendar day
        # near the Karachi midnight boundary and wrongly exclude the order.
        today = timezone.localdate()
        from_date = (today - timedelta(days=1)).isoformat()
        to_date = today.isoformat()
        resp = self.client.get(reverse("admin-analytics-export"), {"from": from_date, "to": to_date})
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode("utf-8-sig")
        self.assertIn("Test Product", body)

    def test_conversion_rate_uses_product_views(self):
        from apps.products.models import ProductView

        product = self.make_product(base_price=Decimal("1000.00"))
        ProductView.objects.create(product=product, source=ProductView.Source.DIRECT)
        ProductView.objects.create(product=product, source=ProductView.Source.SEARCH)
        self._place_order(product)

        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-analytics"))
        self.assertEqual(resp.data["total_views"], 2)
        self.assertEqual(resp.data["conversion_rate"], 50.0)


class PlatformSettingsIntegrationTests(OrdersTestBase):
    """§6.7: free-shipping threshold and payment gateway toggles actually affect checkout."""

    def test_free_shipping_threshold_zeroes_out_shipping_fee(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.free_shipping_threshold = Decimal("1000.00")
        settings_obj.save()

        product = self.make_product(base_price=Decimal("1000.00"))  # selling_price 1100, clears threshold
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Decimal(resp.data["shipping_fee"]), Decimal("0.00"))

    def test_below_threshold_still_charges_shipping(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.free_shipping_threshold = Decimal("100000.00")
        settings_obj.save()

        product = self.make_product(base_price=Decimal("1000.00"))
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(Decimal(resp.data["shipping_fee"]), Decimal("250.00"))

    def test_disabled_cod_rejects_checkout(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.cod_enabled = False
        settings_obj.save()

        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_disabled_wallet_provider_rejects_checkout(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.jazzcash_enabled = False
        settings_obj.easypaisa_enabled = True
        settings_obj.save()

        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "payment_method": "wallet", "wallet_provider": "JazzCash", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_enabled_wallet_provider_accepted(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.easypaisa_enabled = True
        settings_obj.save()

        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "payment_method": "wallet", "wallet_provider": "EasyPaisa", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)


class LowStockAlertTests(OrdersTestBase):
    """§7.2: crossing into low stock sends exactly one admin alert email."""

    def setUp(self):
        super().setUp()
        # Isolate from the New Order alert (§6.7/§7.7, added alongside this
        # one) so this class keeps testing only the low-stock trigger, not
        # every notification that happens to fire on order creation.
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.notify_new_orders = False
        settings_obj.save()

    def test_alert_sent_when_order_crosses_into_low_stock(self):
        product = self.make_product(stock_quantity=6)  # order of 1 -> 5, at the threshold
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Low stock", mail.outbox[0].subject)

    def test_no_alert_when_stock_stays_comfortable(self):
        product = self.make_product(stock_quantity=20)
        self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_no_repeat_alert_once_already_low(self):
        product = self.make_product(stock_quantity=4)  # already below threshold
        self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_no_alert_when_notify_low_stock_disabled(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.notify_low_stock = False
        settings_obj.save()

        product = self.make_product(stock_quantity=6)
        self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(len(mail.outbox), 0)


class CouponTests(OrdersTestBase):
    """§8.3: discount codes applied at checkout."""

    def make_coupon(self, **kwargs):
        from .models import Coupon
        defaults = dict(code="SAVE10", discount_type="percent", discount_value=Decimal("10.00"), is_active=True)
        defaults.update(kwargs)
        return Coupon.objects.create(**defaults)

    def test_percent_coupon_applies_discount(self):
        self.make_coupon()
        product = self.make_product(base_price=Decimal("1000.00"))  # selling_price 1100
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "coupon_code": "SAVE10", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Decimal(resp.data["discount_amount"]), Decimal("110.00"))
        self.assertEqual(resp.data["coupon_code"], "SAVE10")

    def test_fixed_coupon_applies_discount(self):
        self.make_coupon(code="FLAT50", discount_type="fixed", discount_value=Decimal("50.00"))
        product = self.make_product(base_price=Decimal("1000.00"))
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "coupon_code": "FLAT50", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(Decimal(resp.data["discount_amount"]), Decimal("50.00"))

    def test_invalid_coupon_code_rejected(self):
        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "coupon_code": "NOPE", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_inactive_coupon_rejected(self):
        self.make_coupon(is_active=False)
        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "coupon_code": "SAVE10", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_min_order_value_enforced(self):
        self.make_coupon(min_order_value=Decimal("5000.00"))
        product = self.make_product(base_price=Decimal("1000.00"))
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "coupon_code": "SAVE10", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_max_uses_enforced(self):
        coupon = self.make_coupon(max_uses=1, used_count=1)
        product = self.make_product()
        resp = self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "coupon_code": "SAVE10", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_used_count_increments_on_success(self):
        coupon = self.make_coupon()
        product = self.make_product()
        self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "coupon_code": "SAVE10", "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )
        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

    def test_admin_can_manage_coupons(self):
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-coupon-list"), {"code": "NEW20", "discount_type": "percent", "discount_value": "20.00"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_non_admin_cannot_manage_coupons(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("admin-coupon-list"))
        self.assertEqual(resp.status_code, 403)


class PayoutTests(OrdersTestBase):
    """§6.7/Phase 6+: payout eligibility (hold + cycle) and batch generation."""

    def make_delivered_order_item(self, vendor=None, base_price=Decimal("1000.00"), quantity=1, delivered_days_ago=10):
        from django.utils import timezone

        product = self.make_product(vendor=vendor or self.vendor, base_price=base_price)
        order = Order.objects.create(
            order_code=f"DBM-TEST-{OrderItem.objects.count() + 1}",
            shipping_full_name="Test Customer", shipping_phone_number="03001234567", shipping_email="c@example.com",
            shipping_province="sindh", shipping_city="Karachi", shipping_address_line="Street 1",
            subtotal=base_price * quantity, shipping_fee=Decimal("0.00"), total=base_price * quantity,
            status=Order.Status.DELIVERED,
            delivered_at=timezone.now() - timedelta(days=delivered_days_ago),
        )
        return OrderItem.objects.create(
            order=order, product=product, vendor=product.vendor,
            product_name=product.name, product_slug=product.slug,
            quantity=quantity, unit_price=product.selling_price, unit_base_price=base_price,
        )

    def test_item_not_eligible_before_hold_period(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.payout_hold_days = 5
        settings_obj.save()
        self.make_delivered_order_item(delivered_days_ago=2)  # inside hold window
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["created_count"], 0)

    def test_item_eligible_after_hold_period(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.payout_hold_days = 3
        settings_obj.save()
        self.make_delivered_order_item(delivered_days_ago=10, base_price=Decimal("1000.00"))
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["created_count"], 1)
        self.assertEqual(Decimal(resp.data["payouts"][0]["total_amount"]), Decimal("1000.00"))

    def test_item_not_double_counted_across_batches(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        first = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(first.data["created_count"], 1)
        second = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(second.data["created_count"], 0)

    def test_vendor_sees_pending_balance_before_batch_generated(self):
        self.make_delivered_order_item(delivered_days_ago=10, base_price=Decimal("500.00"))
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-payouts"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Decimal(resp.data["pending_balance"]), Decimal("500.00"))
        self.assertEqual(resp.data["payouts"], [])

    def test_vendor_sees_payout_history_after_generation(self):
        self.make_delivered_order_item(delivered_days_ago=10, base_price=Decimal("750.00"))
        self.login_as(self.admin)
        self.client.post(reverse("admin-payout-generate"))
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-payouts"))
        self.assertEqual(len(resp.data["payouts"]), 1)
        self.assertEqual(Decimal(resp.data["payouts"][0]["total_amount"]), Decimal("750.00"))
        self.assertEqual(Decimal(resp.data["pending_balance"]), Decimal("0.00"))

    def test_admin_can_mark_payout_paid(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        resp = self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]), {"reference": "TXN123"})
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], "paid")
        self.assertEqual(resp.data["reference"], "TXN123")

    def test_cannot_mark_already_paid_payout_paid_again(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]))
        resp = self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]))
        self.assertEqual(resp.status_code, 400)

    def test_vendor_cannot_access_admin_payout_endpoints(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("admin-payout-list"))
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_reopen_paid_payout_as_failed(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]), {"reference": "TXN123"})

        resp = self.client.post(
            reverse("admin-payout-mark-failed", args=[payout_id]),
            {"reason": "Bank rejected — account number mismatch"},
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], "failed")
        self.assertEqual(resp.data["failure_reason"], "Bank rejected — account number mismatch")
        self.assertIsNotNone(resp.data["failed_at"])

    def test_mark_failed_requires_a_reason(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]))

        resp = self.client.post(reverse("admin-payout-mark-failed", args=[payout_id]), {"reason": "  "})
        self.assertEqual(resp.status_code, 400)

    def test_cannot_mark_failed_a_payout_that_isnt_paid(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        # still pending, never marked paid
        resp = self.client.post(reverse("admin-payout-mark-failed", args=[payout_id]), {"reason": "test"})
        self.assertEqual(resp.status_code, 400)

    def test_retry_after_failure_marks_paid_and_clears_failure_state(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]), {"reference": "BAD-TXN"})
        self.client.post(reverse("admin-payout-mark-failed", args=[payout_id]), {"reason": "Wrong account number"})

        resp = self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]), {"reference": "GOOD-TXN-2"})
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], "paid")
        self.assertEqual(resp.data["reference"], "GOOD-TXN-2")
        self.assertEqual(resp.data["failure_reason"], "")
        self.assertIsNone(resp.data["failed_at"])

    def test_retry_does_not_create_a_duplicate_payout_or_double_pay_items(self):
        item = self.make_delivered_order_item(delivered_days_ago=10, base_price=Decimal("1000.00"))
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]))
        self.client.post(reverse("admin-payout-mark-failed", args=[payout_id]), {"reason": "failed"})
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]), {"reference": "RETRY-TXN"})

        # Reopening + retrying must not spawn a second Payout for the same item.
        self.assertEqual(Payout.objects.filter(vendor=self.vendor).count(), 1)
        item.refresh_from_db()
        self.assertEqual(item.payout_item.payout_id, payout_id)

        # And a fresh generate run must not pick the item up again.
        gen_again = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(gen_again.data["created_count"], 0)

    def test_reopening_logs_admin_action(self):
        from apps.core.models import AuditLogEntry

        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]))
        self.client.post(reverse("admin-payout-mark-failed", args=[payout_id]), {"reason": "Bank rejected"})

        entry = AuditLogEntry.objects.filter(action="payout.marked_failed", target_id=payout_id).first()
        self.assertIsNotNone(entry)
        self.assertIn("Bank rejected", entry.details)

    def test_vendor_cannot_mark_payout_failed(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]))

        self.login_as(self.vendor)
        resp = self.client.post(reverse("admin-payout-mark-failed", args=[payout_id]), {"reason": "test"})
        self.assertEqual(resp.status_code, 403)

    def test_vendor_sees_failed_status_and_reason_in_export(self):
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        gen = self.client.post(reverse("admin-payout-generate"))
        payout_id = gen.data["payouts"][0]["id"]
        self.client.post(reverse("admin-payout-mark-paid", args=[payout_id]))
        self.client.post(reverse("admin-payout-mark-failed", args=[payout_id]), {"reason": "Bank rejected transfer"})

        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-payouts"))
        self.assertEqual(resp.data["payouts"][0]["status"], "failed")
        self.assertEqual(resp.data["payouts"][0]["failure_reason"], "Bank rejected transfer")

        export_resp = self.client.get(reverse("vendor-payouts-export"))
        self.assertEqual(export_resp.status_code, 200)
        self.assertIn("Bank rejected transfer", export_resp.content.decode("utf-8-sig"))

    def test_second_batch_respects_cycle_cooldown(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.payout_cycle_days = 7
        settings_obj.save()

        self.make_delivered_order_item(delivered_days_ago=10, base_price=Decimal("100.00"))
        self.login_as(self.admin)
        self.client.post(reverse("admin-payout-generate"))  # first batch, sets cooldown

        self.make_delivered_order_item(delivered_days_ago=10, base_price=Decimal("200.00"))
        resp = self.client.post(reverse("admin-payout-generate"))
        # still inside the 7-day cooldown from the first batch, so no new batch yet
        self.assertEqual(resp.data["created_count"], 0)


class NewOrderAlertTests(OrdersTestBase):
    """§6.7/§7.7 admin notification: New Order toggle."""

    def place_order(self):
        product = self.make_product()
        return self.client.post(
            reverse("order-create"),
            {**VALID_SHIPPING, "items": [{"product": product.id, "quantity": 1}]},
            format="json",
        )

    def test_alert_sent_on_new_order_by_default(self):
        resp = self.place_order()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("New order", mail.outbox[0].subject)

    def test_no_alert_when_notify_new_orders_disabled(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.notify_new_orders = False
        settings_obj.save()

        self.place_order()
        self.assertEqual(len(mail.outbox), 0)


class VendorPayoutScheduleOverrideTests(OrdersTestBase):
    """Phase 8 deferred item: per-vendor payout hold/cycle overrides."""

    def make_delivered_order_item(self, vendor=None, base_price=Decimal("1000.00"), quantity=1, delivered_days_ago=10):
        from django.utils import timezone

        product = self.make_product(vendor=vendor or self.vendor, base_price=base_price)
        order = Order.objects.create(
            order_code=f"DBM-SCHED-{OrderItem.objects.count() + 1}",
            shipping_full_name="Test Customer", shipping_phone_number="03001234567", shipping_email="c@example.com",
            shipping_province="sindh", shipping_city="Karachi", shipping_address_line="Street 1",
            subtotal=base_price * quantity, shipping_fee=Decimal("0.00"), total=base_price * quantity,
            status=Order.Status.DELIVERED,
            delivered_at=timezone.now() - timedelta(days=delivered_days_ago),
        )
        return OrderItem.objects.create(
            order=order, product=product, vendor=product.vendor,
            product_name=product.name, product_slug=product.slug,
            quantity=quantity, unit_price=product.selling_price, unit_base_price=base_price,
        )

    def test_no_override_uses_platform_default(self):
        from apps.core.models import PlatformSettings

        PlatformSettings.get_solo()  # ensure row exists at default 3-day hold
        self.assertIsNone(self.vendor.payout_hold_days_override)
        self.make_delivered_order_item(delivered_days_ago=2)  # inside default 3-day hold
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.data["created_count"], 0)

    def test_shorter_override_makes_item_eligible_sooner(self):
        self.vendor.payout_hold_days_override = 1
        self.vendor.save()
        self.make_delivered_order_item(delivered_days_ago=2)  # would fail the 3-day platform default
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.data["created_count"], 1, resp.data)

    def test_longer_override_delays_eligibility(self):
        self.vendor.payout_hold_days_override = 10
        self.vendor.save()
        self.make_delivered_order_item(delivered_days_ago=5)  # would pass the 3-day platform default
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.data["created_count"], 0)

    def test_override_is_per_vendor_not_global(self):
        self.vendor.payout_hold_days_override = 1
        self.vendor.save()
        self.make_delivered_order_item(vendor=self.vendor, delivered_days_ago=2)
        self.make_delivered_order_item(vendor=self.other_vendor, delivered_days_ago=2)  # no override, still inside 3-day default
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.data["created_count"], 1)
        self.assertEqual(resp.data["payouts"][0]["vendor"], self.vendor.id)

    def test_cycle_override_shortens_cooldown(self):
        self.vendor.payout_cycle_days_override = 1
        self.vendor.save()
        self.make_delivered_order_item(delivered_days_ago=10)
        self.login_as(self.admin)
        first = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(first.data["created_count"], 1)

        # Immediately generating again should still respect the 1-day cooldown (no new batch yet)
        second = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(second.data["created_count"], 0)

    def test_admin_can_set_override(self):
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-vendor-payout-schedule", args=[self.vendor.id]),
            {"payout_hold_days_override": 1, "payout_cycle_days_override": 2},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.vendor.refresh_from_db()
        self.assertEqual(self.vendor.payout_hold_days_override, 1)
        self.assertEqual(self.vendor.payout_cycle_days_override, 2)

    def test_admin_can_reset_override_to_default(self):
        self.vendor.payout_hold_days_override = 1
        self.vendor.save()
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-vendor-payout-schedule", args=[self.vendor.id]),
            {"payout_hold_days_override": None},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.vendor.refresh_from_db()
        self.assertIsNone(self.vendor.payout_hold_days_override)

    def test_override_rejects_out_of_range_value(self):
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-vendor-payout-schedule", args=[self.vendor.id]),
            {"payout_hold_days_override": 999},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_override_rejects_non_numeric_value(self):
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-vendor-payout-schedule", args=[self.vendor.id]),
            {"payout_hold_days_override": "not-a-number"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_vendor_cannot_set_own_override(self):
        self.login_as(self.vendor)
        resp = self.client.patch(
            reverse("admin-vendor-payout-schedule", args=[self.vendor.id]),
            {"payout_hold_days_override": 1},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_setting_override_is_logged(self):
        from apps.core.models import AuditLogEntry

        self.login_as(self.admin)
        self.client.patch(
            reverse("admin-vendor-payout-schedule", args=[self.vendor.id]),
            {"payout_hold_days_override": 1},
            format="json",
        )
        entry = AuditLogEntry.objects.filter(action="vendor.payout_schedule_changed", target_id=self.vendor.id).first()
        self.assertIsNotNone(entry)

    def test_admin_vendor_list_exposes_overrides(self):
        self.vendor.payout_hold_days_override = 1
        self.vendor.save()
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-vendor-list"))
        row = next(v for v in resp.data if v["id"] == self.vendor.id)
        self.assertEqual(row["payout_hold_days_override"], 1)
        self.assertIsNone(row["payout_cycle_days_override"])


class PayoutReadyAlertTests(OrdersTestBase):
    """§6.7/§7.7 admin notification: Payout Requests toggle."""

    def make_delivered_order_item(self, base_price=Decimal("1000.00")):
        from django.utils import timezone

        product = self.make_product(base_price=base_price)
        order = Order.objects.create(
            order_code=f"DBM-ALERT-{OrderItem.objects.count() + 1}",
            shipping_full_name="Test Customer", shipping_phone_number="03001234567", shipping_email="c@example.com",
            shipping_province="sindh", shipping_city="Karachi", shipping_address_line="Street 1",
            subtotal=base_price, shipping_fee=Decimal("0.00"), total=base_price,
            status=Order.Status.DELIVERED,
            delivered_at=timezone.now() - timedelta(days=10),
        )
        return OrderItem.objects.create(
            order=order, product=product, vendor=product.vendor,
            product_name=product.name, product_slug=product.slug,
            quantity=1, unit_price=product.selling_price, unit_base_price=base_price,
        )

    def test_alert_sent_when_batches_generated(self):
        self.make_delivered_order_item()
        self.login_as(self.admin)
        mail.outbox.clear()
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.data["created_count"], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("payout batch", mail.outbox[0].subject)

    def test_no_alert_when_nothing_generated(self):
        self.login_as(self.admin)
        mail.outbox.clear()
        resp = self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(resp.data["created_count"], 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_no_alert_when_notify_payout_requests_disabled(self):
        from apps.core.models import PlatformSettings

        settings_obj = PlatformSettings.get_solo()
        settings_obj.notify_payout_requests = False
        settings_obj.save()

        self.make_delivered_order_item()
        self.login_as(self.admin)
        mail.outbox.clear()
        self.client.post(reverse("admin-payout-generate"))
        self.assertEqual(len(mail.outbox), 0)
