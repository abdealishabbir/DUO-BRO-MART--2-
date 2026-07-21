from rest_framework import serializers

from .models import Banner, BannerApplication, BannerPayment, PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSettings
        fields = ["banner_price_per_day", "carousel_slot_limit", "updated_at"]
        read_only_fields = ["updated_at"]


class BannerApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BannerApplication
        fields = [
            "id", "image", "headline", "description", "cta_label", "cta_url",
            "requested_days", "payment_type", "requested_start_date",
            "price_per_day_snapshot", "total_price", "status", "created_at",
        ]
        read_only_fields = ["id", "price_per_day_snapshot", "total_price", "status", "created_at"]

    def validate_requested_days(self, value):
        if value < 1:
            raise serializers.ValidationError("Must run for at least 1 day.")
        if value > 90:
            raise serializers.ValidationError("Max 90 days per request — contact admin for longer campaigns.")
        return value

    def create(self, validated_data):
        vendor = self.context["request"].user
        price_per_day = PlatformSettings.get_solo().banner_price_per_day
        application = BannerApplication.objects.create(
            vendor=vendor,
            price_per_day_snapshot=price_per_day,
            total_price=price_per_day * validated_data["requested_days"],
            **validated_data,
        )
        return application


class BannerApplicationSerializer(serializers.ModelSerializer):
    vendor_name = serializers.SerializerMethodField()
    vendor_email = serializers.EmailField(source="vendor.email", read_only=True)

    class Meta:
        model = BannerApplication
        fields = [
            "id", "vendor", "vendor_name", "vendor_email", "image", "headline", "description",
            "cta_label", "cta_url", "requested_days", "payment_type",
            "price_per_day_snapshot", "total_price", "requested_start_date",
            "status", "admin_notes", "created_at", "decided_at",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username


class BannerPaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BannerPayment
        fields = ["id", "amount", "note", "recorded_by_name", "paid_at"]
        read_only_fields = fields

    def get_recorded_by_name(self, obj):
        return obj.recorded_by.username if obj.recorded_by else "system"


class BannerSerializer(serializers.ModelSerializer):
    """Full detail — used by both the vendor's own status view and the admin live-banner table."""

    vendor_name = serializers.SerializerMethodField()
    penalty_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)
    payments = BannerPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Banner
        fields = [
            "id", "vendor", "vendor_name", "image", "headline", "description", "cta_label", "cta_url",
            "slot_position", "payment_type", "price_per_day", "days", "total_price",
            "status", "live_start_date", "live_end_date",
            "paid_amount", "penalty_amount", "remaining_amount", "days_overdue",
            "payments", "created_at",
        ]
        read_only_fields = fields

    def get_vendor_name(self, obj):
        return f"{obj.vendor.first_name} {obj.vendor.last_name}".strip() or obj.vendor.username


class PublicBannerSerializer(serializers.ModelSerializer):
    """What the customer-facing home page carousel actually receives — no payment internals."""

    class Meta:
        model = Banner
        fields = ["id", "image", "headline", "description", "cta_label", "cta_url", "slot_position"]
