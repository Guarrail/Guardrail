import pytest
from rest_framework.test import APIClient
from apps.accounts.models import Operator
from apps.policies.models import Policy
from apps.coordinator.models import TransactionRequest
from apps.coordinator.services import evaluate_and_create_request
from stellar_sdk import Keypair


@pytest.mark.django_db
def test_agent_pda_generation_and_autonomy(policy, controlled_wallet):
    client = APIClient()
    payload = {
        "name": "Treasury Rebalancer",
        "description": "Autonomous PDA test agent",
        "policy": policy.id,
        "wallet": controlled_wallet.id,
        "signer_weight": 2,
        "autonomy_mode": "AUTONOMOUS",
    }
    response = client.post("/api/v1/agents/", payload, format="json")
    assert response.status_code == 201
    data = response.json()
    assert "stellar_public_key" in data
    assert data["stellar_public_key"].startswith("G")
    assert "stellar_secret_key" in data
    assert data["stellar_secret_key"].startswith("S")
    assert "api_key" in data


@pytest.mark.django_db
def test_agent_editing(ai_agent):
    client = APIClient()
    patch_payload = {
        "name": "Updated Agent Name",
        "description": "Updated description",
        "signer_weight": 3,
        "autonomy_mode": "HUMAN_APPROVAL_ALWAYS",
    }
    response = client.patch(f"/api/v1/agents/{ai_agent.id}/", patch_payload, format="json")
    assert response.status_code == 200
    ai_agent.refresh_from_db()
    assert ai_agent.name == "Updated Agent Name"
    assert ai_agent.signer_weight == 3
    assert ai_agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS"


@pytest.mark.django_db
def test_autonomy_mode_human_approval_always_enforces_pending(ai_agent, recipient_address):
    ai_agent.autonomy_mode = "HUMAN_APPROVAL_ALWAYS"
    ai_agent.save(update_fields=["autonomy_mode"])

    # 5 XLM is well below policy human_approval_threshold (15 XLM)
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_autonomy_test_001",
        recipient=recipient_address,
        amount="5.0000000",
        asset_code="XLM",
    )

    # Even though amount < approval threshold, autonomy_mode forces human approval
    assert req.status == "PENDING_APPROVAL"
    assert req.requires_human_approval is True
    assert permit is not None


@pytest.mark.django_db
def test_multiple_policies_creation():
    client = APIClient()
    recipient_kp = Keypair.random()
    policy_data = {
        "name": "DeFi Liquidity Policy",
        "description": "High throughput policy for DEX market making",
        "max_amount_per_tx": "500.0000000",
        "daily_spending_limit": "5000.0000000",
        "weekly_spending_limit": "20000.0000000",
        "human_approval_threshold": "250.0000000",
        "allowed_assets": ["XLM", "USDC"],
        "allowed_destinations": [recipient_kp.public_key],
    }
    response = client.post("/api/v1/policies/", policy_data, format="json")
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "DeFi Liquidity Policy"
    assert Policy.objects.filter(name="DeFi Liquidity Policy").exists()


@pytest.mark.django_db
def test_wallet_update_weights(controlled_wallet):
    client = APIClient()
    payload = {
        "master_weight": 0,
        "agent_signer_weight": 2,
        "cosigner_weight": 2,
        "threshold_low": 1,
        "threshold_med": 3,
        "threshold_high": 4,
    }
    response = client.post(f"/api/v1/wallets/{controlled_wallet.id}/update-weights/", payload, format="json")
    assert response.status_code == 200
    controlled_wallet.refresh_from_db()
    assert controlled_wallet.master_weight == 0
    assert controlled_wallet.agent_signer_weight == 2
    assert controlled_wallet.cosigner_weight == 2
    assert controlled_wallet.threshold_med == 3
    assert controlled_wallet.threshold_high == 4


@pytest.mark.django_db
def test_operator_transaction_signing_flow(ai_agent, controlled_wallet, recipient_address):
    client = APIClient()
    tx_req = TransactionRequest.objects.create(
        request_id="req_sign_test_001",
        agent=ai_agent,
        wallet=controlled_wallet,
        recipient=recipient_address,
        asset_code="XLM",
        amount="500.0000000",
        status="PENDING_APPROVAL",
        required_weight=2,
        collected_weight=0,
    )

    op_kp = Keypair.random()
    sign_payload = {
        "operator_address": op_kp.public_key,
        "signature": "simulated_base64_sig_xyz",
        "weight": 1,
    }
    response = client.post(f"/api/v1/coordinator/requests/{tx_req.id}/sign/", sign_payload, format="json")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"
    assert data["collected_weight"] == 2
    assert len(data["operator_signatures"]) == 2

    tx_req.refresh_from_db()
    assert tx_req.status == "APPROVED"
    assert tx_req.collected_weight == 2


