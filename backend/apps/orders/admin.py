from django.contrib import admin

from .models import Coupon, Order, OrderItem, Payout, PayoutItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_code", "customer", "status", "payment_status", "total", "created_at")
    list_filter = ("status", "payment_status", "payment_method")
    search_fields = ("order_code", "shipping_full_name", "shipping_email")
    inlines = [OrderItemInline]


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "discount_value", "is_active", "used_count")


class PayoutItemInline(admin.TabularInline):
    model = PayoutItem
    extra = 0


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ("id", "vendor", "period_start", "period_end", "total_amount", "status", "paid_at")
    list_filter = ("status",)
    inlines = [PayoutItemInline]
