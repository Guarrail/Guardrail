from rest_framework import serializers
from .models import AIAgent


class AIAgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAgent
        fields = [
            "id",
            "agent_id",
            "name",
            "description",
            "wallet",
            "policy",
            "api_key_prefix",
            "status",
            "is_operational",
            "emergency_disabled_at",
            "last_active_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "api_key_prefix",
            "is_operational",
            "emergency_disabled_at",
            "last_active_at",
            "created_at",
            "updated_at",
        ]


class CreateAIAgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAgent
        fields = [
            "agent_id",
            "name",
            "description",
            "wallet",
            "policy",
        ]


class AgentRegistrationResponseSerializer(serializers.Serializer):
    agent = AIAgentSerializer()
    api_key = serializers.CharField(
        help_text="Full plaintext API Key. Displayed only ONCE upon creation. Store securely."
    )
    warning = serializers.CharField()
