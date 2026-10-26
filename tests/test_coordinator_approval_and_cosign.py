import pytest
from datetime import timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError
from apps.core.utils import get_utc_now
from apps.coordinator.services import (
    evaluate_and_create_request,
    operator_approve_request,
    operator_reject_request,
    cosign_and_execute_request,
)
from apps.policies.models import SpendingLedger
from tests.conftest import TEST_RECIPIENT_ADDRESS


@pytest.mark.django_db
def test_operator_approval_workflow(ai_agent, operator):
    # Create request requiring approval (> 15 XLM threshold)
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_approval_test",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("20.0000000"),
        asset_code="XLM",
    )
    assert req.status == "PENDING_APPROVAL"

    # Operator approves
    updated_req = operator_approve_request(
        request_id=req.request_id,
        operator_address=operator.address,
        notes="Approved for vendor invoice payment",
    )

    assert updated_req.status == "APPROVED"
    assert updated_req.permit.status == "APPROVED"
    assert updated_req.permit.approved_by == operator.address


@pytest.mark.django_db
def test_operator_rejection_releases_reserved_budget(ai_agent, operator):
    ledger = SpendingLedger.objects.create(wallet=ai_agent.wallet, policy=ai_agent.policy)

    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_reject_test",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("20.0000000"),
        asset_code="XLM",
    )
    assert req.status == "PENDING_APPROVAL"

    ledger.refresh_from_db()
    assert ledger.reserved_daily == Decimal("20.0000000")

    # Operator rejects
    rejected_req = operator_reject_request(
        request_id=req.request_id,
        operator_address=operator.address,
        reason="Suspicious high amount for this agent",
    )

    assert rejected_req.status == "REJECTED"
    assert rejected_req.permit.status == "REJECTED"

    # Verify reserved budget was released back
    ledger.refresh_from_db()
    assert ledger.reserved_daily == Decimal("0.0000000")


@pytest.mark.django_db
def test_cosign_and_execute_success(ai_agent):
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_cosign_test",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )
    assert req.status == "APPROVED"

    executed_req = cosign_and_execute_request(request_id=req.request_id, mock_stellar=True)

    assert executed_req.status == "EXECUTED"
    assert executed_req.stellar_tx_hash != ""
    assert executed_req.permit.is_single_use_consumed is True
    assert executed_req.permit.status == "USED"


@pytest.mark.django_db
def test_replay_attack_prevention_single_use_permit(ai_agent):
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_replay_test",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )
    # First execution succeeds
    cosign_and_execute_request(request_id=req.request_id, mock_stellar=True)

    # Attempting to re-execute the same consumed request must raise ValidationError
    with pytest.raises(ValidationError):
        cosign_and_execute_request(request_id=req.request_id, mock_stellar=True)


@pytest.mark.django_db
def test_expired_permit_cannot_be_executed(ai_agent):
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_expired_test",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )
    # Manually expire permit
    permit.expires_at = get_utc_now() - timedelta(minutes=5)
    permit.save(update_fields=["expires_at"])

    with pytest.raises(ValidationError):
        cosign_and_execute_request(request_id=req.request_id, mock_stellar=True)


@pytest.mark.django_db
def test_tampered_payload_hash_mismatch_stops_execution(ai_agent):
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_tamper_test",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )

    # Malicious actor tampers with amount after permit was generated
    req.amount = Decimal("25.0000000")
    req.save(update_fields=["amount"])

    with pytest.raises(ValidationError, match="payload hash"):
        cosign_and_execute_request(request_id=req.request_id, mock_stellar=True)


@pytest.mark.django_db
def test_idempotent_request_handling(ai_agent):
    req1, permit1 = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_idempotent_001",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )

    # Duplicate submission with identical request_id
    req2, permit2 = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_idempotent_001",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )

    assert req1.id == req2.id
    assert permit1.id == permit2.id

    # Budget should only have been reserved ONCE
    ledger = SpendingLedger.objects.get(wallet=ai_agent.wallet, policy=ai_agent.policy)
    assert ledger.reserved_daily == Decimal("10.0000000")


@pytest.mark.django_db
def test_conflicting_request_id_raises_validation_error(ai_agent):
    req1, permit1 = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_conflict_001",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("5.0000000"),
        asset_code="XLM",
    )

    # Reusing same request_id with different amount (e.g. 10.0 instead of 5.0) must raise ValidationError
    with pytest.raises(ValidationError, match="Conflict: request_id"):
        evaluate_and_create_request(
            agent=ai_agent,
            request_id="req_conflict_001",
            recipient=TEST_RECIPIENT_ADDRESS,
            amount=Decimal("10.0000000"),
            asset_code="XLM",
        )


@pytest.mark.django_db
def test_omitted_request_id_auto_generates_unique_id(ai_agent):
    req1, permit1 = evaluate_and_create_request(
        agent=ai_agent,
        request_id=None,
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("2.0000000"),
        asset_code="XLM",
    )
    assert req1.request_id.startswith("req_")

    req2, permit2 = evaluate_and_create_request(
        agent=ai_agent,
        request_id="",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("2.0000000"),
        asset_code="XLM",
    )
    assert req2.request_id.startswith("req_")
    assert req1.request_id != req2.request_id


@pytest.mark.django_db
def test_agent_swap_execution_and_policy(client, ai_agent):
    from apps.policies.models import AllowedAsset
    AllowedAsset.objects.create(
        policy=ai_agent.policy,
        asset_code="USDC",
        is_active=True,
    )
    swap_payload = {
        "send_asset": "XLM",
        "dest_asset": "USDC",
        "amount": "5.0",
        "auto_execute": True,
        "mock_stellar": True,
    }
    response = client.post(
        "/api/v1/agent/swap/",
        data=swap_payload,
        content_type="application/json",
        HTTP_X_AGENT_KEY=ai_agent.raw_api_key,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "EXECUTED"
    assert data["asset_code"] == "XLM->USDC"
    assert data["amount"] == "5.0000000"
    assert data["stellar_tx_hash"] != ""
