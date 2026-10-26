from rest_framework import serializers
from apps.wallets.models import ControlledWallet
from .models import AIAgent


class AIAgentSerializer(serializers.ModelSerializer):
    policy_name = serializers.CharField(source="policy.name", read_only=True)
    wallet_address = serializers.CharField(source="wallet.address", read_only=True)

    class Meta:
        model = AIAgent
        fields = [
            "id",
            "agent_id",
            "name",
            "description",
            "wallet",
            "wallet_address",
            "policy",
            "policy_name",
            "stellar_public_key",
            "signer_weight",
            "autonomy_mode",
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
    agent_id = serializers.CharField(required=False, allow_blank=True, default="")
    wallet = serializers.PrimaryKeyRelatedField(queryset=ControlledWallet.objects.all(), required=False, allow_null=True)
    stellar_public_key = serializers.CharField(required=False, allow_blank=True, default="")
    signer_weight = serializers.IntegerField(required=False, default=1)
    autonomy_mode = serializers.ChoiceField(choices=AIAgent.AUTONOMY_CHOICES, required=False, default="AUTONOMOUS")

    class Meta:
        model = AIAgent
        fields = [
            "agent_id",
            "name",
            "description",
            "wallet",
            "policy",
            "stellar_public_key",
            "signer_weight",
            "autonomy_mode",
        ]


class UpdateAIAgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAgent
        fields = [
            "name",
            "description",
            "policy",
            "wallet",
            "signer_weight",
            "autonomy_mode",
            "status",
        ]


class AgentRegistrationResponseSerializer(serializers.Serializer):
    agent = AIAgentSerializer()
    api_key = serializers.CharField(
        help_text="Full plaintext API Key. Displayed only ONCE upon creation. Store securely."
    )
    stellar_public_key = serializers.CharField(help_text="Stellar PDA / Agent address (G...)")
    stellar_secret_key = serializers.CharField(
        required=False,
        help_text="Stellar PDA private secret key (S...). Displayed only ONCE upon generation.",
    )
    warning = serializers.CharField()

