import pytest
from decimal import Decimal
from apps.coordinator.services import evaluate_and_create_request
from tests.conftest import TEST_RECIPIENT_ADDRESS, TEST_UNAPPROVED_RECIPIENT_ADDRESS


@pytest.mark.django_db
def test_valid_request_below_approval_threshold_auto_approved(ai_agent):
    # Policy has max 25 XLM, human approval threshold 15 XLM
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_test_001",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )

    assert req.status == "APPROVED"
    assert req.requires_human_approval is False
    assert permit is not None
    assert permit.status == "APPROVED"
    assert permit.amount == Decimal("10.0000000")
    assert permit.is_single_use_consumed is False


@pytest.mark.django_db
def test_valid_request_above_approval_threshold_requires_human_review(ai_agent):
    # Amount 20 XLM is <= max 25 XLM, but > 15 XLM human threshold
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_test_002",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("20.0000000"),
        asset_code="XLM",
    )

    assert req.status == "PENDING_APPROVAL"
    assert req.requires_human_approval is True
    assert permit is not None
    assert permit.status == "PENDING_APPROVAL"


@pytest.mark.django_db
def test_rule_1_amount_exceeding_max_per_tx_blocked(ai_agent):
    # Max per tx is 25 XLM; request 30 XLM must be blocked
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_test_003",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("30.0000000"),
        asset_code="XLM",
    )

    assert req.status == "BLOCKED"
    assert permit is None
    checklist = req.policy_evaluation_results.get("checklist", {})
    assert checklist.get("amount_within_limit") is False


@pytest.mark.django_db
def test_rule_2_daily_spending_budget_enforced(ai_agent):
    # Policy daily limit is 100 XLM, max single is 25 XLM
    # Submit 4 requests of 25 XLM = 100 XLM
    for i in range(4):
        req, permit = evaluate_and_create_request(
            agent=ai_agent,
            request_id=f"req_budget_day_{i}",
            recipient=TEST_RECIPIENT_ADDRESS,
            amount=Decimal("25.0000000"),
            asset_code="XLM",
        )
        assert req.status in ("APPROVED", "PENDING_APPROVAL")

    # 5th request of even 1 XLM must exceed daily budget
    req_overflow, permit_overflow = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_budget_day_overflow",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("1.0000000"),
        asset_code="XLM",
    )

    assert req_overflow.status == "BLOCKED"
    assert permit_overflow is None
    checklist = req_overflow.policy_evaluation_results.get("checklist", {})
    assert checklist.get("daily_budget_available") is False


@pytest.mark.django_db
def test_rule_3_unauthorized_recipient_blocked(ai_agent):
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_unauthorized_rec",
        recipient=TEST_UNAPPROVED_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )

    assert req.status == "BLOCKED"
    assert permit is None
    checklist = req.policy_evaluation_results.get("checklist", {})
    assert checklist.get("recipient_approved") is False


@pytest.mark.django_db
def test_rule_4_unauthorized_asset_blocked(ai_agent):
    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_unauthorized_asset",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="RESTRICTED_TOKEN",
    )

    assert req.status == "BLOCKED"
    assert permit is None
    checklist = req.policy_evaluation_results.get("checklist", {})
    assert checklist.get("asset_permitted") is False


@pytest.mark.django_db
def test_emergency_disabled_agent_blocked(ai_agent):
    ai_agent.emergency_disable()
    assert ai_agent.status == "DISABLED"

    req, permit = evaluate_and_create_request(
        agent=ai_agent,
        request_id="req_disabled_agent",
        recipient=TEST_RECIPIENT_ADDRESS,
        amount=Decimal("10.0000000"),
        asset_code="XLM",
    )

    assert req.status == "BLOCKED"
    assert permit is None
