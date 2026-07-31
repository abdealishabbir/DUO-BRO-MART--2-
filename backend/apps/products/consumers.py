"""
§7.1: a single broadcast group ("inventory") rather than per-product
subscriptions — simpler, and the message volume (one per order/restock
approval) is far too low to need per-product fan-out at this scale.
Any connected client (storefront viewing a product, vendor dashboard,
admin dashboard) just filters client-side for the product_id it cares
about.
"""

import json

from channels.generic.websocket import AsyncWebsocketConsumer

INVENTORY_GROUP = "inventory"


class InventoryConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(INVENTORY_GROUP, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(INVENTORY_GROUP, self.channel_name)

    # Dispatched by group_send({"type": "stock.update", ...}) — Channels
    # maps "stock.update" -> this method name automatically.
    async def stock_update(self, event):
        await self.send(text_data=json.dumps({
            "product_id": event["product_id"],
            "slug": event["slug"],
            "stock_quantity": event["stock_quantity"],
            "is_low_stock": event["is_low_stock"],
        }))