@pytest.mark.django_db
def test_privilege_escalation_dual_control():
    client = APIClient()
    kp_req = Keypair.random()
    kp_admin = Keypair.random()

    operator_requester = Operator.objects.create(
        address=kp_req.public_key,
        alias="alice_operator",
        role="MEMBER",
        is_verified=True,
    )
    admin_reviewer = Operator.objects.create(
        address=kp_admin.public_key,
        alias="bob_admin",
        role="ADMIN",
        is_verified=True,
    )

    # 1. Create escalation request
    create_payload = {
        "operator_address": operator_requester.address,
        "requested_role": "SIGNER_ADMIN",
        "reason": "Emergency multi-sig rebalancing drill",
        "duration_minutes": 60,
    }
    resp = client.post("/api/v1/accounts/escalations/", create_payload, format="json")
    assert resp.status_code == 201
    escalation_id = resp.json()["id"]

    # 2. Self-approval MUST BE REJECTED (Dual-Control Enforcement)
    self_approve_resp = client.post(
        f"/api/v1/accounts/escalations/{escalation_id}/approve/",
        {"reviewer_address": operator_requester.address},
        format="json",
    )
    assert self_approve_resp.status_code == 403
    assert "Dual-Control Policy Violation" in self_approve_resp.json()["error"]

    # 3. Legitimate Admin Approval
    legit_approve_resp = client.post(
        f"/api/v1/accounts/escalations/{escalation_id}/approve/",
        {"reviewer_address": admin_reviewer.address},
        format="json",
    )
    assert legit_approve_resp.status_code == 200
    assert legit_approve_resp.json()["status"] == "APPROVED"

    operator_requester.refresh_from_db()
    assert operator_requester.role == "MEMBER"  # Permanent base role preserved
    assert operator_requester.effective_role == "SIGNER_ADMIN"  # Elevated role active


@pytest.mark.django_db
def test_autonomous_mode_locks_signer_weight_to_one(controlled_wallet, policy):
    client = APIClient()
    # Attempting to create autonomous agent with weight 3 must lock weight to 1
    create_payload = {
        "name": "Autonomous Bot",
        "wallet": controlled_wallet.id,
        "policy": policy.id,
        "signer_weight": 3,
        "autonomy_mode": "AUTONOMOUS",
    }
    resp = client.post("/api/v1/agents/", create_payload, format="json")
    assert resp.status_code == 201
    agent_data = resp.json()["agent"]
    assert agent_data["signer_weight"] == 1
    assert agent_data["autonomy_mode"] == "AUTONOMOUS"

    # Attempting to update autonomous agent with weight 5 must also lock weight to 1
    patch_payload = {
        "signer_weight": 5,
        "autonomy_mode": "AUTONOMOUS",
    }
    patch_resp = client.patch(f"/api/v1/agents/{agent_data['id']}/", patch_payload, format="json")
    assert patch_resp.status_code == 200
    assert patch_resp.json()["signer_weight"] == 1


@pytest.mark.django_db
def test_approval_always_defaults_weight_to_two_and_adds_user_wallet_signer(controlled_wallet, policy):
    client = APIClient()
    create_payload = {
        "name": "Approval Bot",
        "wallet": controlled_wallet.id,
        "policy": policy.id,
        "signer_weight": 1,  # User passed 1, but mode is HUMAN_APPROVAL_ALWAYS
        "autonomy_mode": "HUMAN_APPROVAL_ALWAYS",
    }
    resp = client.post("/api/v1/agents/", create_payload, format="json")
    assert resp.status_code == 201
    agent_data = resp.json()["agent"]
    assert agent_data["signer_weight"] == 2
    assert agent_data["autonomy_mode"] == "HUMAN_APPROVAL_ALWAYS"
    # Admin wallet is added as delegated operator
    assert controlled_wallet.address in agent_data["delegated_operators"]


