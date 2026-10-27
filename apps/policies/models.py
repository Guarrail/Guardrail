from decimal import Decimal
from django.db import models
from apps.core.models import BaseModel
from apps.wallets.models import ControlledWallet
from apps.core.utils import get_current_utc_date_str, get_current_utc_iso_week_str


class Policy(BaseModel):
    """
    Financial policy governing transactions initiated by AI agents.
    Enforces transaction limits, daily/weekly budgets, allowlists, and human approval gates.
    """

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    version = models.PositiveIntegerField(default=1)

    # Spending limits in standard units (e.g. XLM)
    max_amount_per_tx = models.DecimalField(
        max_digits=20,
        decimal_places=7,
        default=Decimal("25.0000000"),
        help_text="Maximum allowed amount per single transaction.",
    )
    daily_spending_limit = models.DecimalField(
        max_digits=20,
        decimal_places=7,
        default=Decimal("100.0000000"),
        help_text="Maximum cumulative spending permitted per UTC calendar day.",
    )
    weekly_spending_limit = models.DecimalField(
        max_digits=20,
        decimal_places=7,
        default=Decimal("500.0000000"),
        help_text="Maximum cumulative spending permitted per UTC calendar week.",
    )

    # Human oversight thresholds
    human_approval_threshold = models.DecimalField(
        max_digits=20,
        decimal_places=7,
        default=Decimal("15.0000000"),
        help_text="Transactions strictly exceeding this amount require explicit human operator approval.",
    )
    require_human_approval_always = models.BooleanField(
        default=False,
        help_text="If True, all transactions require human approval regardless of amount.",
    )

    is_active = models.BooleanField(default=True)

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.max_amount_per_tx <= 0 or self.daily_spending_limit <= 0 or self.weekly_spending_limit <= 0:
            raise ValidationError("Spending limits must be positive amounts.")
        if self.max_amount_per_tx > self.daily_spending_limit:
            raise ValidationError("Max amount per transaction cannot exceed daily spending limit.")
        if self.daily_spending_limit > self.weekly_spending_limit:
            raise ValidationError("Daily spending limit cannot exceed weekly spending limit.")

    def __str__(self):
        return f"Policy({self.name} v{self.version})"


class AllowedRecipient(BaseModel):
    """Approved destination address for an active policy."""

    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name="allowed_recipients")
    address = models.CharField(max_length=56, db_index=True)
    label = models.CharField(max_length=150, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("policy", "address")

    def __str__(self):
        return f"AllowedRecipient({self.label or self.address[:8]})"


class BlockedRecipient(BaseModel):
    """Prohibited/blacklisted destination address for an active policy."""

    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name="blocked_recipients")
    address = models.CharField(max_length=56, db_index=True)
    label = models.CharField(max_length=150, blank=True, default="")
    reason = models.CharField(max_length=255, blank=True, default="Blacklisted address")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("policy", "address")

    def __str__(self):
        return f"BlockedRecipient({self.label or self.address[:8]})"


class AllowedAsset(BaseModel):
    """Permitted asset for an active policy."""

    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name="allowed_assets")
    asset_code = models.CharField(max_length=12, default="XLM")
    issuer_address = models.CharField(max_length=56, blank=True, null=True, default=None)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("policy", "asset_code", "issuer_address")

    def __str__(self):
        return f"AllowedAsset({self.asset_code}{':' + self.issuer_address[:6] if self.issuer_address else ''})"


class SpendingLedger(BaseModel):
    """
    Deterministic ledger tracking spent and reserved budget within active UTC windows.
    Protected with row-level database locking during concurrent transaction evaluations.
    """

    wallet = models.ForeignKey(ControlledWallet, on_delete=models.CASCADE, related_name="spending_ledgers")
    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name="spending_ledgers")

    # Daily window (UTC YYYY-MM-DD)
    daily_date = models.CharField(max_length=10, default=get_current_utc_date_str, db_index=True)
    spent_daily = models.DecimalField(max_digits=20, decimal_places=7, default=Decimal("0.0000000"))
    reserved_daily = models.DecimalField(max_digits=20, decimal_places=7, default=Decimal("0.0000000"))

    # Weekly window (UTC YYYY-Www)
    weekly_iso_week = models.CharField(max_length=8, default=get_current_utc_iso_week_str, db_index=True)
    spent_weekly = models.DecimalField(max_digits=20, decimal_places=7, default=Decimal("0.0000000"))
    reserved_weekly = models.DecimalField(max_digits=20, decimal_places=7, default=Decimal("0.0000000"))

    class Meta:
        unique_together = ("wallet", "policy")

    def sync_windows(self):
        """Resets counters when UTC calendar boundaries advance."""
        current_date = get_current_utc_date_str()
        current_week = get_current_utc_iso_week_str()

        if self.daily_date != current_date:
            self.daily_date = current_date
            self.spent_daily = Decimal("0.0000000")
            self.reserved_daily = Decimal("0.0000000")

        if self.weekly_iso_week != current_week:
            self.weekly_iso_week = current_week
            self.spent_weekly = Decimal("0.0000000")
            self.reserved_weekly = Decimal("0.0000000")

    @property
    def total_committed_daily(self) -> Decimal:
        return self.spent_daily + self.reserved_daily

    @property
    def total_committed_weekly(self) -> Decimal:
        return self.spent_weekly + self.reserved_weekly

    def __str__(self):
        return f"Ledger(Wallet={self.wallet_id}, Policy={self.policy_id}, DailySpent={self.spent_daily})"
