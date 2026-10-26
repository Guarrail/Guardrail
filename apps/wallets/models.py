from decimal import Decimal
from django.db import models
from apps.core.models import BaseModel
from apps.core.stellar import validate_multisig_configuration
from apps.accounts.models import Operator


class ControlledWallet(BaseModel):
    """
    Dedicated Stellar Testnet wallet controlled under the GuardRail security boundary.
    Configured with multisig signing weights requiring both the Agent and GuardRail CoSigner.
    """

    NETWORK_CHOICES = [
        ("TESTNET", "Stellar Testnet"),
        ("PUBLIC", "Stellar Public"),
    ]

    address = models.CharField(max_length=56, unique=True, db_index=True)
    name = models.CharField(max_length=150, default="Primary Controlled Wallet")
    operator = models.ForeignKey(Operator, on_delete=models.CASCADE, related_name="controlled_wallets")
    delegated_operators = models.ManyToManyField(Operator, blank=True, related_name="delegated_wallets")
    network = models.CharField(max_length=10, choices=NETWORK_CHOICES, default="TESTNET")
    is_verified = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    # Multisig Signer Configuration
    master_weight = models.PositiveSmallIntegerField(default=1)
    agent_signer_address = models.CharField(max_length=56, blank=True, default="")
    agent_signer_weight = models.PositiveSmallIntegerField(default=1)
    cosigner_address = models.CharField(max_length=56, blank=True, default="")
    cosigner_weight = models.PositiveSmallIntegerField(default=1)

    # Thresholds
    threshold_low = models.PositiveSmallIntegerField(default=1)
    threshold_med = models.PositiveSmallIntegerField(default=2)  # Payments require weight 2
    threshold_high = models.PositiveSmallIntegerField(default=2)

    # Balance tracking
    balance = models.DecimalField(max_digits=20, decimal_places=7, default=Decimal("100.0000000"))
    asset_code = models.CharField(max_length=12, default="XLM")

    def check_security_compliance(self) -> tuple[bool, str]:
        """
        Validates that the multisig configuration strictly prevents independent transfers.
        """
        return validate_multisig_configuration(
            agent_weight=self.agent_signer_weight,
            cosigner_weight=self.cosigner_weight,
            threshold_med=self.threshold_med,
        )

    def __str__(self):
        return f"ControlledWallet({self.name} - {self.address[:8]}...{self.address[-4:]})"
