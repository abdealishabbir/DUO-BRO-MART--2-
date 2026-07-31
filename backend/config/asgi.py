import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Must init the plain HTTP app before importing anything that touches
# models (Channels routing imports consumers, which import models).
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.products.routing import websocket_urlpatterns  # noqa: E402

# §7.1: HTTP unchanged, WebSocket connections (ws://.../ws/inventory/) get
# routed to apps.products.consumers.InventoryConsumer.
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
})
