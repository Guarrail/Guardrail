from django.db import models
from apps.core.models import BaseModel


class AuditLog(BaseModel):
    """
    Immutable audit log for all GuardRail events: policy decisions, permits, approvals, and Stellar executions.
    """

    EVENT_TYPES = [
        ("AGENT_REQUEST_SUBMITTED", "Agent Request Submitted"),
        ("POLICY_EVALUATED_PASS", "Policy Evaluated (Passed)"),
        ("POLICY_EVALUATED_BLOCKED", "Policy Evaluated (Blocked)"),
        ("PERMIT_GENERATED", "Permit Generated"),
        ("OPERATOR_APPROVED", "Operator Approved"),
        ("OPERATOR_REJECTED", "Operator Rejected"),
        ("TX_CO_SIGNED", "Transaction Co-Signed"),
        ("TX_SUBMITTED", "Transaction Submitted to Stellar"),
        ("TX_CONFIRMED", "Transaction Confirmed On-Chain"),
        ("TX_FAILED", "Transaction Execution Failed"),
        ("AGENT_DISABLED", "Agent Emergency Disabled"),
        ("AGENT_ACTIVATED", "Agent Activated"),
        ("POLICY_UPDATED", "Policy Updated"),
    ]

    event_type = models.CharField(max_length=40, choices=EVENT_TYPES, db_index=True)
    actor_type = models.CharField(max_length=20, default="SYSTEM")  # AI_AGENT, OPERATOR, SYSTEM
    actor_id = models.CharField(max_length=100, db_index=True)

    request_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    permit_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    stellar_tx_hash = models.CharField(max_length=100, blank=True, default="", db_index=True)

    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def stellar_explorer_url(self) -> str | None:
        if self.stellar_tx_hash:
            return f"https://stellar.expert/explorer/testnet/tx/{self.stellar_tx_hash}"
        return None

    def __str__(self):
        return f"AuditLog({self.event_type} by {self.actor_id} at {self.created_at.isoformat()})"


def record_audit_event(
    event_type: str,
    actor_id: str,
    actor_type: str = "SYSTEM",
    request_id: str = "",
    permit_id: str = "",
    stellar_tx_hash: str = "",
    details: dict | None = None,
) -> AuditLog:
    """Helper to record an immutable audit entry."""
    return AuditLog.objects.create(
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        request_id=request_id,
        permit_id=permit_id,
        stellar_tx_hash=stellar_tx_hash,
        details=details or {},
    )
