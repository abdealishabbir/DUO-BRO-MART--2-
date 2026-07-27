from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Category, Product, ProductChangeRequest, StockChangeRequest

User = get_user_model()


def make_user(role, email, **extra):
    user = User(username=email, email=email, role=role, **extra)
    user.set_password("Str0ngPass1")
    user.save()
    return user


class ProductsTestBase(APITestCase):
    def setUp(self):
        self.vendor = make_user(User.Role.VENDOR, "vendor@example.com")
        self.other_vendor = make_user(User.Role.VENDOR, "other-vendor@example.com")
        self.admin = make_user(User.Role.ADMIN, "admin@example.com")
        self.customer = make_user(User.Role.CUSTOMER, "customer@example.com")
        self.category = Category.objects.create(name="Test Category")

    def login_as(self, user):
        self.client.force_authenticate(user=user)

    def make_product(self, vendor=None, status=Product.Status.DRAFT, **extra):
        defaults = dict(
            vendor=vendor or self.vendor,
            category=self.category,
            name="Test Product",
            description="A product for testing.",
            brand="TestBrand",
            base_price=Decimal("1000.00"),
            stock_quantity=10,
            status=status,
        )
        defaults.update(extra)
        return Product.objects.create(**defaults)


class CategoryTests(ProductsTestBase):
    def test_anyone_can_list_categories(self):
        resp = self.client.get(reverse("category-list"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], Category.objects.count())

    def test_customer_cannot_create_category(self):
        self.login_as(self.customer)
        resp = self.client.post(reverse("category-list"), {"name": "Books"})
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_create_category(self):
        self.login_as(self.admin)
        resp = self.client.post(reverse("category-list"), {"name": "Automotive"})
        self.assertEqual(resp.status_code, 201)


class VendorProductCreateTests(ProductsTestBase):
    def test_vendor_can_create_draft_product(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-list"), {
            "category": self.category.id,
            "name": "Wireless Mouse",
            "description": "A smooth wireless mouse.",
            "brand": "LogiPro",
            "base_price": "1500.00",
            "stock_quantity": 25,
        })
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["status"], "draft")
        product = Product.objects.get(pk=resp.data["id"])
        self.assertEqual(product.vendor, self.vendor)

    def test_customer_cannot_create_product(self):
        self.login_as(self.customer)
        resp = self.client.post(reverse("vendor-product-list"), {
            "category": self.category.id, "name": "X", "description": "Y",
            "brand": "Z", "base_price": "10.00", "stock_quantity": 1,
        })
        self.assertEqual(resp.status_code, 403)

    def test_negative_price_rejected(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-list"), {
            "category": self.category.id, "name": "X", "description": "Y",
            "brand": "Z", "base_price": "-5.00", "stock_quantity": 1,
        })
        self.assertEqual(resp.status_code, 400)

    def test_selling_price_includes_commission(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-list"), {
            "category": self.category.id, "name": "X", "description": "Y",
            "brand": "Z", "base_price": "1000.00", "stock_quantity": 1,
        })
        product = Product.objects.get(pk=resp.data["id"])
        self.assertEqual(product.selling_price, Decimal("1100.00"))  # 10% provisional commission


class VendorProductVisibilityTests(ProductsTestBase):
    def test_vendor_only_sees_own_products(self):
        self.make_product(vendor=self.vendor, name="Mine")
        self.make_product(vendor=self.other_vendor, name="Not mine")
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-product-list"))
        self.assertEqual(resp.status_code, 200)
        names = [p["name"] for p in resp.data["results"]] if "results" in resp.data else [p["name"] for p in resp.data]
        self.assertIn("Mine", names)
        self.assertNotIn("Not mine", names)

    def test_vendor_cannot_edit_others_product(self):
        other_product = self.make_product(vendor=self.other_vendor)
        self.login_as(self.vendor)
        resp = self.client.patch(reverse("vendor-product-detail", args=[other_product.id]), {"name": "Hijacked"})
        self.assertEqual(resp.status_code, 404)  # filtered queryset -> not found, not 403


class VendorProductSubmitTests(ProductsTestBase):
    def test_vendor_can_submit_draft_for_review(self):
        product = self.make_product(status=Product.Status.DRAFT)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-submit", args=[product.id]))
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.PENDING)
        self.assertIsNotNone(product.submitted_at)

    def test_cannot_submit_already_pending_product(self):
        product = self.make_product(status=Product.Status.PENDING)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-submit", args=[product.id]))
        self.assertEqual(resp.status_code, 400)

    def test_rejected_product_can_be_resubmitted(self):
        product = self.make_product(status=Product.Status.REJECTED, admin_notes="Bad photos")
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-submit", args=[product.id]))
        self.assertEqual(resp.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.PENDING)


