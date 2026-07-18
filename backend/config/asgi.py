import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Phase 1: plain ASGI app. Phase 7 wraps this with Channels' ProtocolTypeRouter
# to add ws://.../ws/stock/ and ws://.../ws/admin/dashboard/ (PRD §8, §10.4).
application = get_asgi_application()
