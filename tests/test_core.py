from decimal import Decimal
from apps.core.utils import (
    generate_secure_api_key,
    verify_api_key,
    hash_canonical_payload,
    quantize_amount,
    get_current_utc_date_str,
    get_current_utc_iso_week_str,
)
from apps.core.stellar import (
    is_valid_stellar_address,
    is_valid_stellar_secret,
    validate_multisig_configuration,
    generate_new_stellar_keypair,
)


def test_api_key_generation_and_constant_time_verification():
    full_key, prefix, key_hash = generate_secure_api_key(prefix="gr_test_")
    assert full_key.startswith("gr_test_")
    assert prefix == full_key[:12]
    assert len(key_hash) == 64  # SHA-256 hex string

    # Verification must succeed for exact key
    assert verify_api_key(full_key, key_hash) is True

    # Verification must fail for altered or malicious key
    assert verify_api_key(full_key + "tamper", key_hash) is False
    assert verify_api_key("gr_test_fake", key_hash) is False


def test_canonical_payload_hashing_is_deterministic():
    payload_a = {
        "amount": "25.0000000",
        "recipient": "GDAPPROVEDRECIPIENTTESTNETADDRESS1234567890ABCDEFGH1234",
        "wallet": "GCALLCONTROLLEDWALLETTESTNETADDRESS1234567890ABCDEF1234",
        "asset": "XLM",
    }
    # Same payload with different dictionary key order
    payload_b = {
        "asset": "XLM",
        "wallet": "GCALLCONTROLLEDWALLETTESTNETADDRESS1234567890ABCDEF1234",
        "recipient": "GDAPPROVEDRECIPIENTTESTNETADDRESS1234567890ABCDEFGH1234",
        "amount": "25.0000000",
    }

    hash_a = hash_canonical_payload(payload_a)
    hash_b = hash_canonical_payload(payload_b)

    assert hash_a == hash_b
    assert len(hash_a) == 64

    # Tampering with any value changes the hash
    payload_c = dict(payload_a, amount="25.0000001")
    assert hash_canonical_payload(payload_c) != hash_a


def test_quantize_amount_stroop_precision():
    amount = quantize_amount("12.3456789123")
    assert amount == Decimal("12.3456789")

    amount_zero = quantize_amount(0)
    assert amount_zero == Decimal("0.0000000")


def test_utc_window_string_formats():
    date_str = get_current_utc_date_str()
    assert len(date_str) == 10
    assert date_str.count("-") == 2

    week_str = get_current_utc_iso_week_str()
    assert "-W" in week_str


def test_stellar_keypair_and_address_validation():
    pub, sec = generate_new_stellar_keypair()
    assert is_valid_stellar_address(pub) is True
    assert is_valid_stellar_secret(sec) is True

    assert is_valid_stellar_address("NOT_A_VALID_ADDRESS") is False
    assert is_valid_stellar_address("SBGUARDRAILCOSIGNERTESTNETSECRETKEYDEMO1234567890ABCDEF") is False
    assert is_valid_stellar_secret("GBGUARDRAILCOSIGNERTESTNETPUBKEYDEMO1234567890ABCDEFGH") is False


def test_multisig_security_model_boundary():
    # 1. Compliant configuration: Agent=1, CoSigner=1, Threshold=2
    # Combined weight = 2 satisfies threshold_med (2), but neither can sign alone
    compliant, msg = validate_multisig_configuration(agent_weight=1, cosigner_weight=1, threshold_med=2)
    assert compliant is True

    # 2. Insecure: Agent weight alone satisfies threshold (can move funds independently)
    insecure_agent, _ = validate_multisig_configuration(agent_weight=2, cosigner_weight=1, threshold_med=2)
    assert insecure_agent is False

    # 3. Insecure: Co-signer alone satisfies threshold
    insecure_cosigner, _ = validate_multisig_configuration(agent_weight=1, cosigner_weight=2, threshold_med=2)
    assert insecure_cosigner is False

    # 4. Insecure: Weights cannot satisfy threshold
    insufficient, _ = validate_multisig_configuration(agent_weight=1, cosigner_weight=0, threshold_med=2)
    assert insufficient is False
