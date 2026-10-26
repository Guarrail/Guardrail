import hashlib
import logging
from decimal import Decimal
from django.conf import settings
from apps.core.utils import get_utc_now

logger = logging.getLogger(__name__)


class SorobanGuardrailClient:
    """
    Python client and simulation harness for the Soroban GuardrailContract.
    Translates off-chain permits into Soroban contract invocations.
    """

    def __init__(self, contract_address: str = "CDEMOGUARDRAILCONTRACTTESTNET1234567890ABCDEFGH"):
        self.contract_address = contract_address

    def simulate_permit_execution(
        self,
        permit_id_hex: str,
        token_address: str,
        recipient_address: str,
        amount_stroops: int,
        expires_at_timestamp: int,
        agent_address: str,
        cosigner_address: str,
    ) -> dict:
        """
        Simulates on-chain permit execution against Soroban state and rules.
        """
        now = int(get_utc_now().timestamp())
        if now > expires_at_timestamp:
            return {
                "success": False,
                "error_code": 6,
                "error": "PermitExpired: Current ledger timestamp exceeds permit expiration.",
            }

        if amount_stroops <= 0:
            return {
                "success": False,
                "error_code": 12,
                "error": "InvalidAmount: Stroop transfer amount must be greater than zero.",
            }

        # Simulated on-chain verification
        simulated_tx_hash = hashlib.sha256(
            f"{permit_id_hex}_{recipient_address}_{amount_stroops}_{now}".encode()
        ).hexdigest()

        return {
            "success": True,
            "contract_address": self.contract_address,
            "simulated_tx_hash": simulated_tx_hash,
            "events_emitted": [
                {
                    "topic": "permit_exec",
                    "permit_id": permit_id_hex,
                    "recipient": recipient_address,
                    "amount_stroops": amount_stroops,
                }
            ],
            "timestamp": now,
        }
