import io
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from apps.orders.models import Order, OrderItem
from apps.products.models import Category, Product

from .models import Feedback, FeedbackImage

User = get_user_model()


def make_test_image(name="photo.jpg", size=(400, 400), image_format="JPEG"):
    buf = io.BytesIO()
    Image.new("RGB", size, color=(120, 140, 160)).save(buf, format=image_format)
    buf.seek(0)
    content_type = "image/jpeg" if image_format == "JPEG" else "image/png"
    return SimpleUploadedFile(name, buf.read(), content_type=content_type)


def make_user(role, email):
    user = User(username=email, email=email, role=role)
    user.set_password("Str0ngPass1")
    user.save()
    return user


class FeedbackTestBase(APITestCase):
    def setUp(self):
        self.customer = make_user(User.Role.CUSTOMER, "customer@example.com")
        self.other_customer = make_user(User.Role.CUSTOMER, "other@example.com")
        self.vendor = make_user(User.Role.VENDOR, "vendor@example.com")
        self.category = Category.objects.create(name="Test Category")
        self.product = Product.objects.create(
            vendor=self.vendor, category=self.category, name="Test Product",
            description="d", brand="B", base_price=Decimal("1000.00"), stock_quantity=10,
            status=Product.Status.APPROVED, is_active=True,
        )

    def make_order(self, status=Order.Status.DELIVERED, customer=None):
        order = Order.objects.create(
            customer=customer if customer is not None else self.customer,
            shipping_full_name="A", shipping_phone_number="03001234567", shipping_email="a@example.com",
            shipping_province="sindh", shipping_city="Karachi", shipping_address_line="x",
            subtotal=Decimal("1100.00"), shipping_fee=Decimal("250.00"), total=Decimal("1350.00"),
            status=status,
        )
        OrderItem.objects.create(
            order=order, product=self.product, vendor=self.vendor, product_name=self.product.name,
            product_slug=self.product.slug, quantity=1, unit_price=Decimal("1100.00"), unit_base_price=Decimal("1000.00"),
        )
        return order

    def login_as_customer(self):
        self.client.force_authenticate(user=self.customer)

    def valid_payload(self, order):
        return {
            "order": order.id, "delivery_rating": 5, "packaging_rating": 4,
            "quality_rating": 5, "service_rating": 5, "overall_rating": 5,
            "review_text": "Great!", "would_recommend": True,
        }


