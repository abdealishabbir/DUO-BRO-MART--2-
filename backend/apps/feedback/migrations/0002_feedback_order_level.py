from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0001_initial"),
        ("feedback", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(model_name="feedback", name="order_item"),
        migrations.RemoveField(model_name="feedback", name="comment"),
        migrations.AddField(
            model_name="feedback", name="order",
            field=models.OneToOneField(default=None, on_delete=django.db.models.deletion.CASCADE, related_name="feedback", to="orders.order"),
            preserve_default=False,
        ),
        migrations.AddField(model_name="feedback", name="delivery_rating", field=models.PositiveSmallIntegerField(default=5), preserve_default=False),
        migrations.AddField(model_name="feedback", name="review_text", field=models.TextField(blank=True, max_length=500)),
        migrations.AddField(model_name="feedback", name="would_recommend", field=models.BooleanField(blank=True, null=True)),
        migrations.AlterModelOptions(name="feedback", options={"ordering": ["-created_at"]}),
    ]
