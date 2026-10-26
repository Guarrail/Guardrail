from rest_framework import serializers
from apps.core.stellar import is_valid_stellar_address
from .models import Policy, AllowedRecipient, AllowedAsset, SpendingLedger


class AllowedRecipientSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedRecipient
        fields = ["id", "policy", "address", "label", "is_active", "created_at"]
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
