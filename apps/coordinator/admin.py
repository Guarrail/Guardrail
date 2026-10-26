from django.contrib import admin
from .models import TransactionRequest, Permit


class PermitInline(admin.StackedInline):
    model = Permit
    extra = 0
    readonly_fields = (
        "id",
        "agent",
        "wallet",
        "recipient",
        "amount",
        "asset_code",
        "asset_issuer",
        "payload_hash",
        "policy_version",
        "status",
        "expires_at",
        "is_single_use_consumed",
        "approved_by",
        "approved_at",
        "created_at",
    )
    can_delete = False


@admin.register(TransactionRequest)
class TransactionRequestAdmin(admin.ModelAdmin):
    list_display = (
        "request_id",
        "agent",
        "wallet",
        "amount",
        "asset_code",
        "recipient",
        "status",
        "requires_human_approval",
        "stellar_tx_hash",
        "created_at",
    )
    list_filter = ("status", "requires_human_approval", "asset_code", "created_at")
    search_fields = (
        "request_id",
        "recipient",
        "stellar_tx_hash",
        "agent__name",
        "agent__agent_id",
        "wallet__name",
        "wallet__address",
    )
    readonly_fields = (
        "id",
        "request_id",
        "agent",
        "wallet",
        "recipient",
        "asset_code",
        "asset_issuer",
        "amount",
        "policy_evaluation_results",
        "stellar_envelope_xdr",
        "stellar_tx_hash",
        "execution_error",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    inlines = [PermitInline]


@admin.register(Permit)
class PermitAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "request",
        "agent",
        "amount",
        "asset_code",
        "status",
        "is_single_use_consumed",
        "expires_at",
        "approved_by",
        "created_at",
    )
    list_filter = ("status", "is_single_use_consumed", "created_at")
    search_fields = (
        "id",
        "payload_hash",
        "recipient",
        "approved_by",
        "request__request_id",
        "agent__name",
        "wallet__name",
    )
    readonly_fields = (
        "id",
        "request",
        "agent",
        "wallet",
        "recipient",
        "amount",
        "asset_code",
        "asset_issuer",
        "payload_hash",
        "policy_version",
        "status",
        "expires_at",
        "is_single_use_consumed",
        "approved_by",
        "approved_at",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