class VendorProductDeleteTests(ProductsTestBase):
    def test_can_delete_draft_product(self):
        product = self.make_product(status=Product.Status.DRAFT)
        self.login_as(self.vendor)
        resp = self.client.delete(reverse("vendor-product-detail", args=[product.id]))
        self.assertEqual(resp.status_code, 204)

    def test_cannot_delete_pending_product(self):
        product = self.make_product(status=Product.Status.PENDING)
        self.login_as(self.vendor)
        resp = self.client.delete(reverse("vendor-product-detail", args=[product.id]))
        self.assertEqual(resp.status_code, 400)


class AdminProductReviewTests(ProductsTestBase):
    def test_admin_can_approve_pending_product(self):
        product = self.make_product(status=Product.Status.PENDING)
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-product-approve", args=[product.id]))
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.APPROVED)
        self.assertIsNotNone(product.decided_at)

    def test_admin_can_reject_with_reason(self):
        product = self.make_product(status=Product.Status.PENDING)
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-product-reject", args=[product.id]), {"admin_notes": "Blurry photos"})
        self.assertEqual(resp.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.REJECTED)
        self.assertEqual(product.admin_notes, "Blurry photos")

    def test_cannot_approve_already_approved_product(self):
        product = self.make_product(status=Product.Status.APPROVED)
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-product-approve", args=[product.id]))
        self.assertEqual(resp.status_code, 400)

    def test_vendor_cannot_access_admin_product_endpoint(self):
        product = self.make_product(status=Product.Status.PENDING)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("admin-product-approve", args=[product.id]))
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_filter_by_status(self):
        self.make_product(status=Product.Status.PENDING, name="P1")
        self.make_product(status=Product.Status.APPROVED, name="P2")
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-product-list"), {"status": "pending"})
        names = [p["name"] for p in resp.data["results"]] if "results" in resp.data else [p["name"] for p in resp.data]
        self.assertEqual(names, ["P1"])

    def _names(self, resp):
        return [p["name"] for p in resp.data["results"]] if "results" in resp.data else [p["name"] for p in resp.data]

    def test_admin_can_filter_by_category(self):
        other_category = Category.objects.create(name="Other Category")
        self.make_product(status=Product.Status.APPROVED, name="InCat", category=self.category)
        self.make_product(status=Product.Status.APPROVED, name="OtherCat", category=other_category)
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-product-list"), {"category": self.category.id})
        self.assertEqual(self._names(resp), ["InCat"])

    def test_admin_can_search_by_product_name(self):
        self.make_product(status=Product.Status.APPROVED, name="Wireless Mouse")
        self.make_product(status=Product.Status.APPROVED, name="Bluetooth Speaker")
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-product-list"), {"search": "mouse"})
        self.assertEqual(self._names(resp), ["Wireless Mouse"])

    def test_admin_can_search_by_vendor_email(self):
        self.make_product(status=Product.Status.APPROVED, name="P1", vendor=self.vendor)
        self.make_product(status=Product.Status.APPROVED, name="P2", vendor=self.other_vendor)
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-product-list"), {"search": "other-vendor"})
        self.assertEqual(self._names(resp), ["P2"])

    def test_admin_can_edit_product_catalog_fields(self):
        product = self.make_product(status=Product.Status.APPROVED, name="Old Name", base_price=Decimal("1000.00"))
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-product-detail", args=[product.id]),
            {"name": "New Name", "base_price": "1200.00", "stock_quantity": 5},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.name, "New Name")
        self.assertEqual(product.base_price, Decimal("1200.00"))
        self.assertEqual(product.stock_quantity, 5)

    def test_admin_edit_cannot_change_status_or_vendor(self):
        product = self.make_product(status=Product.Status.PENDING, vendor=self.vendor)
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-product-detail", args=[product.id]),
            {"status": "approved", "vendor": self.other_vendor.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.PENDING)
        self.assertEqual(product.vendor, self.vendor)

    def test_admin_can_delete_product_with_cascade(self):
        product = self.make_product(status=Product.Status.APPROVED)
        change_request = ProductChangeRequest.objects.create(
            product=product, vendor=product.vendor, change_type=ProductChangeRequest.ChangeType.PRICE_CHANGE,
            new_price=Decimal("1500.00"),
        )
        self.login_as(self.admin)
        resp = self.client.delete(reverse("admin-product-detail", args=[product.id]))
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Product.objects.filter(id=product.id).exists())
        self.assertFalse(ProductChangeRequest.objects.filter(id=change_request.id).exists())

    def test_vendor_cannot_edit_via_admin_endpoint(self):
        product = self.make_product(status=Product.Status.APPROVED)
        self.login_as(self.vendor)
        resp = self.client.patch(reverse("admin-product-detail", args=[product.id]), {"name": "Hacked"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_customer_cannot_delete_via_admin_endpoint(self):
        product = self.make_product(status=Product.Status.APPROVED)
        self.login_as(self.customer)
        resp = self.client.delete(reverse("admin-product-detail", args=[product.id]))
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(Product.objects.filter(id=product.id).exists())


class ProductChangeRequestTests(ProductsTestBase):
    def test_vendor_can_request_price_change(self):
        product = self.make_product(status=Product.Status.APPROVED, base_price=Decimal("1000.00"))
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-change-request-list"), {
            "product": product.id, "change_type": "price_change", "new_price": "1200.00",
        })
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_price_change_requires_new_price(self):
        product = self.make_product(status=Product.Status.APPROVED)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-change-request-list"), {
            "product": product.id, "change_type": "price_change",
        })
        self.assertEqual(resp.status_code, 400)

    def test_vendor_cannot_request_change_on_others_product(self):
        other_product = self.make_product(vendor=self.other_vendor, status=Product.Status.APPROVED)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-change-request-list"), {
            "product": other_product.id, "change_type": "price_change", "new_price": "50.00",
        })
        self.assertEqual(resp.status_code, 400)

    def test_admin_approving_price_change_updates_product(self):
        product = self.make_product(status=Product.Status.APPROVED, base_price=Decimal("1000.00"))
        change_request = ProductChangeRequest.objects.create(
            product=product, vendor=self.vendor, change_type=ProductChangeRequest.ChangeType.PRICE_CHANGE,
            new_price=Decimal("1300.00"),
        )
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-change-request-approve", args=[change_request.id]))
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.base_price, Decimal("1300.00"))

    def test_admin_approving_discount_sets_active_discount(self):
        product = self.make_product(status=Product.Status.APPROVED)
        change_request = ProductChangeRequest.objects.create(
            product=product, vendor=self.vendor, change_type=ProductChangeRequest.ChangeType.DISCOUNT,
            discount_percent=Decimal("20.00"),
        )
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-change-request-approve", args=[change_request.id]))
        self.assertEqual(resp.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.active_discount_percent, Decimal("20.00"))
        self.assertTrue(product.is_deal_active)
        # selling_price is 1100.00 (10% commission on 1000 base) -> 20% off -> 880.00
        self.assertEqual(product.discounted_price, Decimal("880.00"))

    def test_rejected_change_request_does_not_touch_product(self):
        product = self.make_product(status=Product.Status.APPROVED, base_price=Decimal("1000.00"))
        change_request = ProductChangeRequest.objects.create(
            product=product, vendor=self.vendor, change_type=ProductChangeRequest.ChangeType.PRICE_CHANGE,
            new_price=Decimal("1300.00"),
        )
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-change-request-reject", args=[change_request.id]))
        self.assertEqual(resp.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.base_price, Decimal("1000.00"))


