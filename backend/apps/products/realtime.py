"""§7.1: thin wrapper so Product.save() (and anything else) can broadcast without importing Channels directly."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .consumers import INVENTORY_GROUP


def broadcast_stock_update(product) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:  # no channel layer configured (e.g. some test environments) — just skip
        return
    async_to_sync(channel_layer.group_send)(INVENTORY_GROUP, {
        "type": "stock.update",
        "product_id": product.id,
        "slug": product.slug,
        "stock_quantity": product.stock_quantity,
        "is_low_stock": product.is_low_stock,
    })
