from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.core.utils import generate_secure_api_key
from .models import AIAgent
from .serializers import (
    AIAgentSerializer,
    CreateAIAgentSerializer,
    AgentRegistrationResponseSerializer,
)


class AIAgentViewSet(viewsets.ModelViewSet):
    """
    Operator ViewSet for registering and supervising AI Agents.
    Supports secure credential issuance, rotation, and emergency killswitch.
    """

    queryset = AIAgent.objects.all().select_related("wallet", "policy").order_by("-created_at")
    serializer_class = AIAgentSerializer

    @extend_schema(
        request=CreateAIAgentSerializer,
        responses={201: AgentRegistrationResponseSerializer},
        description="Register a new AI agent and generate its cryptographically secured API Key.",
    )
    def create(self, request, *args, **kwargs):
        serializer = CreateAIAgentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        full_key, prefix, key_hash = generate_secure_api_key()

        agent = AIAgent.objects.create(
            api_key_prefix=prefix,
            api_key_hash=key_hash,
            **serializer.validated_data,
        )

        return Response(
            {
                "agent": AIAgentSerializer(agent).data,
                "api_key": full_key,
                "warning": "Store this API key securely. It cannot be recovered after this prompt.",
            },
            status=status.HTTP_201_CREATED,
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
