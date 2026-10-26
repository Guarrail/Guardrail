from rest_framework import serializers
from apps.core.stellar import is_valid_stellar_address
from .models import ControlledWallet


class ControlledWalletSerializer(serializers.ModelSerializer):
    is_compliant = serializers.SerializerMethodField()
    compliance_message = serializers.SerializerMethodField()
    asset_balances = serializers.SerializerMethodField()

    class Meta:
        model = ControlledWallet
        fields = [
            "id",
            "address",
            "name",
            "operator",
            "network",
            "is_verified",
            "is_active",
            "master_weight",
            "agent_signer_address",
            "agent_signer_weight",
            "cosigner_address",
            "cosigner_weight",
            "threshold_low",
            "threshold_med",
            "threshold_high",
            "balance",
            "asset_code",
            "asset_balances",
            "is_compliant",
            "compliance_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_compliant", "compliance_message", "asset_balances", "created_at", "updated_at"]

    def get_is_compliant(self, obj) -> bool:
        compliant, _ = obj.check_security_compliance()
        return compliant

    def get_compliance_message(self, obj) -> str:
        _, msg = obj.check_security_compliance()
        return msg

    def get_asset_balances(self, obj) -> list[dict]:
        return [
            {
                "asset_code": "XLM",
                "asset_name": "Stellar Lumens",
                "issuer": None,
                "balance": str(obj.balance),
                "is_native": True,
                "usd_rate": 0.12,
            },
            {
                "asset_code": "USDC",
                "asset_name": "USD Coin (Circle)",
                "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
                "balance": "2450.5000000",
                "is_native": False,
                "usd_rate": 1.0,
            },
            {
                "asset_code": "EURC",
                "asset_name": "Euro Coin (Circle)",
                "issuer": "GDQOE23CFSUMSVQK4Y5JHPP0C4VNMSJ53O234LMNASDFG342",
                "balance": "1800.0000000",
                "is_native": False,
                "usd_rate": 1.08,
            },
        ]


class UpdateWalletWeightsSerializer(serializers.Serializer):
    master_weight = serializers.IntegerField(min_value=0, max_value=255, required=False)
    agent_signer_weight = serializers.IntegerField(min_value=0, max_value=255, required=False)
    cosigner_weight = serializers.IntegerField(min_value=0, max_value=255, required=False)
    threshold_low = serializers.IntegerField(min_value=1, max_value=255, required=False)
    threshold_med = serializers.IntegerField(min_value=1, max_value=255, required=False)
    threshold_high = serializers.IntegerField(min_value=1, max_value=255, required=False)



class RegisterWalletSerializer(serializers.ModelSerializer):
    operator_address = serializers.CharField(write_only=True, max_length=56)
    address = serializers.CharField(max_length=56, required=False, allow_blank=True)

    class Meta:
        model = ControlledWallet
        fields = [
            "address",
            "name",
            "operator_address",
            "network",
            "agent_signer_address",
            "agent_signer_weight",
            "cosigner_address",
            "cosigner_weight",
            "threshold_low",
            "threshold_med",
            "threshold_high",
            "balance",
            "asset_code",
        ]

    def validate_operator_address(self, value):
        if not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid operator Stellar address format.")
        return value

    def validate_address(self, value):
        if value and not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid Stellar address format. Must be a 56-character public key starting with 'G'.")
        return value

    def validate_agent_signer_address(self, value):
        if value and not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid agent signer Stellar address.")
        return value

    def validate_cosigner_address(self, value):
        if value and not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid co-signer Stellar address.")
        return value
