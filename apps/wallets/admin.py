from django.contrib import admin
from .models import ControlledWallet


@admin.register(ControlledWallet)
class ControlledWalletAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "address",
        "operator",
        "network",
        "balance",
        "asset_code",
        "threshold_med",
        "is_compliant_display",
        "is_active",
        "created_at",
    )
    list_filter = ("network", "is_active", "is_verified", "asset_code", "threshold_med")
    search_fields = (
        "name",
        "address",
        "operator__address",
        "operator__alias",
        "agent_signer_address",
        "cosigner_address",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)

    @admin.display(boolean=True, description="Multisig Compliant")
    def is_compliant_display(self, obj):
        compliant, _ = obj.check_security_compliance()
        return compliant
