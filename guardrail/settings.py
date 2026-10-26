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
if "pytest" in sys.modules or "test" in sys.argv:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
elif os.getenv("DB_ENGINE") == "django.db.backends.postgresql" and os.getenv("DB_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "guardrail_db"),
            "USER": os.getenv("DB_USER", "guardrail_user"),
            "PASSWORD": os.getenv("DB_PASSWORD", "guardrail_secure_password"),
            "HOST": os.getenv("DB_HOST", "db"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
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

# Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS configuration
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Django REST Framework Settings
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# DRF Spectacular OpenAPI / Swagger 3.0 Documentation Settings
SPECTACULAR_SETTINGS = {
    "TITLE": "GuardRail Policy Coordinator API",
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
GUARDRAIL_COSIGNER_PUBLIC_KEY = os.getenv("GUARDRAIL_COSIGNER_PUBLIC_KEY", "GBGUARDRAILCOSIGNERTESTNETPUBKEYDEMO1234567890ABCDEFGH")
GUARDRAIL_COSIGNER_SECRET_KEY = os.getenv("GUARDRAIL_COSIGNER_SECRET_KEY", "SBGUARDRAILCOSIGNERTESTNETSECRETKEYDEMO1234567890ABCDEF")
