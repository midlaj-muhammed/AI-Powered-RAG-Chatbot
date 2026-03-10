import os
from pathlib import Path

import dj_database_url
import structlog

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY
SECRET_KEY = os.environ.get(
    "SECRET_KEY", "django-insecure-change-me-in-production"
)
DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "yes")
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# HTTPS settings (enabled when not in DEBUG)
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
# Use Strict for API endpoints to prevent CSRF
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# CSRF Hardening
CSRF_FAILURE_VIEW = "utils.csrf_views.csrf_failure_view"
# Use CORS origins for CSRF trusted origins (they have schemes)
CSRF_TRUSTED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
CSRF_COOKIE_NAME = "csrftoken"
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"

# Additional CSRF settings for SPA
CSRF_COOKIE_AGE = 60 * 60 * 24 * 7  # 1 week
CSRF_INCLUDE_SUBDOMAINS = False

# Content Security Policy (applied via middleware)
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'",)
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
CSP_IMG_SRC = ("'self'", "data:", "blob:")
CSP_FONT_SRC = ("'self'",)
CSP_CONNECT_SRC = ("'self'",)

# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "django_q",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.users",
    "apps.chat",
    "apps.documents",
    "apps.rag",
    "apps.analytics",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "utils.middleware.RequestIDMiddleware",  # Add request ID first
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "utils.middleware.IPBlacklistMiddleware",  # Block blacklisted IPs
    "utils.middleware.AttackDetectionMiddleware",  # Detect attack patterns
    "utils.middleware.RequestSizeMiddleware",  # Enforce request size limits
    "utils.middleware.RateLimitMiddleware",  # Enhanced rate limiting
    "django.contrib.messages.middleware.MessageMiddleware",
    "utils.middleware.SecurityHeadersMiddleware",  # Add security headers
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

# Database
DATABASES = {
    "default": dj_database_url.config(
        default="postgres://raguser:ragpassword@db:5432/ragchatbot",
        conn_max_age=600,
    )
}

# Custom User Model
AUTH_USER_MODEL = "users.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "apps.users.validators.CustomPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Media files
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# File upload limits
FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    # Enhanced throttling with custom classes
    "DEFAULT_THROTTLE_CLASSES": (
        "utils.throttling.BurstRateThrottle",
        "utils.throttling.SignedRequestRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "user": "100/minute",
        "anon": "30/minute",
        "auth": "10/minute",           # Authentication endpoints
        "chat": "30/minute",           # Chat endpoints
        "upload": "5/minute",          # File uploads
        "download": "30/minute",       # File downloads
        "admin": "200/minute",         # Admin operations
        "export": "5/hour",            # Data exports
        "sensitive": "20/minute",      # Sensitive operations
        "burst": "5/10s",             # Burst rate
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "utils.exceptions.custom_exception_handler",
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "TOKEN_OBTAIN_SERIALIZER": "apps.users.serializers.CustomTokenObtainPairSerializer",
}

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
CORS_ALLOW_CREDENTIALS = True

# Redis Cache
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://redis:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

# Django-Q2 Configuration
Q_CLUSTER = {
    "name": "rag-chatbot",
    "workers": 2,
    "recycle": 500,
    "timeout": 300,
    "compress": True,
    "save_limit": 250,
    "queue_limit": 500,
    "cpu_affinity": 1,
    "label": "Django Q2",
    "redis": os.environ.get("REDIS_URL", "redis://redis:6379/0"),
}

# DRF Spectacular (OpenAPI)
SPECTACULAR_SETTINGS = {
    "TITLE": "RAG Chatbot API",
    "DESCRIPTION": "AI-Powered RAG Chatbot for Company Database Analysis",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "structlog.stdlib.ProcessorFormatter",
            "processors": [
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.dev.ConsoleRenderer(),
            ],
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}

# Google AI Configuration (fallback provider)
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash-exp")

# Groq Configuration (recommended free provider)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

# LLM Provider Selection
# Options: "groq", "gemini", "openai", "ollama"
# Default: "groq" (free, fast, high quality)
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "groq")

# OpenAI Configuration (for OpenAI-compatible APIs like Together AI)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "")

# Ollama Configuration (local)
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

# Embedding Configuration
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-004")
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "groq")
EMBEDDING_API_KEY = os.environ.get("EMBEDDING_API_KEY", "")

# RAG Configuration Defaults
RAG_CONFIG = {
    "top_k": 5,
    "similarity_threshold": 0.3,
    "max_context_tokens": 4000,
    "chunk_size": 800,
    "chunk_overlap": 200,
    "temperature": 0.3,
    "max_output_tokens": 2048,
}

# Chroma Configuration
CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", str(BASE_DIR / "chroma_data"))

# Upload Configuration
ALLOWED_UPLOAD_TYPES = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB

# API Security Configuration
API_SIGNING_SECRET = os.environ.get("API_SIGNING_SECRET", "")  # Set for request signing
API_SIGNING_ALGORITHM = os.environ.get("API_SIGNING_ALGORITHM", "sha256")
TIMESTAMP_TOLERANCE = int(os.environ.get("TIMESTAMP_TOLERANCE", "300"))  # 5 minutes

# Security Monitoring
LOG_FAILED_ATTEMPTS = not DEBUG
BLOCK_ON_SUSPICIOUS_THRESHOLD = 10  # Failed attempts before blocking
