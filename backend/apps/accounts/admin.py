from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "role", "is_active", "date_joined")
    list_filter = ("role", "is_active", "email_verified")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Duo Bro Mart", {"fields": ("role", "phone_number", "email_verified", "must_change_password")}),
    )
