from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Category, CommissionRate, Product, ProductChangeRequest, ProductView, StockChangeRequest, Wishlist

User = get_user_model()


def make_user(role, email, **extra):
    user = User(username=email, email=email, role=role, **extra)
    user.set_password("Str0ngPass1")
    user.save()
    return user


class ProductsTestBase(APITestCase):
    def setUp(self):
        cache.clear()
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

    def test_vendor_can_request_custom_category(self):
        """§6.2: a product that doesn't fit any fixed category (e.g. an
        electric car under 'Toys') can be submitted with no category and a
        requested_category_name instead."""
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-list"), {
            "requested_category_name": "Electric Vehicles",
            "name": "Kids Electric Car", "description": "Ride-on toy car.",
            "brand": "RideOn", "base_price": "50000.00", "stock_quantity": 3,
        })
        self.assertEqual(resp.status_code, 201, resp.data)
        product = Product.objects.get(pk=resp.data["id"])
        self.assertIsNone(product.category)
        self.assertEqual(product.requested_category_name, "Electric Vehicles")
        self.assertTrue(product.has_category_mismatch)

    def test_cannot_submit_without_category_or_custom_name(self):
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-list"), {
            "name": "X", "description": "Y", "brand": "Z",
            "base_price": "10.00", "stock_quantity": 1,
        })
        self.assertEqual(resp.status_code, 400)

    def test_cannot_submit_with_both_category_and_custom_name(self):
        """Both provided — the fixed category wins and the custom name is dropped, rather than erroring."""
        self.login_as(self.vendor)
        resp = self.client.post(reverse("vendor-product-list"), {
            "category": self.category.id, "requested_category_name": "Electric Vehicles",
            "name": "X", "description": "Y", "brand": "Z",
            "base_price": "10.00", "stock_quantity": 1,
        })
        self.assertEqual(resp.status_code, 201, resp.data)
        product = Product.objects.get(pk=resp.data["id"])
        self.assertEqual(product.category, self.category)
        self.assertEqual(product.requested_category_name, "")


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


class AdminCategoryMismatchTests(ProductsTestBase):
    """§6.2: a pending product submitted under 'Other' (no category fit)
    must be resolved — assign an existing category or create a new one
    with its own commission — before it can be approved."""

    def make_mismatched_product(self):
        return self.make_product(
            status=Product.Status.PENDING, category=None,
            requested_category_name="Electric Vehicles",
        )

    def test_approve_blocked_without_resolution(self):
        product = self.make_mismatched_product()
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-product-approve", args=[product.id]))
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(resp.data.get("requires_category_resolution"))
        self.assertEqual(resp.data.get("requested_category_name"), "Electric Vehicles")
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.PENDING)

    def test_admin_can_assign_existing_category_and_approve(self):
        product = self.make_mismatched_product()
        self.login_as(self.admin)
        resp = self.client.post(
            reverse("admin-product-approve", args=[product.id]),
            {"category_id": self.category.id},
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.APPROVED)
        self.assertEqual(product.category, self.category)
        self.assertEqual(product.requested_category_name, "")

    def test_admin_can_create_new_category_with_commission_and_approve(self):
        product = self.make_mismatched_product()
        self.login_as(self.admin)
        resp = self.client.post(
            reverse("admin-product-approve", args=[product.id]),
            {"new_category_name": "Electric Vehicles", "commission_rate_percent": "15.00"},
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.APPROVED)
        self.assertIsNotNone(product.category)
        self.assertEqual(product.category.name, "Electric Vehicles")
        self.assertEqual(product.category.commission_rate.rate_percent, Decimal("15.00"))
        self.assertEqual(product.requested_category_name, "")

    def test_new_category_requires_commission_rate(self):
        product = self.make_mismatched_product()
        self.login_as(self.admin)
        resp = self.client.post(
            reverse("admin-product-approve", args=[product.id]),
            {"new_category_name": "Electric Vehicles"},
        )
        self.assertEqual(resp.status_code, 400)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.PENDING)
        self.assertIsNone(product.category)

    def test_matching_category_product_approves_directly(self):
        """A product that already matches a fixed category needs no resolution step."""
        product = self.make_product(status=Product.Status.PENDING)
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-product-approve", args=[product.id]))
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.APPROVED)

    def test_reject_does_not_require_category_resolution(self):
        product = self.make_mismatched_product()
        self.login_as(self.admin)
        resp = self.client.post(reverse("admin-product-reject", args=[product.id]), {"admin_notes": "Not a fit"})
        self.assertEqual(resp.status_code, 200, resp.data)
        product.refresh_from_db()
        self.assertEqual(product.status, Product.Status.REJECTED)


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


