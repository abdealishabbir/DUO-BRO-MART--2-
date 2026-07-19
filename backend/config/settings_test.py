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

# Throttling is real infra behavior, but a shared LocMemCache across dozens
# of sequential test requests would trip it long before any individual
# test's own logic is exercised. Disabled here; re-enabled explicitly via
# override_settings in the one test that targets throttling itself.
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}
