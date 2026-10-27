"""
Config package for GuardRail platform.
Provides WSGI/ASGI entrypoints and Celery application integration.
"""
from .celery import app as celery_app

__all__ = ("celery_app",)
