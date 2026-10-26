from django.contrib import admin
from .models import Operator, PrivilegeEscalationRequest


@admin.register(Operator)
class OperatorAdmin(admin.ModelAdmin):
    list_display = ("address", "alias", "role", "effective_role", "is_verified", "last_login", "created_at")
    list_filter = ("role", "is_verified", "created_at", "last_login")
    search_fields = ("address", "alias")
    readonly_fields = ("id", "current_nonce", "nonce_created_at", "last_login", "created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(PrivilegeEscalationRequest)
class PrivilegeEscalationRequestAdmin(admin.ModelAdmin):
    list_display = ("operator", "requested_role", "duration_hours", "status", "reviewed_by", "expires_at", "created_at")
    list_filter = ("status", "requested_role", "created_at")
    search_fields = ("operator__address", "operator__alias", "reason")
    readonly_fields = ("id", "reviewed_at", "created_at", "updated_at")
    ordering = ("-created_at",)

