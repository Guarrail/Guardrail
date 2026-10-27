"""
Production settings for GuardRail deployment on Dokploy / Traefik.
Configured for:
- Backend: api.guardraill.xyz
- Frontend: guardraill.xyz / www.guardraill.xyz
"""
import os
from .base import *  # noqa: F401, F403

# Force DEBUG to False unless explicitly set via DJANGO_DEBUG
DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() in ("true", "1", "yes")

# Allowed hosts configuration
_default_hosts = [
    "api.guardraill.xyz",
    "guardraill.xyz",
    "www.guardraill.xyz",
    "web",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
]

_custom_hosts = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
if os.getenv("API_DOMAIN"):
    _custom_hosts.append(os.getenv("API_DOMAIN").strip())
if os.getenv("FRONTEND_DOMAIN"):
    _custom_hosts.append(os.getenv("FRONTEND_DOMAIN").strip())
    _custom_hosts.append(f"www.{os.getenv('FRONTEND_DOMAIN').strip()}")

ALLOWED_HOSTS = list(dict.fromkeys(_default_hosts + _custom_hosts))

# Reverse Proxy & Traefik SSL Headers
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Security Headers & Cookies
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "True").lower() in ("true", "1", "yes")
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "True").lower() in ("true", "1", "yes")
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# CORS & CSRF Origins for guardraill.xyz and api.guardraill.xyz
_production_origins = [
    "https://guardraill.xyz",
    "https://www.guardraill.xyz",
    "https://api.guardraill.xyz",
    "http://guardraill.xyz",
    "http://www.guardraill.xyz",
    "http://api.guardraill.xyz",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

if os.getenv("FRONTEND_DOMAIN"):
    f_dom = os.getenv("FRONTEND_DOMAIN").strip()
    _production_origins.extend([f"https://{f_dom}", f"https://www.{f_dom}"])
if os.getenv("API_DOMAIN"):
    a_dom = os.getenv("API_DOMAIN").strip()
    _production_origins.append(f"https://{a_dom}")

_extra_cors = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(_production_origins + _extra_cors))

_extra_csrf = [o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(_production_origins + _extra_csrf))

# Celery Broker & Backend
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} [{name}:{lineno}] {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
