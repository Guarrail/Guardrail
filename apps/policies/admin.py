from django.contrib import admin
from .models import Policy, AllowedRecipient, BlockedRecipient, AllowedAsset, SpendingLedger


class AllowedRecipientInline(admin.TabularInline):
    model = AllowedRecipient
    extra = 1
    fields = ("address", "label", "is_active")


class BlockedRecipientInline(admin.TabularInline):
    model = BlockedRecipient
    extra = 1
    fields = ("address", "label", "reason", "is_active")


class AllowedAssetInline(admin.TabularInline):
    model = AllowedAsset
    extra = 1
    fields = ("asset_code", "issuer_address", "is_active")


class SpendingLedgerInline(admin.TabularInline):
    model = SpendingLedger
    extra = 0
    readonly_fields = (
        "wallet",
        "daily_date",
        "spent_daily",
        "reserved_daily",
        "weekly_iso_week",
        "spent_weekly",
        "reserved_weekly",
        "updated_at",
    )
    can_delete = False


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "version",
        "max_amount_per_tx",
        "daily_spending_limit",
        "weekly_spending_limit",
        "human_approval_threshold",
        "require_human_approval_always",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "require_human_approval_always", "version")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)
    inlines = [AllowedRecipientInline, BlockedRecipientInline, AllowedAssetInline, SpendingLedgerInline]


@admin.register(AllowedRecipient)
class AllowedRecipientAdmin(admin.ModelAdmin):
    list_display = ("label", "address", "policy", "is_active", "created_at")
    list_filter = ("is_active", "policy")
    search_fields = ("label", "address", "policy__name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(BlockedRecipient)
class BlockedRecipientAdmin(admin.ModelAdmin):
    list_display = ("label", "address", "reason", "policy", "is_active", "created_at")
    list_filter = ("is_active", "policy")
    search_fields = ("label", "address", "reason", "policy__name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(AllowedAsset)
class AllowedAssetAdmin(admin.ModelAdmin):
    list_display = ("asset_code", "issuer_address", "policy", "is_active", "created_at")
    list_filter = ("is_active", "asset_code", "policy")
    search_fields = ("asset_code", "issuer_address", "policy__name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(SpendingLedger)
class SpendingLedgerAdmin(admin.ModelAdmin):
    list_display = (
        "policy",
        "wallet",
        "daily_date",
        "spent_daily",
        "reserved_daily",
        "weekly_iso_week",
        "spent_weekly",
        "reserved_weekly",
        "updated_at",
    )
    list_filter = ("daily_date", "weekly_iso_week")
    search_fields = ("policy__name", "wallet__name", "wallet__address")
    readonly_fields = ("id", "created_at", "updated_at")
