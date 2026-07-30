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
from django.db import models


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
