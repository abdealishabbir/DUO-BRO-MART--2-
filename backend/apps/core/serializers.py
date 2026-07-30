from rest_framework import serializers

from .models import PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    """§6.7: full admin view/edit."""

    class Meta:
        model = PlatformSettings
        fields = [
            "store_name", "store_email", "currency",
            "default_shipping_rate", "free_shipping_threshold", "handling_time",
            "cod_enabled", "card_enabled", "jazzcash_enabled", "easypaisa_enabled",
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
