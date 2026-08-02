from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_payout_payoutitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='idempotency_key',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Client-generated key (one per checkout attempt, reused across retries of that same attempt). A repeat request with the same key returns the original order instead of creating a duplicate.',
                max_length=64,
                null=True,
                unique=True,
            ),
        ),
    ]
