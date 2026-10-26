from django.db import models
from apps.core.models import BaseModel


class Operator(BaseModel):
    """
    Operator managing GuardRail controlled wallets, policies, and AI agents.
    Authenticated via Stellar wallet ed25519 cryptographic signature.
    """

    address = models.CharField(max_length=56, unique=True, db_index=True)
    alias = models.CharField(max_length=100, blank=True, default="")
    is_verified = models.BooleanField(default=False)
    current_nonce = models.CharField(max_length=64, blank=True, default="")
    nonce_created_at = models.DateTimeField(null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Operator({self.address[:8]}...{self.address[-4:]})"
