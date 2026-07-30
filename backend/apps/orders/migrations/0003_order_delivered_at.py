from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0002_orderitem_unit_base_price"),
    ]

    operations = [
        migrations.AddField(
            model_name="order", name="delivered_at",
            field=models.DateTimeField(blank=True, null=True, help_text="Stamped automatically when status becomes 'delivered' (§7.3 return-window countdown)."),
        ),
    ]
