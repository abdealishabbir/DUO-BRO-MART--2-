"""
§7.3: one Feedback per Order (not per line item) — matches the real
post-delivery survey flow: delivery speed, packaging, and customer
service are experienced once per order, not once per product, and a
single "product quality" rating covering the whole order keeps the
form to one page instead of one per item.

Per-item "wrong/damaged" reporting is handled separately by
apps.complaints.Complaint (still one per OrderItem, since that's
genuinely item-specific) — see the "Confirm Items" step in the
frontend order-feedback flow.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from PIL import Image

# Review photos: same "is it actually a readable image" bar as CNIC/banner
# uploads (§8.1 precedent) — no fixed aspect ratio, since these are casual
# customer phone photos, just a sane format/size/dimension floor.
FEEDBACK_IMAGE_MAX_FILE_SIZE_MB = 5
FEEDBACK_IMAGE_MIN_WIDTH = 200
FEEDBACK_IMAGE_MIN_HEIGHT = 200
ALLOWED_FEEDBACK_IMAGE_FORMATS = {"JPEG", "PNG"}
MAX_FEEDBACK_IMAGES = 5


def validate_feedback_image(image_file):
    if image_file.size > FEEDBACK_IMAGE_MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ValidationError(f"Image is too large — please upload a file under {FEEDBACK_IMAGE_MAX_FILE_SIZE_MB}MB.")

    try:
        img = Image.open(image_file)
        img.verify()
        image_file.seek(0)
        img = Image.open(image_file)  # re-open: verify() leaves the image unusable
        width, height = img.size
        image_format = img.format
    except Exception as exc:
        raise ValidationError("Couldn't read that image file — please upload a valid PNG or JPEG.") from exc
    finally:
        image_file.seek(0)

    if image_format not in ALLOWED_FEEDBACK_IMAGE_FORMATS:
        raise ValidationError("Only PNG, JPG, or JPEG images are allowed.")
    if width < FEEDBACK_IMAGE_MIN_WIDTH or height < FEEDBACK_IMAGE_MIN_HEIGHT:
        raise ValidationError(
            f"Image is only {width}x{height}px — please upload a clearer photo "
            f"(minimum {FEEDBACK_IMAGE_MIN_WIDTH}x{FEEDBACK_IMAGE_MIN_HEIGHT}px)."
        )


class Feedback(models.Model):
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="feedback")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feedback_given")

    delivery_rating = models.PositiveSmallIntegerField()
    packaging_rating = models.PositiveSmallIntegerField()
    quality_rating = models.PositiveSmallIntegerField()
    service_rating = models.PositiveSmallIntegerField()
    overall_rating = models.PositiveSmallIntegerField()

    review_text = models.TextField(blank=True, max_length=500)
    would_recommend = models.BooleanField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Feedback on {self.order.order_code} ({self.overall_rating}/5)"


def feedback_image_upload_path(instance, filename):
    return f"feedback/{instance.feedback_id}/{filename}"


class FeedbackImage(models.Model):
    feedback = models.ForeignKey(Feedback, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=feedback_image_upload_path, validators=[validate_feedback_image])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"Photo for feedback #{self.feedback_id}"
