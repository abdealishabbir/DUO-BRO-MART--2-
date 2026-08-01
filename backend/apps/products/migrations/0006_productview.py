import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0005_product_custom_category_request'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source', models.CharField(choices=[('direct', 'Direct'), ('search', 'Search'), ('social', 'Social'), ('other', 'Other')], default='direct', max_length=10)),
                ('viewed_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='views', to='products.product')),
            ],
        ),
        migrations.AddIndex(
            model_name='productview',
            index=models.Index(fields=['product', 'viewed_at'], name='products_pr_product_a5d3f1_idx'),
        ),
    ]