@pytest.mark.django_db
def test_weight_two_blocks_autonomous_bypass_and_requires_wallet_signature(ai_agent, controlled_wallet, recipient_address):
    # Set agent signer weight to 2
    ai_agent.signer_weight = 2
    ai_agent.autonomy_mode = "HUMAN_APPROVAL_ALWAYS"
    ai_agent.save(update_fields=["signer_weight", "autonomy_mode"])

    # 1. Request submission must NOT auto-execute, must enter PENDING_APPROVAL with required_weight=2
    client = APIClient()
    api_key = getattr(ai_agent, "raw_api_key", ai_agent.api_key)
    client.credentials(HTTP_X_AGENT_KEY=api_key)
    req_payload = {
        "recipient": recipient_address,
        "amount": "5.0000000",
        "asset": "XLM",
        "auto_execute": True,  # Autonomous bypass attempt
    }
    resp = client.post("/api/v1/agent/requests/", req_payload, format="json")
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "PENDING_APPROVAL"
    assert data["requires_human_approval"] is True
    assert data["required_weight"] == 2
    assert data["collected_weight"] == 1  # Agent PDA proposal is Signer 1 of 2
    assert len(data["operator_signatures"]) == 1

    req_id = data["request_id"]
    from apps.coordinator.models import TransactionRequest
    from apps.coordinator.services import cosign_and_execute_request
    from django.core.exceptions import ValidationError

    # 2. cosign_and_execute_request MUST fail before admin wallet signs (1 of 2 weight collected)
    with pytest.raises(ValidationError) as exc:
        cosign_and_execute_request(req_id, mock_stellar=True)
    assert "Request must be in APPROVED state" in str(exc.value)

    # 3. Admin wallet signs via wallet -> collected weight reaches 2 of 2 and status transitions to APPROVED
    op_client = APIClient()
    sign_payload = {
        "operator_address": controlled_wallet.address,
        "signature": "cryptographic_admin_wallet_signature_from_freighter",
        "weight": 1,
        "notes": "Signed via Admin Wallet",
    }
    sign_resp = op_client.post(f"/api/v1/coordinator/requests/{data['id']}/sign/", sign_payload, format="json")
    assert sign_resp.status_code == 200
    assert sign_resp.json()["collected_weight"] == 2
    assert sign_resp.json()["status"] == "APPROVED"
    assert len(sign_resp.json()["operator_signatures"]) == 2

    # 4. Now cosign_and_execute succeeds
    exec_req = cosign_and_execute_request(req_id, mock_stellar=True)
    assert exec_req.status == "EXECUTED"


@pytest.mark.django_db
def test_create_agent_with_multiple_signing_wallets_and_multisig_approval(controlled_wallet, policy, recipient_address):
    from apps.core.stellar import is_valid_stellar_address
    from stellar_sdk import Keypair
    extra_kp = Keypair.random()
    extra_wallet = extra_kp.public_key

    client = APIClient()
    payload = {
        "agent_id": f"multi_{int(Keypair.random().public_key[:8], 36)}",
        "name": "3-of-3 Multisig Agent",
        "description": "Agent with additional signing wallets",
        "wallet": str(controlled_wallet.id),
        "policy": str(policy.id),
        "signer_weight": 3,
        "autonomy_mode": "HUMAN_APPROVAL_ALWAYS",
        "delegated_operator_addresses": [extra_wallet],
    }
    create_resp = client.post("/api/v1/agents/", payload, format="json")
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["agent"]["signer_weight"] == 3
    assert extra_wallet in created_data["agent"]["delegated_operators"]
    assert controlled_wallet.address in created_data["agent"]["delegated_operators"]

    api_key = created_data["api_key"]

    # 1. Agent submits transaction request -> Agent PDA is Signer 1 of 3
    client.credentials(HTTP_X_AGENT_KEY=api_key)
    req_payload = {
        "recipient": recipient_address,
        "amount": "10.0000000",
        "asset": "XLM",
    }
    submit_resp = client.post("/api/v1/agent/requests/", req_payload, format="json")
    assert submit_resp.status_code == 201
    req_data = submit_resp.json()
    assert req_data["required_weight"] == 3
    assert req_data["collected_weight"] == 1
    assert req_data["status"] == "PENDING_APPROVAL"
    assert len(req_data["operator_signatures"]) == 1
    assert req_data["operator_signatures"][0]["role"] == "AGENT_PDA"

    # 2. Admin Wallet signs -> Signer 2 of 3 (collected weight = 2)
    op_client = APIClient()
    sign1_resp = op_client.post(
        f"/api/v1/coordinator/requests/{req_data['id']}/sign/",
        {
            "operator_address": controlled_wallet.address,
            "signature": "admin_freighter_sig",
            "weight": 1,
            "notes": "Admin Wallet Signature",
        },
        format="json",
    )
    assert sign1_resp.status_code == 200
    assert sign1_resp.json()["collected_weight"] == 2
    assert sign1_resp.json()["status"] == "PENDING_APPROVAL"  # Still needs 1 more signature!

    # 3. Extra Wallet signs -> Signer 3 of 3 (collected weight = 3) -> Threshold met!
    sign2_resp = op_client.post(
        f"/api/v1/coordinator/requests/{req_data['id']}/sign/",
        {
            "operator_address": extra_wallet,
            "signature": "extra_wallet_sig",
            "weight": 1,
            "notes": "Second Delegated Signer",
        },
        format="json",
    )
    assert sign2_resp.status_code == 200
    assert sign2_resp.json()["collected_weight"] == 3
    assert sign2_resp.json()["status"] == "APPROVED"
    assert len(sign2_resp.json()["operator_signatures"]) == 3


