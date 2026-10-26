from django.contrib import admin
from .models import AIAgent


@admin.register(AIAgent)
class AIAgentAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "agent_id",
        "wallet",
        "policy",
        "status",
        "api_key_prefix",
        "last_active_at",
        "emergency_disabled_at",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("name", "agent_id", "api_key_prefix", "description", "wallet__name", "policy__name")
    readonly_fields = (
        "id",
        "agent_id",
        "api_key_prefix",
        "api_key_hash",
        "emergency_disabled_at",
        "last_active_at",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    actions = ["action_emergency_disable", "action_activate"]

    @admin.action(description="Emergency disable selected agents (Killswitch)")
    def action_emergency_disable(self, request, queryset):
        for agent in queryset:
            agent.emergency_disable()

    @admin.action(description="Re-activate selected agents")
    def action_activate(self, request, queryset):
        for agent in queryset:
            agent.activate()
