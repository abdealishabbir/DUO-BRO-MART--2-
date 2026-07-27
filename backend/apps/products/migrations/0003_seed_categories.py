from django.db import migrations

# Matches the CATEGORIES taxonomy in frontend/src/data/productsMockData.js
# exactly (same names/order) — the Category table backing the vendor
# product form was never seeded, which is why "Category" showed up empty
# when creating a product. Keeping the names aligned with the storefront's
# mock data means things read consistently even though the storefront
# doesn't query this table directly (yet).
CATEGORY_NAMES = [
    "Electronics",
    "Fashion",
    "Home & Living",
    "Sports & Outdoors",
    "Beauty & Personal Care",
    "Books",
]


def seed_categories(apps, schema_editor):
    Category = apps.get_model("products", "Category")
    from django.utils.text import slugify

    for name in CATEGORY_NAMES:
        Category.objects.get_or_create(name=name, defaults={"slug": slugify(name)})


def remove_seeded_categories(apps, schema_editor):
    Category = apps.get_model("products", "Category")
    Category.objects.filter(name__in=CATEGORY_NAMES).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0002_product_is_active_product_sku"),
    ]

    operations = [
        migrations.RunPython(seed_categories, remove_seeded_categories),
    ]
