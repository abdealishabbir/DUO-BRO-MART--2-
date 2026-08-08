"""
§7.4: one Complaint per order line item (same reasoning as Feedback —
a multi-item order can have one item wrong/damaged and others fine).
Unlike Feedback there's no delivered-only gate: a wrong item is often
discovered right on delivery, and "missing item" can be noticed before
the rest of the order even arrives.
"""

from django.conf import settings
from django.db import models


class Complaint(models.Model):
    class Reason(models.TextChoices):
        WRONG_PRODUCT = "wrong_product", "Wrong Product"
        DAMAGED = "damaged", "Damaged Item"
        MISSING_ITEM = "missing_item", "Missing Item"
        NOT_AS_DESCRIBED = "not_as_described", "Not as Described"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        UNDER_REVIEW = "under_review", "Under Review"
        RESOLVED_REFUND = "resolved_refund", "Resolved — Refund"
        RESOLVED_REPLACEMENT = "resolved_replacement", "Resolved — Replacement"
        REJECTED = "rejected", "Rejected"

    order_item = models.OneToOneField("orders.OrderItem", on_delete=models.CASCADE, related_name="complaint")
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaints_filed",
        help_text="Null for a guest checkout — order_item.order is the real link, verified by order_code + contact at submission time.",
    )

    reason = models.CharField(max_length=30, choices=Reason.choices)
    description = models.TextField()
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.OPEN)
    resolution_notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaints_resolved",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Complaint on {self.order_item} ({self.reason})"
