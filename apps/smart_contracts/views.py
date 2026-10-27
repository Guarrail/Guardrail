from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers
from drf_spectacular.utils import extend_schema
from .services import SorobanGuardrailClient


class SorobanSimulateRequestSerializer(serializers.Serializer):
    permit_id_hex = serializers.CharField(max_length=64)
    token_address = serializers.CharField(max_length=56)
    recipient_address = serializers.CharField(max_length=56)
    amount_stroops = serializers.IntegerField(min_value=1)
    expires_at_timestamp = serializers.IntegerField()
    agent_address = serializers.CharField(max_length=56)
    cosigner_address = serializers.CharField(max_length=56)


class SorobanContractStatusResponseSerializer(serializers.Serializer):
    contract_name = serializers.CharField()
    version = serializers.CharField()
    blockchain = serializers.CharField()
    contract_address = serializers.CharField()
    features = serializers.ListField()
    status = serializers.CharField()


class SorobanSimulateResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    contract_address = serializers.CharField(required=False)
    simulated_tx_hash = serializers.CharField(required=False)
    events_emitted = serializers.ListField(required=False)
    timestamp = serializers.IntegerField(required=False)
    error = serializers.CharField(required=False)
    error_code = serializers.IntegerField(required=False)


class SorobanContractStatusView(APIView):
    """Inspect deployed Soroban smart contract status and configuration."""

    @extend_schema(
        responses={200: SorobanContractStatusResponseSerializer},
        description="Inspect Soroban smart contract deployment parameters and features.",
    )
    def get(self, request):
        return Response(
            {
                "contract_name": "guardrail-contract",
                "version": "0.1.0",
                "blockchain": "Stellar Soroban (Rust / WASM)",
                "contract_address": "CDEMOGUARDRAILCONTRACTTESTNET1234567890ABCDEFGH",
                "features": [
                    "On-chain dual authorization (Agent + CoSigner)",
                    "Single-use permit replay protection",
                    "Deterministic 24h and 7d rolling budget reset",
                    "Recipient whitelist & blacklist (prohibited destination enforcement)",
                    "On-chain multisig signers & threshold enforcement",
                    "Token allowlists",
                    "Emergency circuit breaker pause/unpause",
                ],
                "status": "OPERATIONAL",
            }
        )


class SorobanSimulateView(APIView):
    """Simulate permit verification on Soroban."""

    @extend_schema(
        request=SorobanSimulateRequestSerializer,
        responses={200: SorobanSimulateResponseSerializer, 400: SorobanSimulateResponseSerializer},
        description="Simulate on-chain execution and authorization verification of a GuardRail permit.",
    )
    def post(self, request):
        serializer = SorobanSimulateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        client = SorobanGuardrailClient()
        result = client.simulate_permit_execution(**data)

        http_status = status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST
        return Response(result, status=http_status)
