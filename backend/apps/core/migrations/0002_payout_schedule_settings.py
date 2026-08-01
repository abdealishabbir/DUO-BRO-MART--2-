from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='payout_hold_days',
            field=models.PositiveSmallIntegerField(
                default=3,
                help_text="Days after delivery before a vendor's earnings on that order become payout-eligible.",
            ),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='payout_cycle_days',
            field=models.PositiveSmallIntegerField(
                default=7,
                help_text='Minimum days between payout batches for the same vendor.',
            ),
        ),
    ]
