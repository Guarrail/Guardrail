import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
load_dotenv(BASE_DIR / ".env")

# Add base directory to python sys.path
sys.path.insert(0, str(BASE_DIR))

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv("SECRET_KEY", "guardrail-production-secure-key-stellar-policy-coordinator-2026")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "*").split(",") if h.strip()]

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party packages
    "corsheaders",
    "rest_framework",
    "drf_spectacular",

    # GuardRail Core Modules
    "apps.core.apps.CoreConfig",
    "apps.accounts.apps.AccountsConfig",
    "apps.wallets.apps.WalletsConfig",
    "apps.policies.apps.PoliciesConfig",
    "apps.agents.apps.AgentsConfig",
    "apps.coordinator.apps.CoordinatorConfig",
    "apps.audit.apps.AuditConfig",
    "apps.smart_contracts.apps.SmartContractsConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.core.middleware.DisableCSRFForAPIMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "guardrail.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "guardrail.wsgi.application"

import sys

# Database Configuration: In-memory SQLite for test suites, PostgreSQL for Docker / Production
import urllib.parse
from pathlib import Path

# Database Configuration: In-memory SQLite for test suites, PostgreSQL for Docker / Production
if "pytest" in sys.modules or "test" in sys.argv:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
elif os.getenv("DATABASE_URL"):
    url = urllib.parse.urlparse(os.getenv("DATABASE_URL"))
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": url.path[1:],
            "USER": url.username,
            "PASSWORD": url.password,
            "HOST": url.hostname,
            "PORT": str(url.port or 5432),
        }
    }
elif os.getenv("DB_HOST") or os.getenv("POSTGRES_HOST") or os.getenv("DB_ENGINE") in ("django.db.backends.postgresql", "postgresql", "postgres") or os.getenv("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB") or os.getenv("DB_NAME", "guardrail_db"),
            "USER": os.getenv("POSTGRES_USER") or os.getenv("DB_USER", "guardrail_user"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD") or os.getenv("DB_PASSWORD", "guardrail_secure_password"),
            "HOST": os.getenv("POSTGRES_HOST") or os.getenv("DB_HOST", "db"),
            "PORT": os.getenv("POSTGRES_PORT") or os.getenv("DB_PORT", "5432"),
        }
    }
else:
    sqlite_path = Path(os.getenv("SQLITE_PATH", BASE_DIR / "data" / "db.sqlite3"))
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": sqlite_path,
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static and media files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Traefik / Reverse Proxy SSL & Header Forwarding
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

from corsheaders.defaults import default_headers

CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "True").lower() in ("true", "1", "yes")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-agent-key",
]

_default_cors_origins = [
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
_extra_cors = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(_default_cors_origins + _extra_cors))

_default_csrf_origins = [
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
    "http://0.0.0.0:3000",
    "http://0.0.0.0:8000",
    "http://localhost",
    "http://127.0.0.1",
    "https://localhost:3000",
    "https://127.0.0.1:3000",
]
_extra_csrf = [o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(_default_csrf_origins + _extra_csrf))

# Celery & Redis Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60

# Django REST Framework Settings
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# DRF Spectacular OpenAPI / Swagger 3.0 & ReDoc Documentation Settings
SPECTACULAR_SETTINGS = {
    "TITLE": "GuardRail API",
    "DESCRIPTION": (
        "GuardRail is a policy-controlled capital management infrastructure built on Stellar that allows "
        "AI agents to initiate financial transactions without giving them unrestricted control over digital assets.\n\n"
        "Key Capabilities:\n"
        "- Policy Evaluation Engine (Single tx limits, daily/weekly budgets, recipient/asset allowlists)\n"
        "- Single-Use Cryptographically Bound Permits (Payload hash verification)\n"
        "- Stellar Multisig Guardrail (Agent weight 1, Co-signer weight 1, Threshold 2)\n"
        "- Operator Review & Human Approval Workflows\n"
        "- Immutable Audit Logging with Stellar Explorer links\n"
        "- Soroban Smart Contract Verification & Simulation"
    ),
    "VERSION": "1.0.0",
    # Pin to a stable version without the import.meta bundle bug:
    "REDOC_DIST": "https://cdn.jsdelivr.net/npm/redoc@2.1.5",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": True,
        "filter": True,
    },
    "COMPONENT_SPLIT_REQUEST": True,
}

# Stellar Network & Multisig Configuration
STELLAR_NETWORK = os.getenv("STELLAR_NETWORK", "TESTNET")
STELLAR_HORIZON_URL = os.getenv("STELLAR_HORIZON_URL", "https://horizon-testnet.stellar.org")
STELLAR_NETWORK_PASSPHRASE = os.getenv("STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015")
GUARDRAIL_COSIGNER_PUBLIC_KEY = os.getenv("GUARDRAIL_COSIGNER_PUBLIC_KEY", "GAX4CIDATJTAG6GUU3UCD7IBFCTMI6EWKDWL5C5AHSS4PR3KHPLULZFT")
GUARDRAIL_COSIGNER_SECRET_KEY = os.getenv("GUARDRAIL_COSIGNER_SECRET_KEY", "SCAPAHDZCHL7BWYT2MW47CZW7IYPGL7XXNUXEVPBXSPAFFJI7VDHNTGZ")

