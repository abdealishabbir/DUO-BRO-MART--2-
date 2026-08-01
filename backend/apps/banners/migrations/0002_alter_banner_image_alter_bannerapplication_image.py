import apps.banners.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('banners', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='banner',
            name='image',
            field=models.ImageField(upload_to=apps.banners.models.banner_upload_path, validators=[apps.banners.models.validate_banner_image]),
        ),
        migrations.AlterField(
            model_name='bannerapplication',
            name='image',
            field=models.ImageField(upload_to=apps.banners.models.banner_upload_path, validators=[apps.banners.models.validate_banner_image]),
        ),
    ]
