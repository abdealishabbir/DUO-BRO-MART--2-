import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Address, VendorApplication

User = get_user_model()


_SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`'\""


def _validate_strong_password(value: str) -> None:
    """PRD §4.2 (tightened per §8 hardening pass): min 8 chars (also
    enforced by AUTH_PASSWORD_VALIDATORS), plus the full character-mix
    bar — at least one uppercase letter, one lowercase letter, one digit,
    and one symbol. Vendor/admin accounts on this platform hold real
    money (payouts, saved orders), so "uppercase + digit" alone wasn't
    enough; lowercase and symbol were the two missing classes."""
    validate_password(value)  # runs Django's configured validators (length, common, numeric-only)
    if not re.search(r"[A-Z]", value):
        raise serializers.ValidationError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", value):
        raise serializers.ValidationError("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", value):
        raise serializers.ValidationError("Password must contain at least one number.")
    if not any(char in _SPECIAL_CHARS for char in value):
        raise serializers.ValidationError(f"Password must contain at least one special character ({_SPECIAL_CHARS}).")


class SignupSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=17)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    terms_accepted = serializers.BooleanField()
    recaptcha_token = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_phone_number(self, value):
        # Reuses the same validator attached to the model field so the two
        # never drift out of sync.
        User.phone_number.field.run_validators(value)
        return value

    def validate_password(self, value):
        _validate_strong_password(value)
        return value

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError("You must agree to the Terms & Conditions to sign up.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        full_name = validated_data["full_name"].strip()
        first_name, _, last_name = full_name.partition(" ")

        user = User(
            username=validated_data["email"],
            email=validated_data["email"],
            first_name=first_name,
            last_name=last_name,
            phone_number=validated_data["phone_number"],
            role=User.Role.CUSTOMER,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    keep_logged_in = serializers.BooleanField(required=False, default=False)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        _validate_strong_password(value)
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        _validate_strong_password(value)
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "full_name", "first_name", "last_name", "email",
            "phone_number", "role", "email_verified", "must_change_password",
            "shop_name", "shop_logo", "shop_description",
        ]
        read_only_fields = ["id", "email", "role", "email_verified", "must_change_password"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """PRD §2.5 Account Page: update name/phone (email change is Phase 8 —
    changing it here would need a re-verification flow, deliberately not
    included yet so we don't ship a half-secured email-change path).

    shop_name/shop_logo/shop_description are vendor-only (storefront
    customization) — accepted here too rather than a separate endpoint,
    same one-endpoint-for-profile-fields pattern as phone_number, but
    guarded in validate() so a customer can't set a "shop" on themselves.
    """

    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone_number", "shop_name", "shop_logo", "shop_description"]

    def validate(self, attrs):
        shop_fields_present = {"shop_name", "shop_logo", "shop_description"} & set(attrs.keys())
        if shop_fields_present and self.instance.role != User.Role.VENDOR:
            raise serializers.ValidationError("Only vendor accounts have a storefront profile.")
        return attrs


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id", "label", "full_name", "phone_number", "province",
            "city", "address_line", "landmark", "is_default",
        ]

    def create(self, validated_data):
        user = self.context["request"].user
        if validated_data.get("is_default"):
            Address.objects.filter(user=user, is_default=True).update(is_default=False)
        return Address.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            Address.objects.filter(user=instance.user, is_default=True).exclude(pk=instance.pk).update(is_default=False)
        return super().update(instance, validated_data)


class VendorApplicationCreateSerializer(serializers.ModelSerializer):
    """§5.7: the public BecomeVendor.jsx form submits here — no auth required."""

    class Meta:
        model = VendorApplication
        fields = [
            "id", "business_name", "owner_name", "email", "phone_number", "business_type",
            "description", "social_links", "cnic_number", "cnic_front", "cnic_back",
            "bank_name", "account_title", "account_number", "account_cnic",
        ]
        read_only_fields = ["id"]


class VendorApplicationSerializer(serializers.ModelSerializer):
    """§6.5: admin review list/detail — read-only, decisions happen via the approve/reject actions."""

    cnic_matches = serializers.BooleanField(read_only=True)

    class Meta:
        model = VendorApplication
        fields = [
            "id", "business_name", "owner_name", "email", "phone_number", "business_type",
            "description", "social_links", "cnic_number", "cnic_front", "cnic_back",
            "bank_name", "account_title", "account_number", "account_cnic", "cnic_matches",
            "status", "admin_notes", "decided_at", "created_vendor", "created_at",
        ]
        read_only_fields = fields