class StockChangeRequestTests(ProductsTestBase):
    def test_vendor_can_request_restock(self):
        product = self.make_product(stock_quantity=5)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-stock-request-list"), {
            "product": product.id, "requested_increase": 50,
        })
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_negative_or_zero_increase_rejected(self):
        product = self.make_product()
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-stock-request-list"), {
            "product": product.id, "requested_increase": 0,
        })
        self.assertEqual(resp.status_code, 400)

    def test_admin_approving_restock_increments_stock(self):
        product = self.make_product(stock_quantity=5)
        stock_request = StockChangeRequest.objects.create(product=product, vendor=self.vendor, requested_increase=50)
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-stock-request-approve", args=[stock_request.id]))
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 55)

    def test_rejected_restock_does_not_change_stock(self):
        product = self.make_product(stock_quantity=5)
        stock_request = StockChangeRequest.objects.create(product=product, vendor=self.vendor, requested_increase=50)
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-stock-request-reject", args=[stock_request.id]))
        self.assertEqual(resp.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 5)

    def test_vendor_cannot_request_restock_on_others_product(self):
        other_product = self.make_product(vendor=self.other_vendor)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-stock-request-list"), {
            "product": other_product.id, "requested_increase": 10,
        })
        self.assertEqual(resp.status_code, 400)


class ProductSkuAndActiveTests(ProductsTestBase):
    def test_can_create_product_with_sku(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-list"), {
            "category": self.category.id, "name": "X", "description": "Y",
            "brand": "Z", "base_price": "10.00", "stock_quantity": 1, "sku": "SN-SP-001",
        })
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["sku"], "SN-SP-001")

    def test_new_product_defaults_active(self):
        product = self.make_product()
        self.assertTrue(product.is_active)

    def test_vendor_can_toggle_active_on_approved_product(self):
        product = self.make_product(status=Product.Status.APPROVED)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-toggle-active", args=[product.id]))
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertFalse(product.is_active)
        # toggling again flips it back
        resp2 = self.client.post(reverse("vendor-product-toggle-active", args=[product.id]))
        product.refresh_from_db()
        self.assertTrue(product.is_active)

    def test_cannot_toggle_active_on_draft_product(self):
        product = self.make_product(status=Product.Status.DRAFT)
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-toggle-active", args=[product.id]))
        self.assertEqual(resp.status_code, 400)
