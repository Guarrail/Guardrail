from decimal import Decimal
from django.db import models
from apps.core.models import BaseModel
from apps.wallets.models import ControlledWallet
from apps.agents.models import AIAgent
from apps.policies.models import Policy
from apps.core.utils import get_utc_now


class TransactionRequest(BaseModel):
    """
    Payment proposal submitted by an AI Agent.
    Evaluated by GuardRail policy engine before any signing or execution.
    """

    STATUS_CHOICES = [
        ("PENDING_EVALUATION", "Pending Evaluation"),
        ("BLOCKED", "Blocked by Policy"),
        ("PENDING_APPROVAL", "Pending Operator Approval"),
        ("APPROVED", "Approved for Co-Signing"),
        ("REJECTED", "Rejected by Operator"),
        ("CO_SIGNED", "Co-Signed by GuardRail"),
        ("EXECUTED", "Executed on Stellar"),
        ("FAILED", "Execution Failed"),
    ]

    request_id = models.CharField(max_length=100, unique=True, db_index=True, help_text="Unique idempotency key from agent")
    agent = models.ForeignKey(AIAgent, on_delete=models.PROTECT, related_name="requests")
    wallet = models.ForeignKey(ControlledWallet, on_delete=models.PROTECT, related_name="requests")

    recipient = models.CharField(max_length=56, db_index=True)
    asset_code = models.CharField(max_length=12, default="XLM")
    asset_issuer = models.CharField(max_length=56, blank=True, null=True, default=None)
    amount = models.DecimalField(max_digits=20, decimal_places=7)

    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="PENDING_EVALUATION", db_index=True)
    requires_human_approval = models.BooleanField(default=False)
    policy_evaluation_results = models.JSONField(default=dict, blank=True)

    stellar_envelope_xdr = models.TextField(blank=True, default="")
    stellar_tx_hash = models.CharField(max_length=100, blank=True, default="", db_index=True)
    execution_error = models.TextField(blank=True, default="")

    operator_signatures = models.JSONField(default=list, blank=True, help_text="Signatures collected from member operators")
    collected_weight = models.PositiveSmallIntegerField(default=0, help_text="Total signing weight accumulated so far")
    required_weight = models.PositiveSmallIntegerField(default=2, help_text="Threshold weight required for execution/approval")


    class Meta:
        ordering = ["-created_at"]

    @property
    def is_eligible_for_cosign(self) -> bool:
        return self.status == "APPROVED" and hasattr(self, "permit") and not self.permit.is_single_use_consumed

    def __str__(self):
        return f"TxRequest({self.request_id} - {self.amount} {self.asset_code} -> {self.recipient[:8]} [{self.status}])"


class Permit(BaseModel):
    """
    Cryptographically bound, single-use authorization permit generated for an approved transaction.
    Linked to the exact canonical transaction payload hash.
    """

    PERMIT_STATUS_CHOICES = [
        ("PENDING_APPROVAL", "Pending Operator Approval"),
        ("APPROVED", "Approved"),
        ("USED", "Single-Use Consumed"),
        ("REJECTED", "Rejected"),
        ("EXPIRED", "Expired"),
        ("CANCELLED", "Cancelled"),
    ]

    request = models.OneToOneField(TransactionRequest, on_delete=models.CASCADE, related_name="permit")
    agent = models.ForeignKey(AIAgent, on_delete=models.PROTECT, related_name="permits")
    wallet = models.ForeignKey(ControlledWallet, on_delete=models.PROTECT, related_name="permits")

    recipient = models.CharField(max_length=56)
    asset_code = models.CharField(max_length=12, default="XLM")
    asset_issuer = models.CharField(max_length=56, blank=True, null=True, default=None)
    amount = models.DecimalField(max_digits=20, decimal_places=7)

    payload_hash = models.CharField(max_length=64, db_index=True, help_text="SHA-256 hash of canonical tx payload")
    policy_version = models.PositiveIntegerField(default=1)

    status = models.CharField(max_length=24, choices=PERMIT_STATUS_CHOICES, default="PENDING_APPROVAL", db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    is_single_use_consumed = models.BooleanField(default=False, db_index=True)

    approved_by = models.CharField(max_length=100, blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_valid(self) -> bool:
        return (
            not self.is_single_use_consumed
            and self.status == "APPROVED"
            and self.expires_at > get_utc_now()
        )

    def __str__(self):
        return f"Permit({self.id} for req={self.request.request_id} [{self.status}])"
