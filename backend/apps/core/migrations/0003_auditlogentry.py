import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0002_payout_schedule_settings'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLogEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(help_text='e.g. "product.approved", "order.status_changed".', max_length=50)),
                ('target_type', models.CharField(help_text='e.g. "Product", "Order", "VendorApplication".', max_length=50)),
                ('target_id', models.PositiveIntegerField()),
                ('target_repr', models.CharField(blank=True, max_length=200)),
                ('details', models.TextField(blank=True, help_text="Extra context, e.g. a rejection reason or old->new status.")),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_log_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='auditlogentry',
            index=models.Index(fields=['target_type', 'target_id'], name='core_auditlog_target_idx'),
        ),
    ]
