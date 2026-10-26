import pytest
from apps.wallets.models import ControlledWallet
from tests.conftest import TEST_WALLET_ADDRESS, TEST_AGENT_SIGNER_ADDRESS


@pytest.mark.django_db
def test_controlled_wallet_security_compliance(controlled_wallet):
    compliant, msg = controlled_wallet.check_security_compliance()
    assert compliant is True
    assert "complies with GuardRail" in msg


@pytest.mark.django_db
def test_controlled_wallet_detects_insecure_agent_bypass(controlled_wallet):
    # If agent weight is set to 2 (equal to threshold_med 2), agent can bypass GuardRail!
    controlled_wallet.agent_signer_weight = 2
    compliant, msg = controlled_wallet.check_security_compliance()
    assert compliant is False
    assert "bypass" in msg
