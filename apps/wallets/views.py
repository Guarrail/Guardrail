from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.accounts.models import Operator
from apps.core.stellar import get_cosigner_keypair
from .models import ControlledWallet
from .serializers import ControlledWalletSerializer, RegisterWalletSerializer


class ControlledWalletViewSet(viewsets.ModelViewSet):
    """
    CRUD viewset for managing Controlled Stellar Wallets.
    Supports security boundary audits and ownership verification.
    """

    queryset = ControlledWallet.objects.all().order_by("-created_at")
    serializer_class = ControlledWalletSerializer

    def create(self, request, *args, **kwargs):
        serializer = RegisterWalletSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        operator_address = data.pop("operator_address")
        operator, _ = Operator.objects.get_or_create(address=operator_address)

        # Default cosigner address to backend keypair if not explicitly passed
        if not data.get("cosigner_address"):
            data["cosigner_address"] = get_cosigner_keypair().public_key

        wallet = ControlledWallet.objects.create(operator=operator, **data)
        return Response(ControlledWalletSerializer(wallet).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        description="Verify multisig security compliance and return detailed audit assessment.",
        responses={200: dict},
    )
    @action(detail=True, methods=["get"], url_path="security-audit")
    def security_audit(self, request, pk=None):
        wallet = self.get_object()
        is_compliant, reason = wallet.check_security_compliance()

        return Response(
            {
                "wallet_address": wallet.address,
                "is_compliant": is_compliant,
                "reason": reason,
                "signing_model": {
                    "master_weight": wallet.master_weight,
                    "agent_signer_weight": wallet.agent_signer_weight,
                    "cosigner_weight": wallet.cosigner_weight,
                    "threshold_med": wallet.threshold_med,
                },
                "agent_independent_signing_prevented": wallet.agent_signer_weight < wallet.threshold_med,
                "cosigner_required": (wallet.agent_signer_weight + wallet.cosigner_weight) >= wallet.threshold_med,
            }
        )
