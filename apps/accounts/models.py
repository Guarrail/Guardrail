from django.db import models
from apps.core.models import BaseModel
from apps.core.utils import get_utc_now


class Operator(BaseModel):
    """
    Operator managing GuardRail controlled wallets, policies, and AI agents.
    Authenticated via Stellar wallet ed25519 cryptographic signature.
    """

    ROLE_CHOICES = [
        ("ADMIN", "Admin"),
        ("POLICY_ADMIN", "Policy Admin"),
        ("SIGNER_ADMIN", "Signer Admin"),
        ("OPERATOR", "Operator"),
        ("AUDITOR", "Auditor"),
        ("VIEWER", "Viewer"),
    ]

    address = models.CharField(max_length=56, unique=True, db_index=True)
    alias = models.CharField(max_length=100, blank=True, default="")
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default="ADMIN")
    is_verified = models.BooleanField(default=False)
    current_nonce = models.CharField(max_length=64, blank=True, default="")
    nonce_created_at = models.DateTimeField(null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)

    @property
    def effective_role(self) -> str:
        """Returns the elevated role if an active approved privilege escalation exists, else base role."""
        now = get_utc_now()
        active_escalation = (
            self.escalation_requests.filter(
                status="APPROVED",
                expires_at__gt=now,
            )
            .order_by("-expires_at")
            .first()
        )
        if active_escalation:
            return active_escalation.requested_role
        return self.role

    def __str__(self):
        return f"Operator({self.alias or self.address[:8]} [{self.role}])"


class PrivilegeEscalationRequest(BaseModel):
    """
    Temporary privilege elevation request for shared account multi-operator governance.
    Enforces dual-control authorization: approval requires a distinct administrator.
    """

    STATUS_CHOICES = [
        ("PENDING", "Pending Approval"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("EXPIRED", "Expired"),
        ("REVOKED", "Revoked"),
    ]

    operator = models.ForeignKey(Operator, on_delete=models.CASCADE, related_name="escalation_requests")
    requested_role = models.CharField(max_length=32, choices=Operator.ROLE_CHOICES)
    reason = models.TextField(help_text="Operational justification for temporary privilege elevation")
    duration_hours = models.PositiveIntegerField(default=4, help_text="Duration of elevated privileges in hours")

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING", db_index=True)
    reviewed_by = models.ForeignKey(
        Operator,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_escalations",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    review_notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active(self) -> bool:
        return self.status == "APPROVED" and bool(self.expires_at and self.expires_at > get_utc_now())

    def __str__(self):
        return f"EscalationReq({self.operator.address[:8]} -> {self.requested_role} [{self.status}])"

