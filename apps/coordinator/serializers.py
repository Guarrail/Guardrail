from rest_framework import serializers
from apps.core.stellar import is_valid_stellar_address
from .models import TransactionRequest, Permit


class AgentSubmitRequestSerializer(serializers.Serializer):
    """Payload submitted by an AI Agent to propose a payment."""

    request_id = serializers.CharField(max_length=100, help_text="Unique client idempotency key")
    recipient = serializers.CharField(max_length=56, help_text="Destination Stellar address")
    amount = serializers.DecimalField(max_digits=20, decimal_places=7)
    asset = serializers.CharField(max_length=12, default="XLM")
    issuer = serializers.CharField(max_length=56, required=False, allow_blank=True, default=None)
    wallet_id = serializers.UUIDField(required=False, default=None)

    def validate_recipient(self, value):
        if not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid Stellar recipient address format.")
        return value


class PermitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permit
        fields = [
            "id",
            "request",
            "agent",
            "wallet",
            "recipient",
            "asset_code",
            "asset_issuer",
            "amount",
            "payload_hash",
            "policy_version",
            "status",
            "expires_at",
            "is_single_use_consumed",
            "is_valid",
            "approved_by",
            "approved_at",
            "created_at",
        ]
        read_only_fields = fields


class TransactionRequestSerializer(serializers.ModelSerializer):
    permit = PermitSerializer(read_only=True)
    stellar_explorer_url = serializers.SerializerMethodField()

    class Meta:
        model = TransactionRequest
        fields = [
            "id",
            "request_id",
            "agent",
            "wallet",
            "recipient",
            "asset_code",
            "asset_issuer",
            "amount",
            "status",
            "requires_human_approval",
            "policy_evaluation_results",
            "stellar_tx_hash",
            "stellar_explorer_url",
            "execution_error",
            "is_eligible_for_cosign",
            "permit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_stellar_explorer_url(self, obj) -> str | None:
        if obj.stellar_tx_hash:
            return f"https://stellar.expert/explorer/testnet/tx/{obj.stellar_tx_hash}"
        return None


class OperatorApprovalSerializer(serializers.Serializer):
    operator_address = serializers.CharField(max_length=56)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class OperatorRejectionSerializer(serializers.Serializer):
    operator_address = serializers.CharField(max_length=56)
    reason = serializers.CharField(required=True)


class DashboardStatsSerializer(serializers.Serializer):
    wallet_balance = serializers.DecimalField(max_digits=20, decimal_places=7)
    active_agents = serializers.IntegerField()
    pending_approvals = serializers.IntegerField()
    approved_transactions = serializers.IntegerField()
    blocked_transactions = serializers.IntegerField()
    executed_transactions = serializers.IntegerField()
    spent_daily = serializers.DecimalField(max_digits=20, decimal_places=7)
    daily_limit = serializers.DecimalField(max_digits=20, decimal_places=7)
    spent_weekly = serializers.DecimalField(max_digits=20, decimal_places=7)
    weekly_limit = serializers.DecimalField(max_digits=20, decimal_places=7)


class AgentPolicySummaryResponseSerializer(serializers.Serializer):
    agent_id = serializers.CharField()
    wallet_address = serializers.CharField()
    policy = serializers.DictField()
    allowed_recipients = serializers.ListField()
    allowed_assets = serializers.ListField()

