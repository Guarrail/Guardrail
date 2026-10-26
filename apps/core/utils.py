import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP


def generate_secure_api_key(prefix: str = "gr_live_") -> tuple[str, str, str]:
    """
    Generates an API key for AI agent authentication.
    Returns:
        (full_key, key_prefix, key_hash)
    The full_key is displayed to the operator only once.
    The database only stores key_prefix and key_hash.
    """
    random_bytes = secrets.token_hex(24)
    full_key = f"{prefix}{random_bytes}"
    key_prefix = full_key[:12]
    key_hash = hash_api_key(full_key)
    return full_key, key_prefix, key_hash


def hash_api_key(key: str) -> str:
    """Computes a SHA-256 hash of the API key."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def verify_api_key(key: str, expected_hash: str) -> bool:
    """Constant-time comparison of hashed API key."""
    computed_hash = hash_api_key(key)
    return hmac.compare_digest(computed_hash, expected_hash)


def hash_canonical_payload(data: dict) -> str:
    """
    Computes a deterministic SHA-256 hash of a transaction payload.
    Keys are sorted and values serialized to strict strings.
    """
    canonical_json = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def quantize_amount(amount: Decimal | str | float) -> Decimal:
    """
    Ensures safe, deterministic 7-decimal-place Stellar stroop precision.
    Avoids floating-point discrepancies.
    """
    dec_val = Decimal(str(amount))
    return dec_val.quantize(Decimal("0.0000001"), rounding=ROUND_HALF_UP)


def get_utc_now() -> datetime:
    """Returns the current UTC datetime."""
    return datetime.now(timezone.utc)


def get_current_utc_date_str() -> str:
    """Returns YYYY-MM-DD for the current UTC date window."""
    return get_utc_now().strftime("%Y-%m-%d")


def get_current_utc_iso_week_str() -> str:
    """Returns YYYY-WW for the current UTC week window."""
    now = get_utc_now()
    year, week, _ = now.isocalendar()
    return f"{year}-W{week:02d}"
