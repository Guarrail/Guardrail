import logging
from decimal import Decimal
from django.conf import settings
from stellar_sdk import Keypair, Network, TransactionBuilder, Account, Asset
from stellar_sdk.exceptions import BadRequestError, BaseHorizonError

logger = logging.getLogger(__name__)


def is_valid_stellar_address(address: str) -> bool:
    """Validates if a string is a valid Stellar public key (starts with 'G')."""
    if not address or not isinstance(address, str) or len(address) != 56 or not address.startswith("G"):
        return False
    try:
        Keypair.from_public_key(address)
        return True
    except Exception:
        return False


def is_valid_stellar_secret(secret: str) -> bool:
    """Validates if a string is a valid Stellar secret seed (starts with 'S')."""
    if not secret or not isinstance(secret, str) or len(secret) != 56 or not secret.startswith("S"):
        return False
    try:
        Keypair.from_secret(secret)
        return True
    except Exception:
        return False


def generate_new_stellar_keypair() -> tuple[str, str]:
    """Generates a fresh Stellar keypair (public_key, secret_seed)."""
    kp = Keypair.random()
    return kp.public_key, kp.secret


def get_cosigner_keypair() -> Keypair:
    """
    Retrieves the backend GuardRail co-signer keypair configured in settings.
    Generates a deterministic or fallback keypair if not configured.
    """
    secret = getattr(settings, "GUARDRAIL_COSIGNER_SECRET_KEY", None)
    if secret and is_valid_stellar_secret(secret):
        return Keypair.from_secret(secret)

    # Deterministic testnet co-signer fallback for dev / testing
    fallback_seed = "SBGUARDRAILCOSIGNERTESTNETSECRETKEYDEMO1234567890ABCDEF"
    try:
        return Keypair.from_secret(fallback_seed)
    except Exception:
        # Fallback to fresh random keypair if dummy string is not valid Base32 checksum
        return Keypair.random()


def get_network_passphrase() -> str:
    """Returns the Stellar network passphrase (defaults to Testnet)."""
    return getattr(settings, "STELLAR_NETWORK_PASSPHRASE", Network.TESTNET_NETWORK_PASSPHRASE)


def build_payment_transaction(
    source_address: str,
    sequence_number: int,
    recipient_address: str,
    amount: Decimal,
    asset_code: str = "XLM",
    asset_issuer: str | None = None,
    base_fee: int = 100,
) -> TransactionBuilder:
    """
    Builds a Stellar Payment transaction builder with exact payload parameters.
    """
    network_passphrase = get_network_passphrase()
    source_account = Account(account_id=source_address, sequence=sequence_number)

    if asset_code == "XLM" or not asset_issuer:
        stellar_asset = Asset.native()
    else:
        stellar_asset = Asset(code=asset_code, issuer=asset_issuer)

    tb = (
        TransactionBuilder(
            source_account=source_account,
            network_passphrase=network_passphrase,
            base_fee=base_fee,
        )
        .append_payment_op(
            destination=recipient_address,
            asset=stellar_asset,
            amount=str(amount),
        )
        .set_timeout(300)
    )
    return tb


def validate_multisig_configuration(
    agent_weight: int,
    cosigner_weight: int,
    threshold_med: int,
) -> tuple[bool, str]:
    """
    Enforces the GuardRail security boundary:
    1. Agent weight (1) alone CANNOT meet threshold_med (2) -> agent cannot move funds independently!
    2. GuardRail CoSigner weight (1) alone CANNOT meet threshold_med (2) -> operator/agent check needed.
    3. Combined Agent + CoSigner weight (1 + 1 = 2) meets threshold_med (2) for payment operations.
    """
    if agent_weight >= threshold_med:
        return False, "Agent signing weight is sufficient to bypass GuardRail policy controls independently."

    if cosigner_weight >= threshold_med:
        return False, "Co-signer weight alone can authorize transactions without agent trigger."

    if (agent_weight + cosigner_weight) < threshold_med:
        return False, "Combined agent and co-signer weights are insufficient to satisfy medium transaction threshold."

    return True, "Multisig signing structure complies with GuardRail security specifications."
