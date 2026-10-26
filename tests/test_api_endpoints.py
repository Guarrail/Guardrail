import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from tests.conftest import TEST_OPERATOR_ADDRESS, TEST_RECIPIENT_ADDRESS


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_health_check_endpoint(api_client):
    response = api_client.get("/health/")
    assert response.status_code == 200
    assert response.data["status"] == "healthy"
    assert response.data["service"] == "GuardRail Policy Coordinator"


@pytest.mark.django_db
def test_swagger_and_schema_endpoints(api_client):
    response = api_client.get("/api/schema/")
    assert response.status_code == 200

    docs_response = api_client.get("/api/docs/")
    assert docs_response.status_code == 200


@pytest.mark.django_db
def test_operator_challenge_and_verification_flow(api_client):
    # Step 1: Request Challenge
    ch_res = api_client.post("/api/v1/auth/challenge/", {"address": TEST_OPERATOR_ADDRESS}, format="json")
    assert ch_res.status_code == 200
    assert "challenge" in ch_res.data
    assert "nonce" in ch_res.data

    # Step 2: Verify with test signature and alias
    v_res = api_client.post(
        "/api/v1/auth/verify/",
        {"address": TEST_OPERATOR_ADDRESS, "signature": "test_signature", "alias": "alice_treasury"},
        format="json",
    )
    assert v_res.status_code == 200
    assert v_res.data["operator"]["is_verified"] is True
    assert v_res.data["operator"]["alias"] == "alice_treasury"

    # Step 3: GET /api/v1/auth/me/
    me_res = api_client.get(f"/api/v1/auth/me/?address={TEST_OPERATOR_ADDRESS}")
    assert me_res.status_code == 200
    assert me_res.data["alias"] == "alice_treasury"
    assert me_res.data["is_verified"] is True

    # Step 4: PATCH /api/v1/auth/me/ to update profile
    patch_res = api_client.patch(
        "/api/v1/auth/me/",
        {"address": TEST_OPERATOR_ADDRESS, "alias": "alice_prime"},
        format="json",
    )
    assert patch_res.status_code == 200
    assert patch_res.data["alias"] == "alice_prime"


@pytest.mark.django_db
def test_wallet_generate_address_and_auto_create(api_client):
    # Test generate address endpoint
    gen_res = api_client.get("/api/v1/wallets/generate-address/")
    assert gen_res.status_code == 200
    assert "address" in gen_res.data
    assert len(gen_res.data["address"]) == 56
    assert gen_res.data["address"].startswith("G")

    # Test create wallet with auto-generated address (empty address passed)
    create_res = api_client.post(
        "/api/v1/wallets/",
        {
            "operator_address": TEST_OPERATOR_ADDRESS,
            "name": "Auto Protected Vault",
            "balance": "100.0000000",
        },
        format="json",
    )
    assert create_res.status_code == 201
    assert "id" in create_res.data
    assert len(create_res.data["address"]) == 56
    assert create_res.data["address"].startswith("G")


@pytest.mark.django_db
def test_wallet_security_audit_endpoint(api_client, controlled_wallet):
    res = api_client.get(f"/api/v1/wallets/{controlled_wallet.id}/security-audit/")
    assert res.status_code == 200
    assert res.data["is_compliant"] is True
    assert res.data["agent_independent_signing_prevented"] is True


@pytest.mark.django_db
def test_agent_submit_request_endpoint_authenticated(api_client, ai_agent):
    api_client.credentials(HTTP_X_AGENT_KEY=ai_agent.raw_api_key)

    payload = {
        "request_id": "req_api_001",
        "recipient": TEST_RECIPIENT_ADDRESS,
        "amount": "10.0000000",
        "asset": "XLM",
    }
    response = api_client.post("/api/v1/agent/requests/", payload, format="json")
    assert response.status_code == 201
    assert response.data["status"] in ("APPROVED", "EXECUTED")
    assert "permit" in response.data
    assert response.data["permit"]["amount"] == "10.0000000"


@pytest.mark.django_db
def test_agent_submit_request_unauthenticated_rejected(api_client):
    # No credentials provided
    payload = {
        "request_id": "req_no_auth",
        "recipient": TEST_RECIPIENT_ADDRESS,
        "amount": "10.0000000",
    }
    response = api_client.post("/api/v1/agent/requests/", payload, format="json")
    assert response.status_code == 401


@pytest.mark.django_db
def test_agent_query_policy_summary(api_client, ai_agent):
    api_client.credentials(HTTP_X_AGENT_KEY=ai_agent.raw_api_key)

    response = api_client.get("/api/v1/agent/policy-summary/")
    assert response.status_code == 200
    assert response.data["agent_id"] == ai_agent.agent_id
    assert "policy" in response.data
    assert len(response.data["allowed_recipients"]) > 0


@pytest.mark.django_db
def test_operator_dashboard_stats_endpoint(api_client, controlled_wallet):
    response = api_client.get("/api/v1/coordinator/dashboard-stats/")
    assert response.status_code == 200
    assert "wallet_balance" in response.data
    assert "active_agents" in response.data


@pytest.mark.django_db
def test_operator_approve_and_cosign_endpoints(api_client, ai_agent, operator):
    # Submit request requiring approval (20 XLM > 15 XLM threshold)
    api_client.credentials(HTTP_X_AGENT_KEY=ai_agent.raw_api_key)
    submit_res = api_client.post(
        "/api/v1/agent/requests/",
        {
            "request_id": "req_human_approval_api",
            "recipient": TEST_RECIPIENT_ADDRESS,
            "amount": "20.0000000",
            "asset": "XLM",
        },
        format="json",
    )
    assert submit_res.status_code == 201
    req_id = submit_res.data["id"]

    # Clear agent auth to simulate operator dashboard action
    api_client.credentials()

    # Operator approves
    approve_res = api_client.post(
        f"/api/v1/coordinator/requests/{req_id}/approve/",
        {"operator_address": operator.address, "notes": "Approved for vendor"},
        format="json",
    )
    assert approve_res.status_code == 200
    assert approve_res.data["status"] == "APPROVED"

    # Operator co-signs and submits
    cosign_res = api_client.post(
        f"/api/v1/coordinator/requests/{req_id}/cosign-and-submit/",
        {"mock_stellar": True},
        format="json",
    )
    assert cosign_res.status_code == 200
    assert cosign_res.data["status"] == "EXECUTED"
    assert cosign_res.data["stellar_tx_hash"] != ""


@pytest.mark.django_db
def test_soroban_contract_endpoints(api_client):
    status_res = api_client.get("/api/v1/smart-contract/status/")
    assert status_res.status_code == 200
    assert status_res.data["contract_name"] == "guardrail-contract"

    sim_res = api_client.post(
        "/api/v1/smart-contract/simulate/",
        {
            "permit_id_hex": "0101010101010101010101010101010101010101010101010101010101010101",
            "token_address": "CDEMOTOKENTESTNET1234567890ABCDEFGH1234567890ABCDEFGH12",
            "recipient_address": TEST_RECIPIENT_ADDRESS,
            "amount_stroops": 10000000,
            "expires_at_timestamp": 2000000000,
            "agent_address": "GAAGENTSIGNERADDRESSDEMO1234567890ABCDEFGH1234567890AB",
            "cosigner_address": "GBGUARDRAILCOSIGNERTESTNETPUBKEYDEMO1234567890ABCDEFGH",
        },
        format="json",
    )
    assert sim_res.status_code == 200
    assert sim_res.data["success"] is True
