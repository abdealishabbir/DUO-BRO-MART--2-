"""
§7.3: one Feedback row per order line item (not per whole order) — an
order can span multiple vendors/products, and "product quality" only
makes sense scoped to the specific item, not the order as a whole.
"service"/"packaging"/"overall" are still collected per item rather
than once per order, trading a little redundancy for a simpler model
(one form, one endpoint, no separate "order-level" vs "item-level"
data shapes to keep in sync).
"""

from django.conf import settings
from django.db import models


class Feedback(models.Model):
    order_item = models.OneToOneField("orders.OrderItem", on_delete=models.CASCADE, related_name="feedback")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feedback_given")

    service_rating = models.PositiveSmallIntegerField()
    packaging_rating = models.PositiveSmallIntegerField()
    quality_rating = models.PositiveSmallIntegerField()
    overall_rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Feedback on {self.order_item} ({self.overall_rating}/5)"
