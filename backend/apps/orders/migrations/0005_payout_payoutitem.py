import decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('orders', '0004_coupon_order_discount_amount_order_coupon'),
    ]

    operations = [
        migrations.CreateModel(
            name='Payout',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period_start', models.DateField()),
                ('period_end', models.DateField()),
                ('total_amount', models.DecimalField(decimal_places=2, default=decimal.Decimal('0.00'), max_digits=12)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('paid', 'Paid')], default='pending', max_length=20)),
                ('reference', models.CharField(blank=True, help_text='Bank/wallet transaction reference, entered by the admin when marking this paid.', max_length=100)),
                ('admin_notes', models.TextField(blank=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('vendor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payouts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PayoutItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, help_text='Snapshot of order_item.net_to_vendor at batch-generation time.', max_digits=10)),
                ('order_item', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='payout_item', to='orders.orderitem')),
                ('payout', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='orders.payout')),
            ],
        ),
    ]