class FeedbackCreateTests(FeedbackTestBase):
    def test_can_submit_feedback_on_delivered_order(self):
        order = self.make_order()
        self.login_as_customer()
        resp = self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Feedback.objects.count(), 1)

    def test_cannot_submit_before_delivered(self):
        order = self.make_order(status=Order.Status.PROCESSING)
        self.login_as_customer()
        resp = self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        self.assertEqual(resp.status_code, 400)

    def test_cannot_submit_twice(self):
        order = self.make_order()
        self.login_as_customer()
        self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        resp = self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        self.assertEqual(resp.status_code, 400)

    def test_cannot_submit_for_someone_elses_order(self):
        order = self.make_order(customer=self.other_customer)
        self.login_as_customer()
        resp = self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        self.assertEqual(resp.status_code, 400)

    def test_rating_out_of_range_rejected(self):
        order = self.make_order()
        self.login_as_customer()
        payload = {**self.valid_payload(order), "overall_rating": 6}
        resp = self.client.post(reverse("feedback-create"), payload, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_anonymous_cannot_submit(self):
        order = self.make_order()
        resp = self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        self.assertEqual(resp.status_code, 401)


class FeedbackPhotoUploadTests(FeedbackTestBase):
    def test_can_submit_feedback_with_photos(self):
        order = self.make_order()
        self.login_as_customer()
        payload = {**self.valid_payload(order), "images": [make_test_image("a.jpg"), make_test_image("b.png", image_format="PNG")]}
        resp = self.client.post(reverse("feedback-create"), payload, format="multipart")
        self.assertEqual(resp.status_code, 201, resp.data)
        feedback = Feedback.objects.get()
        self.assertEqual(feedback.images.count(), 2)

    def test_feedback_without_photos_still_works_as_multipart(self):
        order = self.make_order()
        self.login_as_customer()
        resp = self.client.post(reverse("feedback-create"), self.valid_payload(order), format="multipart")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Feedback.objects.get().images.count(), 0)

    def test_too_many_photos_rejected(self):
        order = self.make_order()
        self.login_as_customer()
        images = [make_test_image(f"{i}.jpg") for i in range(6)]
        payload = {**self.valid_payload(order), "images": images}
        resp = self.client.post(reverse("feedback-create"), payload, format="multipart")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Feedback.objects.count(), 0)
        self.assertEqual(FeedbackImage.objects.count(), 0)

    def test_oversized_photo_rejected_and_rolls_back_feedback(self):
        order = self.make_order()
        self.login_as_customer()
        oversized = SimpleUploadedFile("huge.jpg", b"\xff\xd8\xff" + (b"0" * (6 * 1024 * 1024)), content_type="image/jpeg")
        payload = {**self.valid_payload(order), "images": [oversized]}
        resp = self.client.post(reverse("feedback-create"), payload, format="multipart")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Feedback.objects.count(), 0)

    def test_non_image_file_rejected(self):
        order = self.make_order()
        self.login_as_customer()
        not_image = SimpleUploadedFile("notes.txt", b"just some text", content_type="text/plain")
        payload = {**self.valid_payload(order), "images": [not_image]}
        resp = self.client.post(reverse("feedback-create"), payload, format="multipart")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Feedback.objects.count(), 0)

    def test_too_small_photo_rejected(self):
        order = self.make_order()
        self.login_as_customer()
        tiny = make_test_image("tiny.jpg", size=(50, 50))
        payload = {**self.valid_payload(order), "images": [tiny]}
        resp = self.client.post(reverse("feedback-create"), payload, format="multipart")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Feedback.objects.count(), 0)

    def test_my_feedback_includes_image_urls(self):
        order = self.make_order()
        self.login_as_customer()
        payload = {**self.valid_payload(order), "images": [make_test_image()]}
        self.client.post(reverse("feedback-create"), payload, format="multipart")
        resp = self.client.get(reverse("feedback-mine"))
        results = resp.data["results"]
        self.assertEqual(len(results[0]["images"]), 1)
        self.assertIn("image", results[0]["images"][0])


class FeedbackEligibilityAndAggregateTests(FeedbackTestBase):
    def test_eligible_orders_lists_delivered_unreviewed(self):
        order = self.make_order()
        self.login_as_customer()
        resp = self.client.get(reverse("feedback-eligible-orders"))
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["id"], order.id)

    def test_reviewed_order_drops_out_of_eligible_list(self):
        order = self.make_order()
        self.login_as_customer()
        self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        resp = self.client.get(reverse("feedback-eligible-orders"))
        self.assertEqual(len(resp.data), 0)

    def test_product_average_rating_updates(self):
        order = self.make_order()
        self.login_as_customer()
        self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        self.product.refresh_from_db()
        self.assertEqual(self.product.average_rating, 5.0)
        self.assertEqual(self.product.rating_count, 1)

    def test_no_rating_before_any_feedback(self):
        self.assertIsNone(self.product.average_rating)
        self.assertEqual(self.product.rating_count, 0)

    def test_public_catalog_exposes_rating(self):
        order = self.make_order()
        self.login_as_customer()
        self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        self.client.force_authenticate(user=None)
        resp = self.client.get(reverse("product-list"))
        self.assertEqual(resp.data["results"][0]["average_rating"], 5.0)
        self.assertEqual(resp.data["results"][0]["rating_count"], 1)

    def test_admin_vendor_list_exposes_rating(self):
        order = self.make_order()
        self.login_as_customer()
        self.client.post(reverse("feedback-create"), self.valid_payload(order), format="json")
        admin = make_user(User.Role.ADMIN, "admin@example.com")
        self.client.force_authenticate(user=admin)
        resp = self.client.get(reverse("admin-vendor-list"))
        vendor_row = next(v for v in resp.data if v["email"] == "vendor@example.com")
        self.assertEqual(vendor_row["rating"], 5.0)
