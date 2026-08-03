import apps.accounts.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_vendorapplication'),
    ]

    operations = [
        migrations.AlterField(
            model_name='vendorapplication',
            name='cnic_front',
            field=models.ImageField(upload_to='vendor_applications/cnic/', validators=[apps.accounts.models.validate_cnic_image]),
        ),
        migrations.AlterField(
            model_name='vendorapplication',
            name='cnic_back',
            field=models.ImageField(upload_to='vendor_applications/cnic/', validators=[apps.accounts.models.validate_cnic_image]),
        ),
    ]
