from rest_framework import serializers
from apps.wallets.models import ControlledWallet
from apps.accounts.models import Operator
from .models import AIAgent


class AIAgentSerializer(serializers.ModelSerializer):
    policy_name = serializers.CharField(source="policy.name", read_only=True)
    wallet_address = serializers.CharField(source="wallet.address", read_only=True)
    delegated_operators = serializers.SerializerMethodField()
    pda_explorer_url = serializers.SerializerMethodField()
    pda_tx_explorer_url = serializers.SerializerMethodField()

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
            "stellar_secret_key",
            "pda_tx_hash",
            "pda_funded",
            "signer_weight",
            "autonomy_mode",
            "delegated_operators",
            "pda_explorer_url",
            "pda_tx_explorer_url",
            "api_key",
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
            "api_key",
            "api_key_prefix",
            "stellar_secret_key",
            "pda_tx_hash",
            "pda_funded",
            "is_operational",
            "emergency_disabled_at",
            "last_active_at",
            "created_at",
            "updated_at",
        ]

    def get_delegated_operators(self, obj):
        return [op.address for op in obj.delegated_operators.all()]

    def get_pda_explorer_url(self, obj):
        if obj.stellar_public_key:
            return f"https://stellar.expert/explorer/testnet/account/{obj.stellar_public_key}"
        return ""

    def get_pda_tx_explorer_url(self, obj):
        if obj.pda_tx_hash:
            return f"https://stellar.expert/explorer/testnet/tx/{obj.pda_tx_hash}"
        return ""


class CreateAIAgentSerializer(serializers.ModelSerializer):
    agent_id = serializers.CharField(required=False, allow_blank=True, default="")
    wallet = serializers.PrimaryKeyRelatedField(queryset=ControlledWallet.objects.all(), required=False, allow_null=True)
    stellar_public_key = serializers.CharField(required=False, allow_blank=True, default="")
    signer_weight = serializers.IntegerField(required=False, default=1)
    autonomy_mode = serializers.ChoiceField(choices=AIAgent.AUTONOMY_CHOICES, required=False, default="AUTONOMOUS")
    delegated_operator_addresses = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

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
            "delegated_operator_addresses",
        ]


class UpdateAIAgentSerializer(serializers.ModelSerializer):
    delegated_operator_addresses = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

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
            "delegated_operator_addresses",
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
    pda_tx_hash = serializers.CharField(
        required=False,
        help_text="Stellar transaction hash storing policy on PDA account.",
    )
    explorer_url = serializers.CharField(
        required=False,
        help_text="Link to view the PDA account on Stellar Expert Testnet.",
    )
    warning = serializers.CharField()
