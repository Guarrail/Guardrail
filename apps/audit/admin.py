from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "event_type",
        "actor_type",
        "actor_id",
        "request_id",
        "stellar_tx_hash",
        "created_at",
    )
    list_filter = ("event_type", "actor_type", "created_at")
    search_fields = ("actor_id", "request_id", "permit_id", "stellar_tx_hash")
    readonly_fields = (
        "id",
        "event_type",
        "actor_type",
        "actor_id",
        "request_id",
        "permit_id",
        "stellar_tx_hash",
        "details",
        "stellar_explorer_url",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        # Audit log is strictly append-only / immutable
        return False

    def has_delete_permission(self, request, obj=None):
        # Prevent manual tampering with audit logs
        return False
