import pytest
from decimal import Decimal
from apps.accounts.models import Operator
from apps.wallets.models import ControlledWallet
from apps.policies.models import Policy, AllowedRecipient, AllowedAsset
from apps.agents.models import AIAgent
from apps.core.utils import generate_secure_api_key
from apps.core.stellar import get_cosigner_keypair

# Valid Base32 Stellar addresses with cryptographic checksums
TEST_OPERATOR_ADDRESS = "GB4KGM6UEOARGKYWQLRJQOZXBKBCOLBUGXIGQLTM7YCMGTSFL5UGKKPX"
TEST_WALLET_ADDRESS = "GBVYF7JVPDVWOHV6V334O3DUK2NO76F4ML23BNYPQ4BXDGN7ZCVGEW7K"
TEST_AGENT_SIGNER_ADDRESS = "GCUKGQL43TGXLMV3F2N5JFN7PKUAUXON6VWVIPE6375OJ7VYYKUG7U2G"
TEST_RECIPIENT_ADDRESS = "GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE"
TEST_UNAPPROVED_RECIPIENT_ADDRESS = "GD22E23DFN5JI53B4FKHA3DZVUYUNCON35MDOD7IMWDOJERDP2ZIU5EH"


@pytest.fixture
def operator_address():
    return TEST_OPERATOR_ADDRESS


@pytest.fixture
def recipient_address():
    return TEST_RECIPIENT_ADDRESS


@pytest.fixture
def unapproved_recipient_address():
    return TEST_UNAPPROVED_RECIPIENT_ADDRESS


@pytest.fixture
def operator(db):
    return Operator.objects.create(
        address=TEST_OPERATOR_ADDRESS,
        alias="Primary Treasury Operator",
        is_verified=True,
    )


@pytest.fixture
def controlled_wallet(db, operator):
    return ControlledWallet.objects.create(
        address=TEST_WALLET_ADDRESS,
        name="Controlled Agent Treasury",
        operator=operator,
        balance=Decimal("500.0000000"),
        asset_code="XLM",
        agent_signer_address=TEST_AGENT_SIGNER_ADDRESS,
        agent_signer_weight=1,
        cosigner_address=get_cosigner_keypair().public_key,
        cosigner_weight=1,
        threshold_low=1,
        threshold_med=2,
        threshold_high=2,
        is_verified=True,
        is_active=True,
    )


@pytest.fixture
def policy(db):
    pol = Policy.objects.create(
        name="Standard Agent Policy",
        version=1,
        max_amount_per_tx=Decimal("25.0000000"),
        daily_spending_limit=Decimal("100.0000000"),
        weekly_spending_limit=Decimal("400.0000000"),
        human_approval_threshold=Decimal("15.0000000"),
        require_human_approval_always=False,
        is_active=True,
    )
    # Add default allowed recipient and native asset
    AllowedRecipient.objects.create(
        policy=pol,
        address=TEST_RECIPIENT_ADDRESS,
        label="Approved Vendor A",
        is_active=True,
    )
    AllowedAsset.objects.create(
        policy=pol,
        asset_code="XLM",
        issuer_address=None,
        is_active=True,
    )
    return pol


@pytest.fixture
def ai_agent(db, controlled_wallet, policy):
    full_key, prefix, key_hash = generate_secure_api_key()
    agent = AIAgent.objects.create(
        agent_id="agent_001",
        name="Autonomous Payment Agent Alpha",
        wallet=controlled_wallet,
        policy=policy,
        api_key_prefix=prefix,
        api_key_hash=key_hash,
        status="ACTIVE",
    )
    agent.raw_api_key = full_key  # Attach in memory for testing
    return agent
