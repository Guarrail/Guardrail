from rest_framework import serializers
from apps.core.stellar import is_valid_stellar_address
from .models import Operator


class ChallengeRequestSerializer(serializers.Serializer):
    address = serializers.CharField(max_length=56)

    def validate_address(self, value):
        if not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid Stellar public address format.")
        return value


class ChallengeResponseSerializer(serializers.Serializer):
    address = serializers.CharField()
    challenge = serializers.CharField()
    nonce = serializers.CharField()


class VerifySignatureSerializer(serializers.Serializer):
    address = serializers.CharField(max_length=56)
    signature = serializers.CharField(help_text="Hex or Base64 encoded ed25519 signature of the challenge")

    def validate_address(self, value):
        if not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid Stellar public address format.")
        return value


class OperatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Operator
        fields = ["id", "address", "alias", "is_verified", "last_login", "created_at"]
        read_only_fields = ["id", "is_verified", "last_login", "created_at"]
