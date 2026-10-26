import pytest
from apps.agents.models import AIAgent
from apps.agents.authentication import AgentAPIKeyAuthentication
from apps.core.utils import verify_api_key
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory


@pytest.mark.django_db
def test_agent_creation_and_key_hashing(ai_agent):
    assert ai_agent.agent_id == "agent_001"
    assert ai_agent.status == "ACTIVE"
    assert ai_agent.is_operational is True

    # Raw key is never stored in DB
    raw_key = ai_agent.raw_api_key
    assert ai_agent.api_key_hash != raw_key
    assert verify_api_key(raw_key, ai_agent.api_key_hash) is True


@pytest.mark.django_db
def test_agent_emergency_disable_and_reactivation(ai_agent):
    ai_agent.emergency_disable()
    assert ai_agent.status == "DISABLED"
    assert ai_agent.emergency_disabled_at is not None
    assert ai_agent.is_operational is False

    ai_agent.activate()
    assert ai_agent.status == "ACTIVE"
    assert ai_agent.emergency_disabled_at is None
    assert ai_agent.is_operational is True


@pytest.mark.django_db
def test_agent_api_key_authentication_backend(ai_agent):
    auth = AgentAPIKeyAuthentication()
    factory = APIRequestFactory()

    # 1. Valid key in header
    request = factory.get("/", HTTP_X_AGENT_KEY=ai_agent.raw_api_key)
    user, key = auth.authenticate(request)
    assert user.id == ai_agent.id
    assert key == ai_agent.raw_api_key

    # 2. Invalid key in header
    bad_request = factory.get("/", HTTP_X_AGENT_KEY="gr_live_invalidkey123456789")
    with pytest.raises(AuthenticationFailed):
        auth.authenticate(bad_request)

    # 3. Emergency disabled agent
    ai_agent.emergency_disable()
    disabled_request = factory.get("/", HTTP_X_AGENT_KEY=ai_agent.raw_api_key)
    with pytest.raises(AuthenticationFailed, match="emergency disabled"):
        auth.authenticate(disabled_request)
