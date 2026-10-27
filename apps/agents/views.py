import logging
import uuid
from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from stellar_sdk import Keypair

from apps.core.utils import generate_secure_api_key
from apps.core.stellar import (
    fund_account_via_friendbot,
    write_policy_to_pda,
    refund_pda_funds_to_owner,
    get_account_balances_from_horizon,
    get_horizon_server,
    is_valid_stellar_address,
)
from apps.audit.models import record_audit_event
from apps.wallets.models import ControlledWallet
from apps.accounts.models import Operator
from .models import AIAgent
from .serializers import (
    AIAgentSerializer,
    CreateAIAgentSerializer,
    UpdateAIAgentSerializer,
    AgentRegistrationResponseSerializer,
)

logger = logging.getLogger(__name__)


class AIAgentViewSet(viewsets.ModelViewSet):
    """
    Operator ViewSet for registering and supervising AI Agents.
    Supports secure credential issuance, PDA address generation, policy assignment, and emergency killswitch.
    """

    queryset = AIAgent.objects.all().select_related("wallet", "policy").prefetch_related("delegated_operators").order_by("-created_at")
    serializer_class = AIAgentSerializer

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return UpdateAIAgentSerializer
        return AIAgentSerializer

    @extend_schema(
        request=CreateAIAgentSerializer,
        responses={201: AgentRegistrationResponseSerializer},
        description="Register a new AI agent, generate its PDA Stellar keypair, fund on testnet, embed policy on-chain, and issue API Key.",
    )
    def create(self, request, *args, **kwargs):
        serializer = CreateAIAgentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data.copy()

        delegated_addrs = validated_data.pop("delegated_operator_addresses", [])

        if not validated_data.get("agent_id"):
            validated_data["agent_id"] = f"agent_{uuid.uuid4().hex[:8]}"

        # Resolve or link controlled wallet
        if not validated_data.get("wallet"):
            operator_addr = request.headers.get("X-Operator-Address") or request.query_params.get("operator_address")
            default_wallet = None
            if operator_addr:
                default_wallet = ControlledWallet.objects.filter(operator__address=operator_addr, is_active=True).first()
            if not default_wallet:
                default_wallet = ControlledWallet.objects.filter(is_active=True).first()
            if not default_wallet:
                # Create a default wallet for the operator if none exists
                if operator_addr and is_valid_stellar_address(operator_addr):
                    op, _ = Operator.objects.get_or_create(address=operator_addr)
                    default_wallet = ControlledWallet.objects.create(
                        operator=op,
                        address=operator_addr,
                        name="Primary Controlled Wallet",
                    )
                else:
                    return Response(
                        {"error": "No controlled wallet found. Please connect your wallet first."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            validated_data["wallet"] = default_wallet

        full_key, prefix, key_hash = generate_secure_api_key()

        # 1. Generate Stellar PDA Keypair (Public G... and Secret S...)
        pda_secret_key = None
        if not validated_data.get("stellar_public_key"):
            kp = Keypair.random()
            validated_data["stellar_public_key"] = kp.public_key
            pda_secret_key = kp.secret
        else:
            pda_secret_key = validated_data.get("stellar_secret_key", "")

        pda_pubkey = validated_data["stellar_public_key"]

        # 2. Fund PDA on Stellar Testnet via Friendbot
        logger.info("Auto-funding PDA %s via Friendbot on Stellar Testnet...", pda_pubkey)
        funded = fund_account_via_friendbot(pda_pubkey)

        # 3. Write Policy directly into PDA on Stellar Testnet using ManageData
        policy = validated_data["policy"]
        pda_tx_hash = ""
        admin_address = validated_data["wallet"].address
        autonomy_mode = validated_data.get("autonomy_mode", "AUTONOMOUS")
        signer_weight = validated_data.get("signer_weight", 1)

        if pda_secret_key:
            try:
                policy_dict = {
                    "id": str(policy.id),
                    "name": policy.name,
                    "max_amount_per_tx": str(policy.max_amount_per_tx),
                    "daily_spending_limit": str(policy.daily_spending_limit),
                    "weekly_spending_limit": str(policy.weekly_spending_limit),
                    "human_approval_threshold": str(policy.human_approval_threshold),
                }

                pda_tx_hash = write_policy_to_pda(
                    pda_secret=pda_secret_key,
                    policy_dict=policy_dict,
                    admin_address=admin_address,
                    autonomy_mode=autonomy_mode,
                    signer_weight=signer_weight,
                    additional_signers=delegated_addrs,
                )
                logger.info("Policy successfully written into PDA %s on testnet! Tx: %s", pda_pubkey, pda_tx_hash)
            except Exception as e:
                logger.exception("Failed to write policy to PDA on-chain: %s", str(e))

        agent = AIAgent.objects.create(
            api_key=full_key,
            api_key_prefix=prefix,
            api_key_hash=key_hash,
            stellar_secret_key=pda_secret_key or "",
            pda_tx_hash=pda_tx_hash,
            pda_funded=funded,
            **validated_data,
        )

        # Associate delegated operators if provided
        for addr in delegated_addrs:
            if is_valid_stellar_address(addr):
                op, _ = Operator.objects.get_or_create(address=addr, defaults={"role": "OPERATOR"})
                agent.delegated_operators.add(op)

        # If approval always is selected or weight >= 2, ensure the admin user wallet is configured as the second signer
        if (autonomy_mode == "HUMAN_APPROVAL_ALWAYS" or signer_weight >= 2) and is_valid_stellar_address(admin_address):
            admin_op, _ = Operator.objects.get_or_create(address=admin_address, defaults={"role": "ADMIN"})
            agent.delegated_operators.add(admin_op)

        # Register multisig signers and threshold in Soroban smart contract
        if signer_weight >= 2 or autonomy_mode == "HUMAN_APPROVAL_ALWAYS":
            try:
                signers_payload = [
                    {"address": admin_address, "role": "ADMIN", "weight": 1}
                ]
                for addr in delegated_addrs:
                    if addr != admin_address and is_valid_stellar_address(addr):
                        signers_payload.append({"address": addr, "role": "OPERATOR", "weight": 1})
                from apps.smart_contracts.services import SorobanGuardrailClient
                SorobanGuardrailClient().register_agent_multisig(
                    agent_id=agent.agent_id,
                    agent_address=agent.stellar_public_key,
                    signers=signers_payload,
                    required_weight=signer_weight,
                )
            except Exception as e:
                logger.warning("Could not register agent multisig in Soroban contract: %s", str(e))

        record_audit_event(
            event_type="AI_AGENT_REGISTERED",
            actor_id=agent.agent_id,
            actor_type="AI_AGENT",
            stellar_tx_hash=pda_tx_hash,
            details={
                "name": agent.name,
                "stellar_public_key": agent.stellar_public_key,
                "signer_weight": agent.signer_weight,
                "autonomy_mode": agent.autonomy_mode,
                "policy_id": str(agent.policy.id),
                "wallet_id": str(agent.wallet.id),
                "pda_funded": funded,
                "pda_tx_hash": pda_tx_hash,
            },
        )

        explorer_url = f"https://stellar.expert/explorer/testnet/account/{agent.stellar_public_key}"
        tx_url = f"https://stellar.expert/explorer/testnet/tx/{pda_tx_hash}" if pda_tx_hash else ""

        return Response(
            {
                "agent": AIAgentSerializer(agent).data,
                "api_key": full_key,
                "stellar_public_key": agent.stellar_public_key,
                "stellar_secret_key": pda_secret_key,
                "pda_tx_hash": pda_tx_hash,
                "explorer_url": explorer_url,
                "pda_tx_url": tx_url,
                "warning": "Store this API key and Stellar Secret Key securely. They cannot be recovered after this prompt.",
            },
            status=status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        delegated_addrs = self.request.data.get("delegated_operator_addresses")
        agent = serializer.save()

        if delegated_addrs is not None:
            agent.delegated_operators.clear()
            for addr in delegated_addrs:
                if is_valid_stellar_address(addr):
                    op, _ = Operator.objects.get_or_create(address=addr, defaults={"role": "OPERATOR"})
                    agent.delegated_operators.add(op)

        # Ensure admin wallet is delegated operator if approval always or weight >= 2
        if (agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS" or agent.signer_weight >= 2) and agent.wallet and is_valid_stellar_address(agent.wallet.address):
            admin_op, _ = Operator.objects.get_or_create(address=agent.wallet.address, defaults={"role": "ADMIN"})
            agent.delegated_operators.add(admin_op)

        # Update on-chain policy if secret key exists
        if agent.stellar_secret_key and agent.policy:
            try:
                policy_dict = {
                    "id": str(agent.policy.id),
                    "name": agent.policy.name,
                    "max_amount_per_tx": str(agent.policy.max_amount_per_tx),
                    "daily_spending_limit": str(agent.policy.daily_spending_limit),
                    "weekly_spending_limit": str(agent.policy.weekly_spending_limit),
                    "human_approval_threshold": str(agent.policy.human_approval_threshold),
                }
                tx_hash = write_policy_to_pda(
                    pda_secret=agent.stellar_secret_key,
                    policy_dict=policy_dict,
                    admin_address=agent.wallet.address,
                    autonomy_mode=agent.autonomy_mode,
                    signer_weight=agent.signer_weight,
                )
                agent.pda_tx_hash = tx_hash
                agent.save(update_fields=["pda_tx_hash"])
            except Exception as e:
                logger.warning("Could not sync policy on-chain during update: %s", str(e))

        record_audit_event(
            event_type="AI_AGENT_CONFIG_UPDATED",
            actor_id=agent.agent_id,
            actor_type="AI_AGENT",
            details={
                "name": agent.name,
                "status": agent.status,
                "signer_weight": agent.signer_weight,
                "autonomy_mode": agent.autonomy_mode,
                "policy_id": str(agent.policy.id),
            },
        )

    @extend_schema(
        description="Query live on-chain balances and ManageData entries for this AI Agent PDA on Stellar Testnet.",
        responses={200: dict},
    )
    @action(detail=True, methods=["get"], url_path="live-balance")
    def live_balance(self, request, pk=None):
        agent = self.get_object()
        balances = get_account_balances_from_horizon(agent.stellar_public_key)

        onchain_data = {}
        server = get_horizon_server()
        try:
            acc = server.accounts().account_id(agent.stellar_public_key).call()
            onchain_data = acc.get("data", {})
        except Exception:
            pass

        native_balance = "0.0000000"
        for b in balances:
            if b.get("asset_type") == "native":
                native_balance = b.get("balance", "0.0000000")
                break

        return Response({
            "agent_id": agent.agent_id,
            "stellar_public_key": agent.stellar_public_key,
            "native_balance": native_balance,
            "balances": balances,
            "onchain_data": onchain_data,
            "explorer_url": f"https://stellar.expert/explorer/testnet/account/{agent.stellar_public_key}",
            "pda_tx_hash": agent.pda_tx_hash,
            "pda_tx_url": f"https://stellar.expert/explorer/testnet/tx/{agent.pda_tx_hash}" if agent.pda_tx_hash else "",
        })

    @extend_schema(
        description="PDA refund: Agent sends funds from its own PDA address back to the user/owner signup wallet address.",
        responses={200: dict},
    )
    @action(detail=True, methods=["post"], url_path="refund-to-owner")
    def refund_to_owner(self, request, pk=None):
        agent = self.get_object()
        if not agent.stellar_secret_key:
            return Response({"error": "No PDA secret key available for this agent."}, status=status.HTTP_400_BAD_REQUEST)

        amount_raw = request.data.get("amount")
        amount = Decimal(str(amount_raw)) if amount_raw else None

        destination = (
            request.data.get("destination")
            or request.data.get("recipient")
            or (agent.wallet.address if agent.wallet else None)
        )
        if not destination or not is_valid_stellar_address(destination):
            return Response(
                {"error": f"Invalid or missing Stellar destination address: '{destination}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        asset_code = request.data.get("asset") or request.data.get("asset_code") or "XLM"
        asset_issuer = request.data.get("asset_issuer")

        try:
            tx_hash, xdr, transferred = refund_pda_funds_to_owner(
                pda_secret=agent.stellar_secret_key,
                owner_address=destination,
                amount=amount,
                asset_code=asset_code,
                asset_issuer=asset_issuer,
            )

            record_audit_event(
                event_type="PDA_REFUND_EXECUTED",
                actor_id=agent.agent_id,
                actor_type="AI_AGENT",
                stellar_tx_hash=tx_hash,
                details={
                    "pda_address": agent.stellar_public_key,
                    "recipient": destination,
                    "amount": str(transferred),
                    "asset": asset_code,
                },
            )

            is_self = agent.wallet and destination == agent.wallet.address
            recipient_label = "master wallet (self)" if is_self else destination
            return Response({
                "message": f"Successfully sent {transferred} {asset_code} from PDA to {recipient_label}.",
                "stellar_tx_hash": tx_hash,
                "amount": str(transferred),
                "asset": asset_code,
                "destination": destination,
                "is_self": is_self,
                "explorer_url": f"https://stellar.expert/explorer/testnet/tx/{tx_hash}",
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("PDA transfer/refund failed: %s", str(e))
            return Response({"error": f"Transfer failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        description="Deposit/Fund PDA: Agent requests funds from the user wallet or instant Testnet Friendbot top-up.",
        responses={200: dict},
    )
    @action(detail=True, methods=["post"], url_path="request-funds")
    def request_funds(self, request, pk=None):
        agent = self.get_object()
        action_type = request.data.get("action", "friendbot")

        if action_type == "friendbot":
            success = fund_account_via_friendbot(agent.stellar_public_key)
            if success:
                agent.pda_funded = True
                agent.save(update_fields=["pda_funded"])
                return Response({
                    "message": f"Successfully funded PDA {agent.stellar_public_key} with 10,000 XLM from Friendbot.",
                    "stellar_public_key": agent.stellar_public_key,
                    "explorer_url": f"https://stellar.expert/explorer/testnet/account/{agent.stellar_public_key}",
                })
            else:
                return Response({"error": "Friendbot funding request failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        amount = request.data.get("amount", "50.0")
        memo = f"Fund PDA {agent.agent_id}"

        return Response({
            "message": "Payment request to deposit into Agent PDA created.",
            "destination": agent.stellar_public_key,
            "amount": amount,
            "memo": memo,
            "asset": "XLM",
            "deposit_instruction": f"Send {amount} XLM from your connected wallet to PDA: {agent.stellar_public_key}",
        })

    @extend_schema(
        description="Delegate an operator on the platform to view and approve transactions for this agent.",
        responses={200: dict},
    )
    @action(detail=True, methods=["post"], url_path="delegate-operator")
    def delegate_operator(self, request, pk=None):
        agent = self.get_object()
        operator_address = request.data.get("operator_address")
        if not is_valid_stellar_address(operator_address):
            return Response({"error": "Invalid Stellar operator address."}, status=status.HTTP_400_BAD_REQUEST)

        alias = request.data.get("alias", "")
        role = request.data.get("role", "OPERATOR")

        op, _ = Operator.objects.get_or_create(address=operator_address, defaults={"alias": alias, "role": role})
        agent.delegated_operators.add(op)

        return Response({
            "message": f"Operator {operator_address} delegated successfully.",
            "delegated_operators": [o.address for o in agent.delegated_operators.all()],
        })

    @extend_schema(
        responses={200: AgentRegistrationResponseSerializer},
        description="Rotate API credentials for an existing AI agent, immediately invalidating the old key.",
    )
    @action(detail=True, methods=["post"], url_path="rotate-key")
    def rotate_key(self, request, pk=None):
        agent = self.get_object()
        full_key, prefix, key_hash = generate_secure_api_key()

        agent.api_key = full_key
        agent.api_key_prefix = prefix
        agent.api_key_hash = key_hash
        agent.save(update_fields=["api_key", "api_key_prefix", "api_key_hash"])

        return Response(
            {
                "agent": AIAgentSerializer(agent).data,
                "api_key": full_key,
                "warning": "Old credentials have been invalidated. Deploy the new key to the AI agent runtime.",
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        responses={200: AIAgentSerializer},
        description="Emergency killswitch: instantly deactivate the agent to block all outbound payment requests.",
    )
    @action(detail=True, methods=["post"], url_path="emergency-disable")
    def emergency_disable(self, request, pk=None):
        agent = self.get_object()
        agent.emergency_disable()
        return Response(
            {
                "message": f"Agent {agent.agent_id} has been emergency disabled. All co-signing refused.",
                "agent": AIAgentSerializer(agent).data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        responses={200: AIAgentSerializer},
        description="Re-enable an emergency-disabled or inactive AI agent.",
    )
    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        agent = self.get_object()
        agent.activate()
        return Response(
            {
                "message": f"Agent {agent.agent_id} is now active.",
                "agent": AIAgentSerializer(agent).data,
            },
            status=status.HTTP_200_OK,
        )
