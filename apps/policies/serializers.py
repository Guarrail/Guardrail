from rest_framework import serializers
from apps.core.stellar import is_valid_stellar_address
from .models import Policy, AllowedRecipient, BlockedRecipient, AllowedAsset, SpendingLedger


class AllowedRecipientSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedRecipient
        fields = ["id", "policy", "address", "label", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_address(self, value):
        if not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid Stellar recipient address.")
        return value


class BlockedRecipientSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlockedRecipient
        fields = ["id", "policy", "address", "label", "reason", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_address(self, value):
        if not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid Stellar recipient address.")
        return value


class AllowedAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedAsset
        fields = ["id", "policy", "asset_code", "issuer_address", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, data):
        code = data.get("asset_code", "XLM")
        issuer = data.get("issuer_address")
        if code != "XLM" and not issuer:
            raise serializers.ValidationError("Non-native assets require an issuer address.")
        if issuer and not is_valid_stellar_address(issuer):
            raise serializers.ValidationError("Invalid Stellar asset issuer address.")
        return data


class PolicySerializer(serializers.ModelSerializer):
    allowed_recipients = AllowedRecipientSerializer(many=True, read_only=True)
    blocked_recipients = BlockedRecipientSerializer(many=True, read_only=True)
    allowed_assets = AllowedAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Policy
        fields = [
            "id",
            "name",
            "description",
            "version",
            "max_amount_per_tx",
            "daily_spending_limit",
            "weekly_spending_limit",
            "human_approval_threshold",
            "require_human_approval_always",
            "is_active",
            "allowed_recipients",
            "blocked_recipients",
            "allowed_assets",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        max_tx = data.get("max_amount_per_tx", getattr(self.instance, "max_amount_per_tx", None))
        daily = data.get("daily_spending_limit", getattr(self.instance, "daily_spending_limit", None))
        weekly = data.get("weekly_spending_limit", getattr(self.instance, "weekly_spending_limit", None))

        if max_tx and daily and max_tx > daily:
            raise serializers.ValidationError({"max_amount_per_tx": "Max amount per tx cannot exceed daily limit."})
        if daily and weekly and daily > weekly:
            raise serializers.ValidationError({"daily_spending_limit": "Daily limit cannot exceed weekly limit."})
        return data

    def create(self, validated_data):
        allowed_recipients_data = self.initial_data.get("allowed_recipients", [])
        blocked_recipients_data = self.initial_data.get("blocked_recipients", [])
        policy = super().create(validated_data)

        if allowed_recipients_data:
            for item in allowed_recipients_data:
                addr = (item.get("address") if isinstance(item, dict) else str(item)) or ""
                addr = addr.strip()
                label = (item.get("label") if isinstance(item, dict) else "") or "Approved Destination"
                if addr and is_valid_stellar_address(addr):
                    AllowedRecipient.objects.get_or_create(policy=policy, address=addr, defaults={"label": label, "is_active": True})

        if blocked_recipients_data:
            for item in blocked_recipients_data:
                addr = (item.get("address") if isinstance(item, dict) else str(item)) or ""
                addr = addr.strip()
                label = (item.get("label") if isinstance(item, dict) else "") or "Blocked Wallet"
                reason = (item.get("reason") if isinstance(item, dict) else "") or "Prohibited destination"
                if addr and is_valid_stellar_address(addr):
                    BlockedRecipient.objects.get_or_create(policy=policy, address=addr, defaults={"label": label, "reason": reason, "is_active": True})

        try:
            from apps.smart_contracts.services import SorobanGuardrailClient
            allowed_addrs = list(policy.allowed_recipients.filter(is_active=True).values_list("address", flat=True))
            blocked_addrs = list(policy.blocked_recipients.filter(is_active=True).values_list("address", flat=True))
            SorobanGuardrailClient().sync_policy_recipients_to_contract(str(policy.id), allowed_addrs, blocked_addrs)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to sync policy recipients to contract on create: %s", str(e))

        return policy

    def update(self, instance, validated_data):
        allowed_recipients_data = self.initial_data.get("allowed_recipients")
        blocked_recipients_data = self.initial_data.get("blocked_recipients")
        policy = super().update(instance, validated_data)

        if allowed_recipients_data is not None:
            for item in allowed_recipients_data:
                addr = (item.get("address") if isinstance(item, dict) else str(item)) or ""
                addr = addr.strip()
                label = (item.get("label") if isinstance(item, dict) else "") or "Approved Destination"
                if addr and is_valid_stellar_address(addr):
                    AllowedRecipient.objects.get_or_create(policy=policy, address=addr, defaults={"label": label, "is_active": True})

        if blocked_recipients_data is not None:
            for item in blocked_recipients_data:
                addr = (item.get("address") if isinstance(item, dict) else str(item)) or ""
                addr = addr.strip()
                label = (item.get("label") if isinstance(item, dict) else "") or "Blocked Wallet"
                reason = (item.get("reason") if isinstance(item, dict) else "") or "Prohibited destination"
                if addr and is_valid_stellar_address(addr):
                    BlockedRecipient.objects.get_or_create(policy=policy, address=addr, defaults={"label": label, "reason": reason, "is_active": True})

        try:
            from apps.smart_contracts.services import SorobanGuardrailClient
            allowed_addrs = list(policy.allowed_recipients.filter(is_active=True).values_list("address", flat=True))
            blocked_addrs = list(policy.blocked_recipients.filter(is_active=True).values_list("address", flat=True))
            SorobanGuardrailClient().sync_policy_recipients_to_contract(str(policy.id), allowed_addrs, blocked_addrs)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to sync policy recipients to contract on update: %s", str(e))

        return policy


class SpendingStatusSerializer(serializers.Serializer):
    wallet_id = serializers.UUIDField()
    policy_id = serializers.UUIDField()
    daily_date = serializers.CharField()
    spent_daily = serializers.DecimalField(max_digits=20, decimal_places=7)
    reserved_daily = serializers.DecimalField(max_digits=20, decimal_places=7)
    daily_limit = serializers.DecimalField(max_digits=20, decimal_places=7)
    remaining_daily = serializers.DecimalField(max_digits=20, decimal_places=7)

    weekly_iso_week = serializers.CharField()
    spent_weekly = serializers.DecimalField(max_digits=20, decimal_places=7)
    reserved_weekly = serializers.DecimalField(max_digits=20, decimal_places=7)
    weekly_limit = serializers.DecimalField(max_digits=20, decimal_places=7)
    remaining_weekly = serializers.DecimalField(max_digits=20, decimal_places=7)
