"""
Not used by Docker Compose or production. Only for running the automated
test suite in environments without a live Postgres/Redis (e.g. CI runners,
or this sandbox during development). Real local dev should still use
`docker compose up` against the settings in settings.py.
"""

from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# This file's whole point is "no live Redis needed" — but CHANNEL_LAYERS
# in settings.py still points at channels_redis.core.RedisChannelLayer,
# so anything that decrements stock (order create/cancel, stock change
# requests) was hitting a real Redis connection anyway and failing in any
# sandbox without one. InMemoryChannelLayer round-trips group_send/receive
# within the test process itself — same signal-broadcast code path is
# still exercised, just without a network hop.
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}

import tempfile  # noqa: E402
MEDIA_ROOT = tempfile.mkdtemp(prefix="dbm_test_media_")

# Throttling is real infra behavior, but a shared LocMemCache across dozens
# of sequential test requests would trip it long before any individual
# test's own logic is exercised. Disabled here; re-enabled explicitly via
# override_settings in the one test that targets throttling itself.
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}
