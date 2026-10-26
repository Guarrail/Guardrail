import logging
from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from django.core.exceptions import ValidationError
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.core.utils import get_utc_now
from apps.audit.models import record_audit_event
from apps.agents.authentication import AgentAPIKeyAuthentication
from apps.agents.models import AIAgent
from apps.wallets.models import ControlledWallet
from apps.policies.models import SpendingLedger
from .models import TransactionRequest, Permit
from .serializers import (
    AgentSubmitRequestSerializer,
    AgentSwapRequestSerializer,
    TransactionRequestSerializer,
    PermitSerializer,
    OperatorApprovalSerializer,
    OperatorSignTransactionSerializer,
    OperatorRejectionSerializer,
    DashboardStatsSerializer,
    AgentPolicySummaryResponseSerializer,
)

from .services import (
    evaluate_and_create_request,
    operator_approve_request,
    operator_reject_request,
    cosign_and_execute_request,
)

logger = logging.getLogger(__name__)


class AgentSubmitRequestView(APIView):
    """
    Module 3 — AI Agent Payment Request Submission.
    Authenticated via Agent API Key (Header `X-Agent-Key` or `Authorization: Bearer <key>`).
    Evaluates request against active policy, reserves spending budget, and issues single-use permit.
    """

    authentication_classes = [AgentAPIKeyAuthentication]

    @extend_schema(
        request=AgentSubmitRequestSerializer,
        responses={200: TransactionRequestSerializer, 201: TransactionRequestSerializer, 400: dict},
        description="Submit an agent payment request. Returns the policy evaluation result, approval status, and permit.",
    )
    def post(self, request):
        if not isinstance(request.user, AIAgent):
            return Response(
                {"error": "Authentication required. Provide a valid X-Agent-Key header."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        agent: AIAgent = request.user
        serializer = AgentSubmitRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        target_wallet = None
        if data.get("wallet_id"):
            try:
                target_wallet = ControlledWallet.objects.get(id=data["wallet_id"])
            except ControlledWallet.DoesNotExist:
                return Response({"error": "Specified wallet does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req, permit = evaluate_and_create_request(
                agent=agent,
                request_id=data.get("request_id"),
                recipient=data["recipient"],
                amount=data["amount"],
                asset_code=data.get("asset", "XLM"),
                asset_issuer=data.get("issuer"),
                wallet=target_wallet,
                stellar_envelope_xdr=data.get("stellar_envelope_xdr", ""),
            )
        except ValidationError as e:
            err_msg = e.message if hasattr(e, "message") else str(e)
            if isinstance(err_msg, list):
                err_msg = err_msg[0]
            return Response({"error": err_msg, "detail": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        auto_execute = request.data.get("auto_execute", False)
        can_auto_execute = (
            auto_execute
            and req.status == "APPROVED"
            and not req.requires_human_approval
            and agent.autonomy_mode == "AUTONOMOUS"
            and agent.signer_weight == 1
        )
        if can_auto_execute:
            try:
                req = cosign_and_execute_request(
                    request_id=req.request_id,
                    mock_stellar=request.data.get("mock_stellar", False),
                )
            except Exception as e:
                logger.warning("Autonomous live execution error: %s", str(e))

        resp_status = status.HTTP_201_CREATED
        if req.status == "BLOCKED":
            resp_status = status.HTTP_200_OK  # Evaluation completed; status clearly reports BLOCKED

        return Response(TransactionRequestSerializer(req).data, status=resp_status)


class AgentSwapView(APIView):
    """
    Module 3.5 — AI Agent Token Swap / Trade Submission (Stellar DEX / AMM).
    Authenticated via Agent API Key (Header `X-Agent-Key`).
    Evaluates swap against policy constraints (allowed assets, max per tx, daily budget),
    and executes live path payment swap on Stellar Testnet or holds for human approval.
    """

    authentication_classes = [AgentAPIKeyAuthentication]

    @extend_schema(
        request=AgentSwapRequestSerializer,
        responses={200: TransactionRequestSerializer, 201: TransactionRequestSerializer, 400: dict},
        description="Submit an agent token swap / buy request on Stellar DEX / AMM. Returns execution result or approval status.",
    )
    def post(self, request):
        if not isinstance(request.user, AIAgent):
            return Response(
                {"error": "Authentication required. Provide a valid X-Agent-Key header."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        agent: AIAgent = request.user
        serializer = AgentSwapRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        send_asset = data.get("send_asset", "XLM")
        dest_asset = data.get("dest_asset", "USDC")
        amount = data["amount"]
        destination = data.get("destination") or agent.wallet.address

        swap_details = {
            "send_asset": send_asset,
            "send_issuer": data.get("send_issuer"),
            "dest_asset": dest_asset,
            "dest_issuer": data.get("dest_issuer"),
            "min_dest_amount": str(data["min_dest_amount"]) if data.get("min_dest_amount") else None,
            "destination": destination,
        }

        try:
            req, permit = evaluate_and_create_request(
                agent=agent,
                request_id=data.get("request_id"),
                recipient=destination,
                amount=amount,
                asset_code=f"{send_asset}->{dest_asset}"[:12],
                asset_issuer=data.get("dest_issuer"),
                wallet=agent.wallet,
                stellar_envelope_xdr="",
                swap_details=swap_details,
            )
        except ValidationError as e:
            err_msg = e.message if hasattr(e, "message") else str(e)
            if isinstance(err_msg, list):
                err_msg = err_msg[0]
            return Response({"error": err_msg, "detail": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        auto_execute = data.get("auto_execute", True)
        can_auto_execute = (
            auto_execute
            and req.status == "APPROVED"
            and not req.requires_human_approval
            and agent.autonomy_mode == "AUTONOMOUS"
            and agent.signer_weight == 1
        )
        if can_auto_execute:
            try:
                req = cosign_and_execute_request(
                    request_id=req.request_id,
                    mock_stellar=data.get("mock_stellar", False),
                )
            except Exception as e:
                logger.warning("Autonomous live swap execution error: %s", str(e))

        resp_status = status.HTTP_201_CREATED
        if req.status == "BLOCKED":
            resp_status = status.HTTP_200_OK

        return Response(TransactionRequestSerializer(req).data, status=resp_status)


class AgentRequestDetailView(APIView):
    """Retrieve transaction request status and Stellar execution result for an agent."""

    authentication_classes = [AgentAPIKeyAuthentication]

    @extend_schema(
        responses={200: TransactionRequestSerializer},
        description="Query the current status, permit, and Stellar transaction hash for a submitted request ID.",
    )
    def get(self, request, request_id):
        try:
            req = TransactionRequest.objects.get(request_id=request_id)
            return Response(TransactionRequestSerializer(req).data)
        except TransactionRequest.DoesNotExist:
            return Response({"error": "Request ID not found."}, status=status.HTTP_404_NOT_FOUND)


class AgentPolicySummaryView(APIView):
    """Retrieve summary of active policy, limits, allowed assets, and approved recipients for an AI Agent."""

    authentication_classes = [AgentAPIKeyAuthentication]

    @extend_schema(
        responses={200: AgentPolicySummaryResponseSerializer},
        description="Retrieve active policy rules, remaining spending budget, allowed assets, and approved recipients.",
    )
    def get(self, request):
        if not isinstance(request.user, AIAgent):
            return Response({"error": "Agent authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        agent: AIAgent = request.user
        policy = agent.policy
        wallet = agent.wallet

        ledger, _ = SpendingLedger.objects.get_or_create(wallet=wallet, policy=policy)
        ledger.sync_windows()

        remaining_daily = max(Decimal("0.0000000"), policy.daily_spending_limit - ledger.total_committed_daily)
        remaining_weekly = max(Decimal("0.0000000"), policy.weekly_spending_limit - ledger.total_committed_weekly)

        return Response(
            {
                "agent_id": agent.agent_id,
                "wallet_address": wallet.address,
                "policy": {
                    "name": policy.name,
                    "version": policy.version,
                    "max_amount_per_tx": policy.max_amount_per_tx,
                    "daily_spending_limit": policy.daily_spending_limit,
                    "remaining_daily": remaining_daily,
                    "weekly_spending_limit": policy.weekly_spending_limit,
                    "remaining_weekly": remaining_weekly,
                    "human_approval_threshold": policy.human_approval_threshold,
                    "require_human_approval_always": policy.require_human_approval_always,
                },
                "allowed_recipients": [
                    {"address": r.address, "label": r.label}
                    for r in policy.allowed_recipients.filter(is_active=True)
                ],
                "allowed_assets": [
                    {"code": a.asset_code, "issuer": a.issuer_address}
                    for a in policy.allowed_assets.filter(is_active=True)
                ],
            }
        )


class OperatorRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Operator ViewSet to monitor, review, approve, reject, and trigger co-signing of agent requests.
    """

    queryset = TransactionRequest.objects.all().select_related("agent", "wallet", "permit").order_by("-created_at")
    serializer_class = TransactionRequestSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        agent_id = self.request.query_params.get("agent_id")
        if agent_id:
            qs = qs.filter(agent__agent_id=agent_id)
        return qs

    @extend_schema(
        request=OperatorApprovalSerializer,
        responses={200: TransactionRequestSerializer},
        description="Operator approves a pending transaction request, transitioning it to APPROVED.",
    )
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        req = self.get_object()
        serializer = OperatorApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_req = operator_approve_request(
                request_id=req.request_id,
                operator_address=serializer.validated_data["operator_address"],
                notes=serializer.validated_data.get("notes", ""),
            )
            auto_execute = request.data.get("auto_execute", False)
            if auto_execute and updated_req.status == "APPROVED":
                try:
                    updated_req = cosign_and_execute_request(
                        request_id=updated_req.request_id,
                        mock_stellar=request.data.get("mock_stellar", False),
                    )
                except Exception as e:
                    logger.warning("Auto execution after approval failed: %s", str(e))

            return Response(TransactionRequestSerializer(updated_req).data)
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, "message") else e)}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        request=OperatorSignTransactionSerializer,
        responses={200: TransactionRequestSerializer},
        description="Member operator submits cryptographic signature or authorization for a pending transaction.",
    )
    @action(detail=True, methods=["post"], url_path="sign")
    def sign(self, request, pk=None):
        req = self.get_object()
        serializer = OperatorSignTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        operator_address = serializer.validated_data["operator_address"]
        signature = serializer.validated_data.get("signature", "")
        weight = serializer.validated_data.get("weight", 1)
        notes = serializer.validated_data.get("notes", "")

        signatures = list(req.operator_signatures or [])

        # Ensure Agent PDA proposal signature is included as Signer 1 if missing
        has_agent_sig = any(
            s.get("role") == "AGENT_PDA"
            or "Agent PDA" in s.get("notes", "")
            or (req.agent and s.get("operator_address") == req.agent.stellar_public_key)
            for s in signatures
        )
        if not has_agent_sig and req.agent and (req.required_weight >= 2 or req.agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS"):
            agent_addr = req.agent.stellar_public_key or f"agent_pda_{req.agent.agent_id}"
            pda_sig = f"pda_proposal_sig_{req.agent.agent_id}_{int(req.created_at.timestamp())}"
            signatures.insert(0, {
                "operator_address": agent_addr,
                "signature": pda_sig,
                "weight": 1,
                "role": "AGENT_PDA",
                "notes": f"Signer 1 of {req.required_weight}: AI Agent PDA Proposal ({req.agent.name})",
                "signed_at": req.created_at.isoformat(),
            })

        now = get_utc_now()
        # Check if already signed by this operator
        already_signed = any(s.get("operator_address") == operator_address for s in signatures)
        if not already_signed:
            signer_num = len(signatures) + 1
            is_admin = bool(req.wallet and operator_address == req.wallet.address)
            signatures.append({
                "operator_address": operator_address,
                "signature": signature or f"sep53_sig_{now.timestamp()}",
                "weight": weight,
                "role": "ADMIN" if is_admin else "OPERATOR",
                "notes": notes or f"Signer {signer_num} of {req.required_weight or 2}: {'Admin Wallet Signature' if is_admin else 'Co-Signer Signature'}",
                "signed_at": now.isoformat(),
            })

        req.operator_signatures = signatures
        req.collected_weight = sum(s.get("weight", 1) for s in signatures)

        # Check if threshold is reached
        required = req.required_weight or (req.wallet.threshold_med if req.wallet else 2)
        if req.collected_weight >= required and req.status == "PENDING_APPROVAL":
            req.status = "APPROVED"
            if hasattr(req, "permit") and req.permit:
                req.permit.status = "APPROVED"
                req.permit.approved_by = operator_address
                req.permit.approved_at = now
                req.permit.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

        req.save(update_fields=["operator_signatures", "collected_weight", "status", "updated_at"])

        # If threshold reached and auto_execute requested, execute live
        auto_execute = request.data.get("auto_execute", False)
        if auto_execute and req.status == "APPROVED":
            try:
                req = cosign_and_execute_request(
                    request_id=req.request_id,
                    mock_stellar=request.data.get("mock_stellar", False),
                )
            except Exception as e:
                logger.warning("Auto execution after signing failed: %s", str(e))

        record_audit_event(
            event_type="OPERATOR_SIGNED_TRANSACTION",
            actor_id=operator_address,
            actor_type="OPERATOR",
            request_id=req.request_id,
            details={
                "weight": weight,
                "collected_weight": req.collected_weight,
                "required_weight": required,
                "new_status": req.status,
            },
        )

        return Response(TransactionRequestSerializer(req).data)


    @extend_schema(
        request=OperatorRejectionSerializer,
        responses={200: TransactionRequestSerializer},
        description="Operator rejects a pending request, transitioning it to REJECTED and releasing reserved budget.",
    )
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        req = self.get_object()
        serializer = OperatorRejectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_req = operator_reject_request(
                request_id=req.request_id,
                operator_address=serializer.validated_data["operator_address"],
                reason=serializer.validated_data["reason"],
            )
            return Response(TransactionRequestSerializer(updated_req).data)
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, "message") else e)}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        responses={200: TransactionRequestSerializer},
        description="Co-signs the exact approved transaction payload and submits to Stellar Testnet.",
    )
    @action(detail=True, methods=["post"], url_path="cosign-and-submit")
    def cosign_and_submit(self, request, pk=None):
        req = self.get_object()
        mock_mode = request.data.get("mock_stellar", False)

        try:
            executed_req = cosign_and_execute_request(request_id=req.request_id, mock_stellar=mock_mode)
            return Response(TransactionRequestSerializer(executed_req).data)
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, "message") else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Co-signing and submission failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OperatorPermitViewSet(viewsets.ReadOnlyModelViewSet):
    """Operator ViewSet to inspect authorization permits."""

    queryset = Permit.objects.all().select_related("request", "agent", "wallet").order_by("-created_at")
    serializer_class = PermitSerializer


class DashboardStatsView(APIView):
    """Overview statistics for the Operator Main Dashboard."""

    @extend_schema(
        responses={200: DashboardStatsSerializer},
        description="Retrieve key operational indicators: wallet balance, pending approvals, spending utilization.",
    )
    def get(self, request):
        wallet = ControlledWallet.objects.first()
        balance = wallet.balance if wallet else Decimal("0.0000000")

        active_agents = AIAgent.objects.filter(status="ACTIVE").count()
        pending_approvals = TransactionRequest.objects.filter(status="PENDING_APPROVAL").count()
        approved_transactions = TransactionRequest.objects.filter(status="APPROVED").count()
        blocked_transactions = TransactionRequest.objects.filter(status="BLOCKED").count()
        executed_transactions = TransactionRequest.objects.filter(status="EXECUTED").count()

        spent_daily = Decimal("0.0000000")
        daily_limit = Decimal("0.0000000")
        spent_weekly = Decimal("0.0000000")
        weekly_limit = Decimal("0.0000000")

        if wallet:
            ledger = SpendingLedger.objects.filter(wallet=wallet).first()
            if ledger:
                ledger.sync_windows()
                spent_daily = ledger.spent_daily
                spent_weekly = ledger.spent_weekly
                if ledger.policy:
                    daily_limit = ledger.policy.daily_spending_limit
                    weekly_limit = ledger.policy.weekly_spending_limit

        return Response(
            {
                "wallet_balance": balance,
                "active_agents": active_agents,
                "pending_approvals": pending_approvals,
                "approved_transactions": approved_transactions,
                "blocked_transactions": blocked_transactions,
                "executed_transactions": executed_transactions,
                "spent_daily": spent_daily,
                "daily_limit": daily_limit,
                "spent_weekly": spent_weekly,
                "weekly_limit": weekly_limit,
            }
        )
