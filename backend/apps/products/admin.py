from django.contrib import admin

from .models import Category, Product, ProductChangeRequest, ProductImage, StockChangeRequest


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "vendor", "category", "brand", "base_price", "stock_quantity", "status", "created_at")
    list_filter = ("status", "category", "brand")
    inlines = [ProductImageInline]


@admin.register(ProductChangeRequest)
class ProductChangeRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "vendor", "change_type", "status", "created_at")
    list_filter = ("status", "change_type")


@admin.register(StockChangeRequest)
class StockChangeRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "vendor", "requested_increase", "status", "created_at")
    list_filter = ("status",)
