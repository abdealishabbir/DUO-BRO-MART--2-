"""
Duo Bro Mart — Django settings.

Phase 1 scope: project shell, custom User model (role field for RBAC),
DRF wired in with a default "deny unless authenticated" posture, CORS
open to the local Vite dev server. Real authentication (JWT/session,
social login) lands in Phase 2 — see accounts/permissions.py for the
RBAC classes that Phase 2+ views will use.
"""

from pathlib import Path
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Core ---
SECRET_KEY = config("DJANGO_SECRET_KEY", default="dev-insecure-key-change-me")
DEBUG = config("DJANGO_DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv()
)

# --- Applications ---
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",  # refresh-token revocation on logout/reset (S4.2/S4.4)
    "corsheaders",
    # local apps
    "apps.accounts",
    "apps.core",
    "apps.banners",
    "apps.products",
    "apps.orders",
    "apps.feedback",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="duobromart"),
        "USER": config("POSTGRES_USER", default="duobromart"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="duobromart"),
        "HOST": config("POSTGRES_HOST", default="db"),
        "PORT": config("POSTGRES_PORT", default="5432"),
    }
}

# --- Cache / Redis (used by Celery + rate limiting from Phase 2 onward) ---
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://redis:6379/0"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

# --- Custom user model (RBAC foundation — see apps/accounts/models.py) ---
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Password hashing (PRD S4.4.1: Argon2 preferred over PBKDF2 default) ---
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

# --- Email (PRD S4.2: verification links, reset links). Dev default prints
# to the console so signup/reset flows are testable without real SMTP; set
# real EMAIL_HOST/... in .env for staging/production. ---
if config("EMAIL_HOST", default=""):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = config("EMAIL_HOST")
    EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
    EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
    EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
    EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="Duo Bro Mart <no-reply@duobromart.com>")

# Where auto-suspension notices (banner nonpayment, §banners) get sent.
# Blank = notification skipped (still logs to console via EMAIL_BACKEND in dev).
ADMIN_NOTIFICATION_EMAIL = config("ADMIN_NOTIFICATION_EMAIL", default="")

# Used to build absolute links in emails (verification, password reset) that
# point at the React app, not the API.
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173")

# --- Social login (PRD S4.2/S2.2): verified server-side per S4.4. Signup/
# login endpoints degrade to a clear "not configured" error if these are
# blank, rather than failing in a confusing way — see accounts/views.py. ---
GOOGLE_OAUTH_CLIENT_ID = config("GOOGLE_OAUTH_CLIENT_ID", default="")
FACEBOOK_APP_ID = config("FACEBOOK_APP_ID", default="")
FACEBOOK_APP_SECRET = config("FACEBOOK_APP_SECRET", default="")

# --- reCAPTCHA on signup (PRD S4.4.8). No-ops until a real site/secret key
# is configured — full wiring happens in Phase 8 hardening; the check
# point already exists in accounts/utils.py so nothing needs to change
# structurally later, only the .env values. ---
RECAPTCHA_SECRET_KEY = config("RECAPTCHA_SECRET_KEY", default="")

# --- JWT (PRD S4.4.3: secure, HttpOnly, SameSite cookies — not localStorage) ---
from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),   # overridden per-login to 30 days if "keep me logged in" (S4.2)
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Cookie names/settings shared between login/refresh/logout views.
JWT_ACCESS_COOKIE = "dbm_access"
JWT_REFRESH_COOKIE = "dbm_refresh"
JWT_REFRESH_LIFETIME_DEFAULT = timedelta(days=1)
JWT_REFRESH_LIFETIME_KEEP_LOGGED_IN = timedelta(days=30)
# Secure=False only makes sense over plain HTTP in local dev; anything else must be HTTPS.
JWT_COOKIE_SECURE = not DEBUG
JWT_COOKIE_SAMESITE = "Lax"

# --- i18n / tz ---
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Karachi"
USE_I18N = True
USE_TZ = True

# --- Static / media ---
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF: default posture is "must be authenticated"; Phase 1 exposes
# only a public health-check view (explicitly AllowAny). Phase 2 adds
# JWT auth classes; role-based access itself lives in
# apps/accounts/permissions.py (IsCustomerRole, IsVendorRole, IsAdminRole). ---
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.CookieJWTAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,  # matches §5.3.4: max 20 products per page
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    # PRD §4.4.8: throttle auth endpoints against brute force / bot signup spam.
    # Account-level lockout (separate from this IP-based throttle) lives in
    # accounts/utils.py (record_failed_login / is_locked_out).
    "DEFAULT_THROTTLE_RATES": {
        "auth-write": "10/min",
    },
}

# --- CORS: local Vite dev server only for now; tighten for production ---
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True
