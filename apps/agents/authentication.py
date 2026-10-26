from django.db import models
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.core.utils import verify_api_key, get_utc_now
from .models import AIAgent


class AgentAPIKeyAuthentication(BaseAuthentication):
    """
    Authenticates AI agents via secure API Key.
    Expected header:
      `X-Agent-Key: gr_live_...` or `Authorization: Bearer gr_live_...`
    """

    def authenticate(self, request):
        api_key = request.headers.get("X-Agent-Key")
        auth_header = request.headers.get("Authorization")

        if not api_key and auth_header and auth_header.startswith("Bearer "):
            api_key = auth_header.split(" ", 1)[1].strip()

        if not api_key:
            return None  # Pass to subsequent authentication classes or unauthenticated

        prefix = api_key[:12]
        matching_agents = AIAgent.objects.filter(
            models.Q(api_key_prefix=prefix) | models.Q(api_key=api_key) | models.Q(api_key_prefix=api_key)
        )

        for agent in matching_agents:
            is_valid = (
                (agent.api_key and api_key == agent.api_key)
                or verify_api_key(api_key, agent.api_key_hash)
                or (agent.api_key_prefix and api_key == agent.api_key_prefix)
            )
            if is_valid:
                if agent.status == "DISABLED":
                    raise AuthenticationFailed("This AI agent has been emergency disabled by the operator.")
                if agent.status in ("INACTIVE", "REVOKED"):
                    raise AuthenticationFailed("This AI agent credentials are inactive or revoked.")

                agent.last_active_at = get_utc_now()
                agent.save(update_fields=["last_active_at"])

                # Return (agent, auth_token)
                return (agent, api_key)

        raise AuthenticationFailed("Invalid Agent API key.")


try:
    from drf_spectacular.extensions import OpenApiAuthenticationExtension

    class AgentAPIKeyScheme(OpenApiAuthenticationExtension):
        target_class = "apps.agents.authentication.AgentAPIKeyAuthentication"
        name = "AgentApiKeyAuth"

        def get_security_definition(self, auto_schema):
            return {
                "type": "apiKey",
                "in": "header",
                "name": "X-Agent-Key",
                "description": "AI Agent Secret API Key (prefix + secure token, e.g. gr_live_...)",
            }
except ImportError:
    pass