class PublicCatalogTests(ProductsTestBase):
    """§6.2/§10.4: the storefront can only ever see approved+active products."""

    def test_lists_only_approved_active_products(self):
        self.make_product(status=Product.Status.APPROVED, is_active=True, name="Visible")
        self.make_product(status=Product.Status.APPROVED, is_active=False, name="Paused")
        self.make_product(status=Product.Status.PENDING, name="Pending")
        self.make_product(status=Product.Status.DRAFT, name="Draft")
        resp = self.client.get(reverse("product-list"))
        self.assertEqual(resp.status_code, 200)
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["Visible"])

    def test_no_auth_required(self):
        self.make_product(status=Product.Status.APPROVED)
        resp = self.client.get(reverse("product-list"))
        self.assertEqual(resp.status_code, 200)

    def test_can_retrieve_by_slug(self):
        product = self.make_product(status=Product.Status.APPROVED, name="Slug Lookup Product")
        resp = self.client.get(reverse("product-detail", args=[product.slug]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["name"], "Slug Lookup Product")
        self.assertIn("description", resp.data)

    def test_pending_product_not_retrievable(self):
        product = self.make_product(status=Product.Status.PENDING)
        resp = self.client.get(reverse("product-detail", args=[product.slug]))
        self.assertEqual(resp.status_code, 404)

    def test_filter_by_category_slug(self):
        other_category = Category.objects.create(name="Other")
        self.make_product(status=Product.Status.APPROVED, name="InCat", category=self.category)
        self.make_product(status=Product.Status.APPROVED, name="OtherCat", category=other_category)
        resp = self.client.get(reverse("product-list"), {"category": self.category.slug})
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["InCat"])

    def test_filter_by_price_range(self):
        self.make_product(status=Product.Status.APPROVED, name="Cheap", base_price=Decimal("500.00"))
        self.make_product(status=Product.Status.APPROVED, name="Pricey", base_price=Decimal("5000.00"))
        resp = self.client.get(reverse("product-list"), {"max_price": "1000"})
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["Cheap"])

    def test_sort_by_price_ascending(self):
        self.make_product(status=Product.Status.APPROVED, name="Pricey", base_price=Decimal("5000.00"))
        self.make_product(status=Product.Status.APPROVED, name="Cheap", base_price=Decimal("500.00"))
        resp = self.client.get(reverse("product-list"), {"sort": "price-asc"})
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["Cheap", "Pricey"])

    def test_deals_only_filter(self):
        self.make_product(status=Product.Status.APPROVED, name="NoDeal")
        self.make_product(status=Product.Status.APPROVED, name="OnDeal", active_discount_percent=Decimal("10.00"))
        resp = self.client.get(reverse("product-list"), {"deals": "1"})
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["OnDeal"])

    def test_search_by_name(self):
        self.make_product(status=Product.Status.APPROVED, name="Wireless Mouse")
        self.make_product(status=Product.Status.APPROVED, name="Bluetooth Speaker")
        resp = self.client.get(reverse("product-list"), {"search": "mouse"})
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["Wireless Mouse"])

    def test_brands_endpoint_lists_distinct_visible_brands(self):
        self.make_product(status=Product.Status.APPROVED, brand="Aura")
        self.make_product(status=Product.Status.APPROVED, brand="Aura", name="Second Aura Product")
        self.make_product(status=Product.Status.PENDING, brand="HiddenBrand")
        resp = self.client.get(reverse("product-brands"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(list(resp.data), ["Aura"])

    def test_filter_by_multiple_categories(self):
        cat_a = Category.objects.create(name="Cat A")
        cat_b = Category.objects.create(name="Cat B")
        cat_c = Category.objects.create(name="Cat C")
        self.make_product(status=Product.Status.APPROVED, name="InA", category=cat_a)
        self.make_product(status=Product.Status.APPROVED, name="InB", category=cat_b)
        self.make_product(status=Product.Status.APPROVED, name="InC", category=cat_c)
        resp = self.client.get(reverse("product-list"), {"category": f"{cat_a.slug},{cat_b.slug}"})
        names = sorted(p["name"] for p in resp.data["results"])
        self.assertEqual(names, ["InA", "InB"])


class CommissionRateTests(ProductsTestBase):
    """§6.6: per-category commission rates, admin-editable, falling back to the provisional flat rate."""

    def test_uncustomized_category_falls_back_to_provisional_rate(self):
        product = self.make_product(status=Product.Status.APPROVED, base_price=Decimal("1000.00"))
        self.assertEqual(product.commission_rate_percent, Decimal("10.00"))
        self.assertEqual(product.selling_price, Decimal("1100.00"))

    def test_admin_can_list_rates_for_all_categories(self):
        extra = Category.objects.create(name="Extra Category")
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-commission-rates"))
        self.assertEqual(resp.status_code, 200)
        category_ids = {row["category_id"] for row in resp.data}
        self.assertIn(self.category.id, category_ids)
        self.assertIn(extra.id, category_ids)
        self.assertTrue(all(not row["is_custom"] for row in resp.data))

    def test_admin_can_set_custom_rate(self):
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-commission-rates"),
            {"rates": [{"category_id": self.category.id, "rate_percent": "15.00"}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        row = next(r for r in resp.data if r["category_id"] == self.category.id)
        self.assertEqual(Decimal(row["rate_percent"]), Decimal("15.00"))
        self.assertTrue(row["is_custom"])

    def test_custom_rate_changes_product_selling_price(self):
        product = self.make_product(status=Product.Status.APPROVED, base_price=Decimal("1000.00"))
        CommissionRate.objects.create(category=self.category, rate_percent=Decimal("20.00"))
        product.refresh_from_db()
        self.assertEqual(product.commission_rate_percent, Decimal("20.00"))
        self.assertEqual(product.selling_price, Decimal("1200.00"))

    def test_vendor_cannot_set_rates(self):
        self.login_as(self.vendor)
        resp = self.client.patch(
            reverse("admin-commission-rates"),
            {"rates": [{"category_id": self.category.id, "rate_percent": "50.00"}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_invalid_category_id_rejected(self):
        self.login_as(self.admin)
        resp = self.client.patch(
            reverse("admin-commission-rates"),
            {"rates": [{"category_id": 999999, "rate_percent": "10.00"}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)


class AdminPricingViewTests(ProductsTestBase):
    def test_admin_can_view_pricing_breakdown(self):
        self.make_product(status=Product.Status.APPROVED, name="Priced Item", base_price=Decimal("1000.00"))
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-pricing"))
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"] if "results" in resp.data else resp.data
        row = next(r for r in results if r["name"] == "Priced Item")
        self.assertEqual(Decimal(row["sale_price"]), Decimal("1100.00"))
        self.assertEqual(Decimal(row["commission_amount"]), Decimal("100.00"))

    def test_pricing_search_by_name(self):
        self.make_product(status=Product.Status.APPROVED, name="Findable Widget")
        self.make_product(status=Product.Status.APPROVED, name="Other Thing")
        self.login_as(self.admin)
        resp = self.client.get(reverse("admin-pricing"), {"search": "findable"})
        results = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual(len(results), 1)

    def test_vendor_cannot_view_pricing(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("admin-pricing"))
        self.assertEqual(resp.status_code, 403)


class LowStockTests(ProductsTestBase):
    """§7.2: low-stock threshold and scarcity-messaging flag."""

    def test_is_low_stock_true_at_threshold(self):
        product = self.make_product(stock_quantity=5)
        self.assertTrue(product.is_low_stock)

    def test_is_low_stock_false_above_threshold(self):
        product = self.make_product(stock_quantity=6)
        self.assertFalse(product.is_low_stock)

    def test_is_low_stock_false_when_out_of_stock(self):
        product = self.make_product(stock_quantity=0)
        self.assertFalse(product.is_low_stock)

    def test_is_low_stock_exposed_on_public_catalog(self):
        self.make_product(status=Product.Status.APPROVED, stock_quantity=3)
        resp = self.client.get(reverse("product-list"))
        self.assertTrue(resp.data["results"][0]["is_low_stock"])


class InventoryWebSocketTests(ProductsTestBase):
    """§7.1: stock changes broadcast to the inventory WebSocket group."""

    def test_stock_change_broadcasts_update(self):
        from asgiref.sync import async_to_sync, sync_to_async
        from channels.testing import WebsocketCommunicator

        from config.asgi import application

        product = self.make_product(status=Product.Status.APPROVED, stock_quantity=10)

        async def run():
            communicator = WebsocketCommunicator(application, "ws/inventory/")
            connected, _ = await communicator.connect()
            assert connected

            def change_stock():
                product.stock_quantity = 3
                product.save()

            await sync_to_async(change_stock, thread_sensitive=True)()
            message = await communicator.receive_json_from(timeout=2)
            await communicator.disconnect()
            return message

        message = async_to_sync(run)()
        self.assertEqual(message["product_id"], product.id)
        self.assertEqual(message["stock_quantity"], 3)
        self.assertTrue(message["is_low_stock"])

    def test_no_broadcast_when_stock_unchanged(self):
        from asgiref.sync import async_to_sync, sync_to_async
        from channels.testing import WebsocketCommunicator

        from config.asgi import application

        product = self.make_product(status=Product.Status.APPROVED, stock_quantity=10)

        async def run():
            communicator = WebsocketCommunicator(application, "ws/inventory/")
            await communicator.connect()

            def rename():
                product.name = "Renamed, stock untouched"
                product.save()

            await sync_to_async(rename, thread_sensitive=True)()
            got_nothing = await communicator.receive_nothing(timeout=1)
            await communicator.disconnect()
            return got_nothing

        self.assertTrue(async_to_sync(run)())


class ProductViewTrackingTests(ProductsTestBase):
    """§6.7/Phase 6+ Analytics: a storefront product-detail load records a ProductView."""

    def test_viewing_approved_product_logs_a_view(self):
        product = self.make_product(status=Product.Status.APPROVED, is_active=True)
        resp = self.client.get(reverse("product-detail", args=[product.slug]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ProductView.objects.filter(product=product).count(), 1)

    def test_source_query_param_is_recorded(self):
        product = self.make_product(status=Product.Status.APPROVED, is_active=True)
        self.client.get(reverse("product-detail", args=[product.slug]) + "?src=search")
        view = ProductView.objects.get(product=product)
        self.assertEqual(view.source, ProductView.Source.SEARCH)

    def test_invalid_source_falls_back_to_other(self):
        product = self.make_product(status=Product.Status.APPROVED, is_active=True)
        self.client.get(reverse("product-detail", args=[product.slug]) + "?src=nonsense")
        view = ProductView.objects.get(product=product)
        self.assertEqual(view.source, ProductView.Source.OTHER)

    def test_repeated_views_all_logged(self):
        product = self.make_product(status=Product.Status.APPROVED, is_active=True)
        for _ in range(3):
            self.client.get(reverse("product-detail", args=[product.slug]))
        self.assertEqual(ProductView.objects.filter(product=product).count(), 3)


class VendorAnalyticsTests(ProductsTestBase):
    def test_analytics_with_no_activity_is_all_zero(self):
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-analytics"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["revenue"], 0)
        self.assertEqual(resp.data["total_views"], 0)
        self.assertIsNone(resp.data["conversion_rate"])

    def test_views_are_counted_and_conversion_rate_computed(self):
        product = self.make_product(status=Product.Status.APPROVED, is_active=True)
        for _ in range(4):
            self.client.get(reverse("product-detail", args=[product.slug]))
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-analytics"))
        self.assertEqual(resp.data["total_views"], 4)
        self.assertEqual(resp.data["order_count"], 0)
        self.assertEqual(resp.data["conversion_rate"], 0.0)

    def test_traffic_source_breakdown(self):
        product = self.make_product(status=Product.Status.APPROVED, is_active=True)
        url = reverse("product-detail", args=[product.slug])
        self.client.get(url + "?src=search")
        self.client.get(url + "?src=social")
        self.client.get(url)  # direct
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-analytics"))
        self.assertEqual(resp.data["traffic_sources"]["search"], 1)
        self.assertEqual(resp.data["traffic_sources"]["social"], 1)
        self.assertEqual(resp.data["traffic_sources"]["direct"], 1)

    def test_only_this_vendors_views_are_counted(self):
        my_product = self.make_product(vendor=self.vendor, status=Product.Status.APPROVED, is_active=True)
        other_product = self.make_product(vendor=self.other_vendor, status=Product.Status.APPROVED, is_active=True, sku="OTHER-SKU")
        self.client.get(reverse("product-detail", args=[my_product.slug]))
        self.client.get(reverse("product-detail", args=[other_product.slug]))
        self.login_as(self.vendor)
        resp = self.client.get(reverse("vendor-analytics"))
        self.assertEqual(resp.data["total_views"], 1)


class CatalogRatingFilterSortTests(ProductsTestBase):
    """Shop's rating filter/sort — real average_rating/rating_count data
    now exists (§7.3 Feedback), this was just never wired into the
    catalog queryset's filter/sort options."""

    def make_rated_product(self, name, quality_rating=None):
        from decimal import Decimal

        from apps.feedback.models import Feedback
        from apps.orders.models import Order, OrderItem

        product = self.make_product(status=Product.Status.APPROVED, is_active=True, name=name)
        if quality_rating is None:
            return product

        order = Order.objects.create(
            order_code=f"DBM-RATING-{product.id}",
            shipping_full_name="Rater", shipping_phone_number="03001234567", shipping_email="r@example.com",
            shipping_province="sindh", shipping_city="Karachi", shipping_address_line="Street 1",
            subtotal=Decimal("100.00"), shipping_fee=Decimal("0.00"), total=Decimal("100.00"),
            status=Order.Status.DELIVERED,
        )
        OrderItem.objects.create(
            order=order, product=product, vendor=product.vendor,
            product_name=product.name, product_slug=product.slug,
            quantity=1, unit_price=product.selling_price, unit_base_price=product.base_price,
        )
        Feedback.objects.create(
            order=order, customer=self.vendor,  # customer identity doesn't matter for this test
            delivery_rating=quality_rating, packaging_rating=quality_rating,
            quality_rating=quality_rating, service_rating=quality_rating, overall_rating=quality_rating,
        )
        return product

    def test_min_rating_filters_out_lower_rated_products(self):
        self.make_rated_product("Five Star", quality_rating=5)
        self.make_rated_product("Two Star", quality_rating=2)
        self.make_rated_product("Unrated")

        resp = self.client.get(reverse("product-list") + "?min_rating=4")
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["Five Star"])

    def test_sort_by_rating_orders_highest_first_unrated_last(self):
        self.make_rated_product("Mid", quality_rating=3)
        self.make_rated_product("Top", quality_rating=5)
        self.make_rated_product("No Reviews")

        resp = self.client.get(reverse("product-list") + "?sort=rating")
        names = [p["name"] for p in resp.data["results"]]
        self.assertEqual(names, ["Top", "Mid", "No Reviews"])

    def test_no_rating_filter_returns_everything(self):
        self.make_rated_product("A", quality_rating=5)
        self.make_rated_product("B")
        resp = self.client.get(reverse("product-list"))
        self.assertEqual(len(resp.data["results"]), 2)


class WishlistTests(ProductsTestBase):
    def setUp(self):
        super().setUp()
        self.other_customer = make_user(User.Role.CUSTOMER, "other-customer@example.com")
        self.product = self.make_product(status=Product.Status.APPROVED, is_active=True)
        self.other_product = self.make_product(name="Other Product", status=Product.Status.APPROVED, is_active=True)

    def test_anonymous_cannot_toggle(self):
        resp = self.client.post(reverse("wishlist-toggle"), {"product": self.product.id})
        self.assertEqual(resp.status_code, 401)

    def test_toggle_adds_then_removes(self):
        self.login_as(self.customer)
        resp = self.client.post(reverse("wishlist-toggle"), {"product": self.product.id})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["wishlisted"])
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(Wishlist.objects.filter(customer=self.customer, product=self.product).count(), 1)

        resp2 = self.client.post(reverse("wishlist-toggle"), {"product": self.product.id})
        self.assertEqual(resp2.status_code, 200)
        self.assertFalse(resp2.data["wishlisted"])
        self.assertEqual(resp2.data["count"], 0)
        self.assertEqual(Wishlist.objects.filter(customer=self.customer, product=self.product).count(), 0)

    def test_toggle_missing_product_id_rejected(self):
        self.login_as(self.customer)
        resp = self.client.post(reverse("wishlist-toggle"), {})
        self.assertEqual(resp.status_code, 400)

    def test_toggle_nonexistent_product_404s(self):
        self.login_as(self.customer)
        resp = self.client.post(reverse("wishlist-toggle"), {"product": 999999})
        self.assertEqual(resp.status_code, 404)

    def test_ids_endpoint_lists_only_this_customers_saved_products(self):
        self.login_as(self.customer)
        self.client.post(reverse("wishlist-toggle"), {"product": self.product.id})
        self.login_as(self.other_customer)
        self.client.post(reverse("wishlist-toggle"), {"product": self.other_product.id})

        self.login_as(self.customer)
        resp = self.client.get(reverse("wishlist-ids"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [self.product.id])

    def test_list_returns_nested_product_data(self):
        self.login_as(self.customer)
        self.client.post(reverse("wishlist-toggle"), {"product": self.product.id})
        resp = self.client.get(reverse("wishlist-list"))
        self.assertEqual(resp.status_code, 200)
        item = resp.data["results"][0]
        self.assertEqual(item["product"]["id"], self.product.id)
        self.assertTrue(item["is_available"])

    def test_list_flags_unavailable_product(self):
        self.login_as(self.customer)
        self.client.post(reverse("wishlist-toggle"), {"product": self.product.id})
        self.product.is_active = False
        self.product.save(update_fields=["is_active"])

        resp = self.client.get(reverse("wishlist-list"))
        self.assertFalse(resp.data["results"][0]["is_available"])

    def test_list_only_shows_own_items(self):
        self.login_as(self.customer)
        self.client.post(reverse("wishlist-toggle"), {"product": self.product.id})
        self.login_as(self.other_customer)
        resp = self.client.get(reverse("wishlist-list"))
        self.assertEqual(len(resp.data["results"]), 0)

    def test_anonymous_cannot_list(self):
        resp = self.client.get(reverse("wishlist-list"))
        self.assertEqual(resp.status_code, 401)

    def test_double_toggle_add_does_not_violate_unique_constraint(self):
        # Two rapid "add" clicks shouldn't be possible via the toggle
        # endpoint itself (each call flips state), but this guards the
        # DB-level uniqueness guarantee directly in case of a race.
        self.login_as(self.customer)
        Wishlist.objects.create(customer=self.customer, product=self.product)
        with self.assertRaises(Exception):
            Wishlist.objects.create(customer=self.customer, product=self.product)


class SearchSuggestionsTests(ProductsTestBase):
    def setUp(self):
        super().setUp()
        # "Electronics" is already seeded by products/migrations/0003_seed_categories.py
        self.electronics = Category.objects.get(name="Electronics")
        self.shampoo = self.make_product(
            name="Herbal Shampoo 200ml", brand="CleanCo", category=self.category,
            status=Product.Status.APPROVED, is_active=True,
        )
        self.shower_gel = self.make_product(
            name="Shower Gel Fresh", brand="CleanCo", category=self.category,
            status=Product.Status.APPROVED, is_active=True,
        )
        self.unrelated = self.make_product(
            name="Bluetooth Speaker", brand="SoundMax", category=self.electronics,
            status=Product.Status.APPROVED, is_active=True,
        )

    def test_anyone_can_search_no_auth_required(self):
        resp = self.client.get(reverse("search-suggestions"), {"q": "sham"})
        self.assertEqual(resp.status_code, 200)

    def test_short_query_returns_empty(self):
        resp = self.client.get(reverse("search-suggestions"), {"q": "s"})
        self.assertEqual(resp.data, {"products": [], "categories": []})

    def test_missing_query_returns_empty(self):
        resp = self.client.get(reverse("search-suggestions"))
        self.assertEqual(resp.data, {"products": [], "categories": []})

    def test_prefix_match_ranks_first(self):
        resp = self.client.get(reverse("search-suggestions"), {"q": "sham"})
        names = [p["name"] for p in resp.data["products"]]
        self.assertEqual(names[0], "Herbal Shampoo 200ml")

    def test_brand_match(self):
        resp = self.client.get(reverse("search-suggestions"), {"q": "cleanco"})
        names = {p["name"] for p in resp.data["products"]}
        self.assertIn("Herbal Shampoo 200ml", names)
        self.assertIn("Shower Gel Fresh", names)

    def test_unrelated_product_not_returned(self):
        resp = self.client.get(reverse("search-suggestions"), {"q": "sham"})
        names = {p["name"] for p in resp.data["products"]}
        self.assertNotIn("Bluetooth Speaker", names)

    def test_excludes_unapproved_and_inactive_products(self):
        self.make_product(name="Shampoo Pending", status=Product.Status.PENDING)
        self.make_product(name="Shampoo Inactive", status=Product.Status.APPROVED, is_active=False)
        resp = self.client.get(reverse("search-suggestions"), {"q": "sham"})
        names = {p["name"] for p in resp.data["products"]}
        self.assertNotIn("Shampoo Pending", names)
        self.assertNotIn("Shampoo Inactive", names)

    def test_category_suggestions_included(self):
        resp = self.client.get(reverse("search-suggestions"), {"q": "electro"})
        cat_names = [c["name"] for c in resp.data["categories"]]
        self.assertIn("Electronics", cat_names)

    def test_response_shape(self):
        resp = self.client.get(reverse("search-suggestions"), {"q": "sham"})
        product = resp.data["products"][0]
        self.assertEqual(set(product.keys()), {"id", "name", "slug", "image", "price", "category_name"})

    def test_no_prefix_matches_falls_back_to_substring(self):
        # "gel" isn't a prefix of any product name/brand here, but it is a
        # substring of "Shower Gel Fresh" — confirms the substring fallback
        # actually runs, not just the prefix pass.
        resp = self.client.get(reverse("search-suggestions"), {"q": "gel"})
        names = {p["name"] for p in resp.data["products"]}
        self.assertIn("Shower Gel Fresh", names)
