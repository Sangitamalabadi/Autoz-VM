
"""
Django settings for AutoZ project.

Development: SQLite + Local Media Storage (fallback)
Production: PostgreSQL + Cloudinary (Render)
"""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv


# --------------------------------------------------
# BASE DIRECTORY
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent


# --------------------------------------------------
# ENVIRONMENT CONFIGURATION
# --------------------------------------------------

# Load environment variables from project root .env
# Existing system environment variables take precedence.
load_dotenv(BASE_DIR / ".env")

DEBUG = os.environ.get("DEBUG", "True").lower() in (
    "true",
    "1",
    "yes",
)

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-local-development-only",
)

if not DEBUG and SECRET_KEY == "django-insecure-local-development-only":
    raise ValueError(
        "DJANGO_SECRET_KEY must be configured in production."
    )


# --------------------------------------------------
# SECURITY SETTINGS
# --------------------------------------------------

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        "ALLOWED_HOSTS",
        "localhost,127.0.0.1",
    ).split(",")
    if host.strip()
]

SECURE_PROXY_SSL_HEADER = (
    "HTTP_X_FORWARDED_PROTO",
    "https",
)

SECURE_SSL_REDIRECT = not DEBUG

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False

SESSION_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"
CSRF_COOKIE_SAMESITE = "None" if not DEBUG else "Lax"

SESSION_COOKIE_NAME = "sessionid"
CSRF_COOKIE_NAME = "csrftoken"

SESSION_COOKIE_PATH = "/"
CSRF_COOKIE_PATH = "/"


# --------------------------------------------------
# APPLICATION DEFINITION
# --------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Project Apps
    "marketplace.apps.MarketplaceConfig",

    # Third Party Apps
    "rest_framework",
    "drf_spectacular",
    "corsheaders",

    # Cloudinary
    "cloudinary_storage",
    "cloudinary",
]


# --------------------------------------------------
# CLOUDINARY CONFIGURATION
# --------------------------------------------------

CLOUDINARY_CLOUD_NAME = os.environ.get(
    "CLOUDINARY_CLOUD_NAME",
    "",
).strip()

CLOUDINARY_API_KEY = os.environ.get(
    "CLOUDINARY_API_KEY",
    "",
).strip()

CLOUDINARY_API_SECRET = os.environ.get(
    "CLOUDINARY_API_SECRET",
    "",
).strip()

CLOUDINARY_CONFIGURED = all([
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
])

CLOUDINARY_STORAGE = {
    "CLOUD_NAME": CLOUDINARY_CLOUD_NAME,
    "API_KEY": CLOUDINARY_API_KEY,
    "API_SECRET": CLOUDINARY_API_SECRET,
}

# Production must have valid Cloudinary configuration.
if not DEBUG and not CLOUDINARY_CONFIGURED:
    raise ValueError(
        "Cloudinary credentials must be configured in production."
    )


# --------------------------------------------------
# DJANGO REST FRAMEWORK
# --------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": (
        "drf_spectacular.openapi.AutoSchema"
    ),

    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
}


# --------------------------------------------------
# SWAGGER / OPENAPI
# --------------------------------------------------

SPECTACULAR_SETTINGS = {
    "TITLE": "AutoZ Auction API",
    "DESCRIPTION": (
        "Company Level Vehicle Auction Platform - "
        "Vehicle, Auction, Ticket & Bidding System"
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}


# --------------------------------------------------
# MIDDLEWARE
# --------------------------------------------------

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",

    "whitenoise.middleware.WhiteNoiseMiddleware",

    "corsheaders.middleware.CorsMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# --------------------------------------------------
# URL CONFIGURATION
# --------------------------------------------------

ROOT_URLCONF = "core.urls"


# --------------------------------------------------
# TEMPLATES
# --------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "marketplace" / "templates",
        ],
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


# --------------------------------------------------
# WSGI APPLICATION
# --------------------------------------------------

WSGI_APPLICATION = "core.wsgi.application"


# --------------------------------------------------
# DATABASE CONFIGURATION
# --------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=not DEBUG,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# --------------------------------------------------
# PASSWORD VALIDATION
# --------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# --------------------------------------------------
# INTERNATIONALIZATION
# --------------------------------------------------

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# --------------------------------------------------
# STATIC FILES
# --------------------------------------------------

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"


# --------------------------------------------------
# MEDIA FILES
# --------------------------------------------------

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"


# --------------------------------------------------
# MEDIA STORAGE CONFIGURATION
# --------------------------------------------------

# Cloudinary is used when credentials are configured.
# Local filesystem storage is used when credentials
# are missing during local development.

if CLOUDINARY_CONFIGURED:
    MEDIA_STORAGE_BACKEND = (
        "cloudinary_storage.storage.MediaCloudinaryStorage"
    )
else:
    MEDIA_STORAGE_BACKEND = (
        "django.core.files.storage.FileSystemStorage"
    )


STORAGES = {
    "default": {
        "BACKEND": MEDIA_STORAGE_BACKEND,
    },
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage.CompressedManifestStaticFilesStorage"
        ),
    },
}


# --------------------------------------------------
# EMAIL CONFIGURATION
# --------------------------------------------------

EMAIL_BACKEND = (
    "django.core.mail.backends.console.EmailBackend"
)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

FRONTEND_URL = os.environ.get(
    "FRONTEND_URL",
    "http://localhost:5173",
).rstrip("/")

CORS_ALLOWED_ORIGINS = [
    FRONTEND_URL,
]

CORS_ALLOW_CREDENTIALS = True


# --------------------------------------------------
# CSRF CONFIGURATION
# --------------------------------------------------

CSRF_TRUSTED_ORIGINS = [
    FRONTEND_URL,
]

if DEBUG:
    CORS_ALLOWED_ORIGINS.extend([
        "http://127.0.0.1:5173",
    ])

    CSRF_TRUSTED_ORIGINS.extend([
        "http://127.0.0.1:5173",
    ])


# --------------------------------------------------
# SESSION CONFIGURATION
# --------------------------------------------------

SESSION_ENGINE = "django.contrib.sessions.backends.db"

SESSION_COOKIE_AGE = 1209600

SESSION_SAVE_EVERY_REQUEST = False


# --------------------------------------------------
# DEFAULT PRIMARY KEY
# --------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --------------------------------------------------
# CSRF FAILURE DIAGNOSTICS
# --------------------------------------------------

CSRF_FAILURE_VIEW = "core.views.csrf_failure"
