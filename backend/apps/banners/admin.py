from django.contrib import admin

from .models import Banner, BannerApplication, BannerPayment, PlatformSettings


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ("banner_price_per_day", "carousel_slot_limit", "updated_at")


@admin.register(BannerApplication)
class BannerApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "vendor", "headline", "payment_type", "status", "total_price", "created_at")
    list_filter = ("status", "payment_type")


class BannerPaymentInline(admin.TabularInline):
    model = BannerPayment
    extra = 0
    readonly_fields = ("amount", "note", "recorded_by", "paid_at")


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("id", "vendor", "headline", "slot_position", "status", "payment_type", "live_start_date", "live_end_date")
    list_filter = ("status", "payment_type")
    inlines = [BannerPaymentInline]
