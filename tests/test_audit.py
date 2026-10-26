import pytest
from apps.audit.models import AuditLog, record_audit_event


@pytest.mark.django_db
def test_record_audit_event_and_explorer_url():
    log = record_audit_event(
        event_type="TX_CONFIRMED",
        actor_id="agent_001",
        actor_type="AI_AGENT",
        request_id="req_audit_01",
        permit_id="permit_audit_01",
        stellar_tx_hash="112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
        details={"amount": "10.0000000", "asset": "XLM"},
    )

    assert log.event_type == "TX_CONFIRMED"
    assert log.actor_id == "agent_001"
    assert "https://stellar.expert/explorer/testnet/tx/" in log.stellar_explorer_url
    assert log.details["amount"] == "10.0000000"
