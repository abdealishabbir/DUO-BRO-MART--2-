from rest_framework import serializers

from .models import AuditLogEntry, PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    """§6.7: full admin view/edit."""

    class Meta:
        model = PlatformSettings
        fields = [
            "store_name", "store_email", "currency",
            "default_shipping_rate", "free_shipping_threshold", "handling_time",
            "cod_enabled", "card_enabled", "jazzcash_enabled", "easypaisa_enabled",
            "payout_hold_days", "payout_cycle_days",
            "notify_new_orders", "notify_new_vendor_applications", "notify_low_stock", "notify_payout_requests",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class PublicPlatformSettingsSerializer(serializers.ModelSerializer):
    """Only what the storefront/checkout needs — no notification-toggle internals exposed publicly."""

    class Meta:
        model = PlatformSettings
        fields = [
            "store_name", "currency", "default_shipping_rate", "free_shipping_threshold",
            "cod_enabled", "card_enabled", "jazzcash_enabled", "easypaisa_enabled",
        ]
        read_only_fields = fields


class AuditLogEntrySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLogEntry
        fields = ["id", "actor_name", "action", "target_type", "target_id", "target_repr", "details", "created_at"]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor is None:
            return "System"
        return f"{obj.actor.first_name} {obj.actor.last_name}".strip() or obj.actor.username
