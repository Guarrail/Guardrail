from rest_framework import serializers
from apps.core.stellar import is_valid_stellar_address
from .models import Operator, PrivilegeEscalationRequest


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
    challenge = serializers.CharField(required=False, allow_blank=True, help_text="Original challenge string signed by the wallet")
    alias = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_address(self, value):
        if not is_valid_stellar_address(value):
            raise serializers.ValidationError("Invalid Stellar public address format.")
        return value


class OperatorSerializer(serializers.ModelSerializer):
    effective_role = serializers.CharField(read_only=True)

    class Meta:
        model = Operator
        fields = [
            "id",
            "address",
            "alias",
            "role",
            "effective_role",
            "is_verified",
            "last_login",
            "created_at",
        ]
        read_only_fields = ["id", "is_verified", "last_login", "created_at"]


class PrivilegeEscalationRequestSerializer(serializers.ModelSerializer):
    operator_address = serializers.CharField(source="operator.address", read_only=True)
    operator_alias = serializers.CharField(source="operator.alias", read_only=True)
    reviewed_by_address = serializers.CharField(source="reviewed_by.address", read_only=True, default=None)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = PrivilegeEscalationRequest
        fields = [
            "id",
            "operator",
            "operator_address",
            "operator_alias",
            "requested_role",
            "reason",
            "duration_hours",
            "status",
            "reviewed_by",
            "reviewed_by_address",
            "reviewed_at",
            "expires_at",
            "review_notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "reviewed_by",
            "reviewed_at",
            "expires_at",
            "is_active",
            "created_at",
            "updated_at",
        ]


class CreatePrivilegeEscalationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivilegeEscalationRequest
        fields = ["requested_role", "reason", "duration_hours"]


class ReviewPrivilegeEscalationSerializer(serializers.Serializer):
    reviewer_address = serializers.CharField(max_length=56)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

