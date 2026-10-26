from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.wallets.models import ControlledWallet
from .models import Policy, AllowedRecipient, AllowedAsset, SpendingLedger
from .serializers import (
    PolicySerializer,
    AllowedRecipientSerializer,
    AllowedAssetSerializer,
    SpendingStatusSerializer,
)


class PolicyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for defining and managing financial policies and rules.
    """

    queryset = Policy.objects.all().prefetch_related("allowed_recipients", "allowed_assets").order_by("-created_at")
    serializer_class = PolicySerializer

    @extend_schema(
        parameters=[
            OpenApiParameter(name="wallet_id", description="Controlled wallet UUID", required=True, type=str),
        ],
        responses={200: SpendingStatusSerializer},
        description="Retrieve real-time remaining daily and weekly spending budgets for a wallet under this policy.",
    )
    @action(detail=True, methods=["get"], url_path="budget-status")
    def budget_status(self, request, pk=None):
        policy = self.get_object()
        wallet_id = request.query_params.get("wallet_id")

        if not wallet_id:
            return Response({"error": "wallet_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wallet = ControlledWallet.objects.get(id=wallet_id)
        except (ControlledWallet.DoesNotExist, ValueError):
            return Response({"error": "Controlled wallet not found."}, status=status.HTTP_404_NOT_FOUND)

        ledger, _ = SpendingLedger.objects.get_or_create(wallet=wallet, policy=policy)
        ledger.sync_windows()
        ledger.save(update_fields=["daily_date", "spent_daily", "reserved_daily", "weekly_iso_week", "spent_weekly", "reserved_weekly"])

        remaining_daily = max(Decimal("0.0000000"), policy.daily_spending_limit - ledger.total_committed_daily)
        remaining_weekly = max(Decimal("0.0000000"), policy.weekly_spending_limit - ledger.total_committed_weekly)

        return Response(
            {
                "wallet_id": wallet.id,
                "policy_id": policy.id,
                "daily_date": ledger.daily_date,
                "spent_daily": ledger.spent_daily,
                "reserved_daily": ledger.reserved_daily,
                "daily_limit": policy.daily_spending_limit,
                "remaining_daily": remaining_daily,
                "weekly_iso_week": ledger.weekly_iso_week,
                "spent_weekly": ledger.spent_weekly,
                "reserved_weekly": ledger.reserved_weekly,
                "weekly_limit": policy.weekly_spending_limit,
                "remaining_weekly": remaining_weekly,
            }
        )

    @action(detail=True, methods=["post"], url_path="add-recipient")
    def add_recipient(self, request, pk=None):
        policy = self.get_object()
        serializer = AllowedRecipientSerializer(data={**request.data, "policy": policy.id})
        serializer.is_valid(raise_exception=True)
        recipient = serializer.save()
        return Response(AllowedRecipientSerializer(recipient).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-asset")
    def add_asset(self, request, pk=None):
        policy = self.get_object()
        serializer = AllowedAssetSerializer(data={**request.data, "policy": policy.id})
        serializer.is_valid(raise_exception=True)
        asset = serializer.save()
        return Response(AllowedAssetSerializer(asset).data, status=status.HTTP_201_CREATED)


class AllowedRecipientViewSet(viewsets.ModelViewSet):
    queryset = AllowedRecipient.objects.all().order_by("-created_at")
    serializer_class = AllowedRecipientSerializer


class AllowedAssetViewSet(viewsets.ModelViewSet):
    queryset = AllowedAsset.objects.all().order_by("-created_at")
    serializer_class = AllowedAssetSerializer
