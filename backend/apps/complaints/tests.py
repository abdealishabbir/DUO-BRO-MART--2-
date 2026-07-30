from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.orders.models import Order, OrderItem
from apps.products.models import Category, Product

from .models import Complaint

User = get_user_model()


def make_user(role, email):
    user = User(username=email, email=email, role=role)
    user.set_password("Str0ngPass1")
    user.save()
    return user


class ComplaintTestBase(APITestCase):
    def setUp(self):
        self.customer = make_user(User.Role.CUSTOMER, "customer@example.com")
        self.other_customer = make_user(User.Role.CUSTOMER, "other@example.com")
        self.vendor = make_user(User.Role.VENDOR, "vendor@example.com")
        self.admin = make_user(User.Role.ADMIN, "admin@example.com")
        category = Category.objects.create(name="Test Category")
        self.product = Product.objects.create(
            vendor=self.vendor, category=category, name="Test Product", description="d", brand="B",
            base_price=Decimal("1000.00"), stock_quantity=10, status=Product.Status.APPROVED, is_active=True,
        )

    def make_order_item(self, customer=None):
        order = Order.objects.create(
            customer=customer if customer is not None else self.customer,
            shipping_full_name="A", shipping_phone_number="03001234567", shipping_email="a@example.com",
            shipping_province="sindh", shipping_city="Karachi", shipping_address_line="x",
            subtotal=Decimal("1100.00"), shipping_fee=Decimal("250.00"), total=Decimal("1350.00"),
            status=Order.Status.DELIVERED,
        )
        return OrderItem.objects.create(
            order=order, product=self.product, vendor=self.vendor, product_name=self.product.name,
            product_slug=self.product.slug, quantity=1, unit_price=Decimal("1100.00"), unit_base_price=Decimal("1000.00"),
        )

    def login_as_customer(self):
        self.client.force_authenticate(user=self.customer)

    def login_as_admin(self):
        self.client.force_authenticate(user=self.admin)


class ComplaintCreateTests(ComplaintTestBase):
    def test_can_file_complaint(self):
        item = self.make_order_item()
        self.login_as_customer()
        resp = self.client.post(reverse("complaint-create"), {"order_item": item.id, "reason": "damaged", "description": "Box crushed"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Complaint.objects.count(), 1)

    def test_cannot_file_for_someone_elses_order(self):
        item = self.make_order_item(customer=self.other_customer)
        self.login_as_customer()
        resp = self.client.post(reverse("complaint-create"), {"order_item": item.id, "reason": "damaged", "description": "x"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_cannot_file_twice_for_same_item(self):
        item = self.make_order_item()
        self.login_as_customer()
        payload = {"order_item": item.id, "reason": "wrong_product", "description": "x"}
        self.client.post(reverse("complaint-create"), payload, format="json")
        resp = self.client.post(reverse("complaint-create"), payload, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_anonymous_cannot_file(self):
        item = self.make_order_item()
        resp = self.client.post(reverse("complaint-create"), {"order_item": item.id, "reason": "damaged", "description": "x"}, format="json")
        self.assertEqual(resp.status_code, 401)


class AdminComplaintQueueTests(ComplaintTestBase):
    def test_admin_can_list_and_filter_by_status(self):
        item = self.make_order_item()
        self.login_as_customer()
        self.client.post(reverse("complaint-create"), {"order_item": item.id, "reason": "damaged", "description": "x"}, format="json")

        self.login_as_admin()
        resp = self.client.get(reverse("admin-complaints"), {"status": "open"})
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)

    def test_admin_can_resolve_complaint(self):
        item = self.make_order_item()
        self.login_as_customer()
        create_resp = self.client.post(reverse("complaint-create"), {"order_item": item.id, "reason": "damaged", "description": "x"}, format="json")

        self.login_as_admin()
        resp = self.client.patch(
            reverse("admin-complaint-resolve", args=[create_resp.data["id"]]),
            {"status": "resolved_refund", "resolution_notes": "Refunded via wallet"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        complaint = Complaint.objects.get(pk=create_resp.data["id"])
        self.assertEqual(complaint.status, Complaint.Status.RESOLVED_REFUND)
        self.assertIsNotNone(complaint.resolved_at)
        self.assertEqual(complaint.resolved_by, self.admin)

    def test_non_admin_cannot_access_queue(self):
        self.login_as_customer()
        resp = self.client.get(reverse("admin-complaints"))
        self.assertEqual(resp.status_code, 403)

    def test_invalid_status_rejected(self):
        item = self.make_order_item()
        self.login_as_customer()
        create_resp = self.client.post(reverse("complaint-create"), {"order_item": item.id, "reason": "damaged", "description": "x"}, format="json")
        self.login_as_admin()
        resp = self.client.patch(reverse("admin-complaint-resolve", args=[create_resp.data["id"]]), {"status": "not-real"}, format="json")
        self.assertEqual(resp.status_code, 400)


class MyComplaintsTests(ComplaintTestBase):
    def test_customer_sees_only_own_complaints(self):
        item = self.make_order_item()
        other_item = self.make_order_item(customer=self.other_customer)
        self.client.force_authenticate(user=self.other_customer)
        self.client.post(reverse("complaint-create"), {"order_item": other_item.id, "reason": "damaged", "description": "x"}, format="json")

        self.login_as_customer()
        self.client.post(reverse("complaint-create"), {"order_item": item.id, "reason": "damaged", "description": "x"}, format="json")
        resp = self.client.get(reverse("complaint-mine"))
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)
