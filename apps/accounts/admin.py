from django.contrib import admin
from .models import Operator


@admin.register(Operator)
class OperatorAdmin(admin.ModelAdmin):
    list_display = ("address", "alias", "is_verified", "last_login", "created_at")
    list_filter = ("is_verified", "created_at", "last_login")
    search_fields = ("address", "alias")
    readonly_fields = ("id", "current_nonce", "nonce_created_at", "last_login", "created_at", "updated_at")
    ordering = ("-created_at",)
