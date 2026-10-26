from django.db import models
from apps.core.models import BaseModel
from apps.wallets.models import ControlledWallet
from apps.policies.models import Policy
from apps.core.utils import get_utc_now


class AIAgent(BaseModel):
    """
    Registered AI Agent permitted to submit payment requests under GuardRail supervision.
    API keys are hashed with SHA-256 before storage; raw secrets are never persisted.
    """

    AUTONOMY_CHOICES = [
        ("AUTONOMOUS", "Autonomous (Auto-sign within policy)"),
        ("HUMAN_APPROVAL_ALWAYS", "Human Approval Required (Always require operator co-sign)"),
    ]

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("INACTIVE", "Inactive"),
        ("DISABLED", "Emergency Disabled"),
        ("REVOKED", "Credentials Revoked"),
    ]

    agent_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")

    wallet = models.ForeignKey(ControlledWallet, on_delete=models.PROTECT, related_name="agents")
    policy = models.ForeignKey(Policy, on_delete=models.PROTECT, related_name="agents")

    stellar_public_key = models.CharField(max_length=56, blank=True, default="", help_text="Agent PDA / Stellar public key")
    stellar_secret_key = models.CharField(max_length=64, blank=True, default="", help_text="Agent PDA private signing key")
    pda_tx_hash = models.CharField(max_length=64, blank=True, default="", help_text="On-chain Stellar transaction hash writing policy to PDA")
    pda_funded = models.BooleanField(default=False, help_text="Whether PDA has been funded on Stellar Testnet")
    signer_weight = models.PositiveSmallIntegerField(default=1, help_text="Multisig signer weight for this agent")
    autonomy_mode = models.CharField(
        max_length=32,
        choices=AUTONOMY_CHOICES,
        default="AUTONOMOUS",
        help_text="Autonomous execution within policy vs mandatory operator co-approval",
    )
    delegated_operators = models.ManyToManyField("accounts.Operator", blank=True, related_name="delegated_agents")

    api_key = models.CharField(max_length=128, blank=True, default="", help_text="Full Agent API Key for integration")
    api_key_prefix = models.CharField(max_length=16, db_index=True)
    api_key_hash = models.CharField(max_length=64)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="ACTIVE", db_index=True)
    emergency_disabled_at = models.DateTimeField(null=True, blank=True)
    last_active_at = models.DateTimeField(null=True, blank=True)


    @property
    def is_operational(self) -> bool:
        return self.status == "ACTIVE" and self.wallet.is_active and self.policy.is_active

    def emergency_disable(self):
        """Immediately disables the agent to block all outbound co-sign requests."""
        self.status = "DISABLED"
        self.emergency_disabled_at = get_utc_now()
        self.save(update_fields=["status", "emergency_disabled_at"])

    def activate(self):
        """Re-enables the agent."""
        self.status = "ACTIVE"
        self.emergency_disabled_at = None
        self.save(update_fields=["status", "emergency_disabled_at"])

    def __str__(self):
        return f"AIAgent({self.agent_id} - {self.name} [{self.status}])"
