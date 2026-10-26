from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.accounts.models import Operator
from apps.core.stellar import (
    get_cosigner_keypair,
    generate_new_stellar_keypair,
    get_account_balances_from_horizon,
    fund_account_via_friendbot,
)
from apps.audit.models import record_audit_event
from .models import ControlledWallet
from .serializers import (
    ControlledWalletSerializer,
    RegisterWalletSerializer,
    UpdateWalletWeightsSerializer,
)



class ControlledWalletViewSet(viewsets.ModelViewSet):
    """
    CRUD viewset for managing Controlled Stellar Wallets.
    Supports security boundary audits and ownership verification.
    """

    queryset = ControlledWallet.objects.all().prefetch_related("delegated_operators").order_by("-created_at")
    serializer_class = ControlledWalletSerializer

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        # If address is not provided or blank, generate a valid Stellar keypair
        if not payload.get("address"):
            generated_address, _ = generate_new_stellar_keypair()
            payload["address"] = generated_address

        serializer = RegisterWalletSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        operator_address = data.pop("operator_address")
        operator, _ = Operator.objects.get_or_create(address=operator_address)

        # Default cosigner address to backend keypair if not explicitly passed
        if not data.get("cosigner_address"):
            data["cosigner_address"] = get_cosigner_keypair().public_key

        wallet, _ = ControlledWallet.objects.update_or_create(
            address=data["address"],
            defaults={"operator": operator, **data},
        )

        # Query live balance from Horizon if available
        balances = get_account_balances_from_horizon(wallet.address)
        for b in balances:
            if b.get("asset_type") == "native":
                wallet.balance = Decimal(b.get("balance", "0"))
                wallet.save(update_fields=["balance"])
                break

        return Response(ControlledWalletSerializer(wallet).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        description="Query live on-chain balances for this controlled wallet from Stellar Horizon Testnet.",
        responses={200: dict},
    )
    @action(detail=True, methods=["get"], url_path="live-balance")
    def live_balance(self, request, pk=None):
        wallet = self.get_object()
        balances = get_account_balances_from_horizon(wallet.address)
        native_bal = Decimal("0.0000000")
        for b in balances:
            if b.get("asset_type") == "native":
                native_bal = Decimal(b.get("balance", "0"))
                break

        if balances and native_bal > 0:
            wallet.balance = native_bal
            wallet.save(update_fields=["balance"])

        return Response({
            "wallet_address": wallet.address,
            "balance": str(wallet.balance),
            "balances": balances,
            "explorer_url": f"https://stellar.expert/explorer/testnet/account/{wallet.address}",
        })

    @extend_schema(
        description="Fund controlled wallet on Stellar Testnet via Friendbot.",
        responses={200: dict},
    )
    @action(detail=True, methods=["post"], url_path="fund-testnet")
    def fund_testnet(self, request, pk=None):
        wallet = self.get_object()
        success = fund_account_via_friendbot(wallet.address)
        balances = get_account_balances_from_horizon(wallet.address)
        for b in balances:
            if b.get("asset_type") == "native":
                wallet.balance = Decimal(b.get("balance", "0"))
                wallet.save(update_fields=["balance"])
                break

        return Response({
            "success": success,
            "wallet_address": wallet.address,
            "balance": str(wallet.balance),
            "balances": balances,
            "explorer_url": f"https://stellar.expert/explorer/testnet/account/{wallet.address}",
        })

    @extend_schema(
        description="Generate a fresh, cryptographically valid Stellar Testnet vault address for the controlled wallet.",
        responses={200: dict},
    )
    @action(detail=False, methods=["get", "post"], url_path="generate-address")
    def generate_address(self, request):
        public_key, _ = generate_new_stellar_keypair()
        return Response({
            "address": public_key,
            "network": "TESTNET",
            "message": "Fresh cryptographically valid Stellar vault address generated.",
        })

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

    @extend_schema(
        request=UpdateWalletWeightsSerializer,
        responses={200: ControlledWalletSerializer},
        description="Update multisig signing weights and thresholds on the controlled wallet.",
    )
    @action(detail=True, methods=["post", "patch"], url_path="update-weights")
    def update_weights(self, request, pk=None):
        wallet = self.get_object()
        serializer = UpdateWalletWeightsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        for field, val in data.items():
            setattr(wallet, field, val)
        wallet.save()

        record_audit_event(
            event_type="WALLET_MULTISIG_WEIGHTS_UPDATED",
            actor_id=str(request.headers.get("X-Operator-Address") or "ADMIN"),
            actor_type="OPERATOR",
            details={
                "wallet_address": wallet.address,
                "master_weight": wallet.master_weight,
                "agent_signer_weight": wallet.agent_signer_weight,
                "cosigner_weight": wallet.cosigner_weight,
                "threshold_med": wallet.threshold_med,
            },
        )

        return Response(ControlledWalletSerializer(wallet).data, status=status.HTTP_200_OK)

