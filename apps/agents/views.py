from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from stellar_sdk import Keypair
import uuid

from apps.core.utils import generate_secure_api_key
from apps.audit.models import record_audit_event
from apps.wallets.models import ControlledWallet
from .models import AIAgent
from .serializers import (
    AIAgentSerializer,
    CreateAIAgentSerializer,
    UpdateAIAgentSerializer,
    AgentRegistrationResponseSerializer,
)


class AIAgentViewSet(viewsets.ModelViewSet):
    """
    Operator ViewSet for registering and supervising AI Agents.
    Supports secure credential issuance, PDA address generation, policy assignment, and emergency killswitch.
    """

    queryset = AIAgent.objects.all().select_related("wallet", "policy").order_by("-created_at")
    serializer_class = AIAgentSerializer

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return UpdateAIAgentSerializer
        return AIAgentSerializer

    @extend_schema(
        request=CreateAIAgentSerializer,
        responses={201: AgentRegistrationResponseSerializer},
        description="Register a new AI agent, generate its PDA Stellar keypair and cryptographically secured API Key.",
    )
    def create(self, request, *args, **kwargs):
        serializer = CreateAIAgentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data.copy()

        if not validated_data.get("agent_id"):
            validated_data["agent_id"] = f"agent_{uuid.uuid4().hex[:8]}"

        if not validated_data.get("wallet"):
            default_wallet = ControlledWallet.objects.filter(is_active=True).first()
            if not default_wallet:
                default_wallet = ControlledWallet.objects.first()
            validated_data["wallet"] = default_wallet

        full_key, prefix, key_hash = generate_secure_api_key()

        # Generate Stellar PDA Keypair (Public G... and Secret S...)
        pda_secret_key = None
        if not validated_data.get("stellar_public_key"):
            kp = Keypair.random()
            validated_data["stellar_public_key"] = kp.public_key
            pda_secret_key = kp.secret

        agent = AIAgent.objects.create(
            api_key_prefix=prefix,
            api_key_hash=key_hash,
            **validated_data,
        )

        record_audit_event(
            event_type="AI_AGENT_REGISTERED",
            actor_id=agent.agent_id,
            actor_type="AI_AGENT",
            details={
                "name": agent.name,
                "stellar_public_key": agent.stellar_public_key,
                "signer_weight": agent.signer_weight,
                "autonomy_mode": agent.autonomy_mode,
                "policy_id": str(agent.policy.id),
                "wallet_id": str(agent.wallet.id),
            },
        )

        return Response(
            {
                "agent": AIAgentSerializer(agent).data,
                "api_key": full_key,
                "stellar_public_key": agent.stellar_public_key,
                "stellar_secret_key": pda_secret_key,
                "warning": "Store this API key and Stellar Secret Key securely. They cannot be recovered after this prompt.",
            },
            status=status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        agent = serializer.save()
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
        responses={200: AgentRegistrationResponseSerializer},
        description="Rotate API credentials for an existing AI agent, immediately invalidating the old key.",
    )
    @action(detail=True, methods=["post"], url_path="rotate-key")
    def rotate_key(self, request, pk=None):
        agent = self.get_object()
        full_key, prefix, key_hash = generate_secure_api_key()

        agent.api_key_prefix = prefix
        agent.api_key_hash = key_hash
        agent.save(update_fields=["api_key_prefix", "api_key_hash"])

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
