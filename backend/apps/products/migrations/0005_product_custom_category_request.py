import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_commissionrate'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='category',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='products',
                to='products.category',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='requested_category_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text="Vendor's suggested category name, only set when category is null (vendor chose 'Other'). Cleared once an admin resolves it.",
                max_length=100,
            ),
        ),
    ]
