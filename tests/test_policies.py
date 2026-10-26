import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from apps.policies.models import Policy, SpendingLedger


@pytest.mark.django_db
def test_policy_validation_rules():
    # max amount cannot exceed daily limit
    invalid_policy = Policy(
        name="Invalid Policy",
        max_amount_per_tx=Decimal("150.0000000"),
        daily_spending_limit=Decimal("100.0000000"),
        weekly_spending_limit=Decimal("500.0000000"),
    )
    with pytest.raises(ValidationError):
        invalid_policy.clean()

    # daily limit cannot exceed weekly limit
    invalid_weekly = Policy(
        name="Invalid Weekly",
        max_amount_per_tx=Decimal("50.0000000"),
        daily_spending_limit=Decimal("600.0000000"),
        weekly_spending_limit=Decimal("500.0000000"),
    )
    with pytest.raises(ValidationError):
        invalid_weekly.clean()


@pytest.mark.django_db
def test_spending_ledger_window_sync(controlled_wallet, policy):
    ledger = SpendingLedger.objects.create(
        wallet=controlled_wallet,
        policy=policy,
        daily_date="2020-01-01",  # Past date
        spent_daily=Decimal("50.0000000"),
        reserved_daily=Decimal("10.0000000"),
    )

    ledger.sync_windows()
    # Daily counters must reset to 0 for a new date
    assert ledger.spent_daily == Decimal("0.0000000")
    assert ledger.reserved_daily == Decimal("0.0000000")
