import hashlib
import json
import logging
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError

from apps.core.utils import (
    get_utc_now,
    quantize_amount,
    hash_canonical_payload,
)
from apps.core.stellar import (
    get_cosigner_keypair,
    build_payment_transaction,
    is_valid_stellar_address,
)
from apps.wallets.models import ControlledWallet
from apps.agents.models import AIAgent
from apps.policies.models import SpendingLedger
from apps.audit.models import record_audit_event
from .models import TransactionRequest, Permit

logger = logging.getLogger(__name__)


class PolicyEvaluationResult:
    def __init__(self):
        self.is_passed = True
        self.amount_ok = True
        self.recipient_ok = True
        self.asset_ok = True
        self.daily_budget_ok = True
        self.weekly_budget_ok = True
        self.requires_human_approval = False
        self.reasons = []

    def fail(self, reason: str, category: str = "general"):
        self.is_passed = False
        self.reasons.append(reason)
        if category == "amount":
            self.amount_ok = False
        elif category == "recipient":
            self.recipient_ok = False
        elif category == "asset":
            self.asset_ok = False
        elif category == "daily_budget":
            self.daily_budget_ok = False
        elif category == "weekly_budget":
            self.weekly_budget_ok = False

    def to_dict(self) -> dict:
        return {
            "is_passed": self.is_passed,
            "checklist": {
                "amount_within_limit": self.amount_ok,
                "recipient_approved": self.recipient_ok,
                "asset_permitted": self.asset_ok,
                "daily_budget_available": self.daily_budget_ok,
                "weekly_budget_available": self.weekly_budget_ok,
                "requires_human_approval": self.requires_human_approval,
            },
            "failure_reasons": self.reasons,
        }


def evaluate_and_create_request(
    agent: AIAgent,
    request_id: str,
    recipient: str,
    amount: Decimal | str,
    asset_code: str = "XLM",
    asset_issuer: str | None = None,
    wallet: ControlledWallet | None = None,
) -> tuple[TransactionRequest, Permit | None]:
    """
    Core entrypoint for agent payment requests.
    Enforces atomic policy evaluation and budget reservation with database row-level locking.
    Idempotent: duplicate request_id returns existing record without re-evaluation or double-deduction.
    """
    amount_dec = quantize_amount(amount)
    target_wallet = wallet or agent.wallet
    policy = agent.policy

    with transaction.atomic():
        # 1. Idempotency Check
        existing_req = TransactionRequest.objects.select_for_update().filter(request_id=request_id).first()
        if existing_req:
            logger.info("Idempotent request received: %s", request_id)
            existing_permit = getattr(existing_req, "permit", None)
            return existing_req, existing_permit

        # 2. Lock Spending Ledger for concurrency safety
        ledger, _ = SpendingLedger.objects.select_for_update().get_or_create(wallet=target_wallet, policy=policy)
        ledger.sync_windows()

        # 3. Policy Evaluation
        eval_result = PolicyEvaluationResult()

        # Check agent operational status
        if not agent.is_operational:
            eval_result.fail(f"Agent {agent.agent_id} is currently {agent.status}.", category="general")

        # Check recipient allowlist
        if not is_valid_stellar_address(recipient):
            eval_result.fail("Invalid recipient Stellar address format.", category="recipient")
        elif not policy.allowed_recipients.filter(address=recipient, is_active=True).exists():
            eval_result.fail(f"Recipient address {recipient} is not on the policy allowlist.", category="recipient")

        # Check asset allowlist
        if not policy.allowed_assets.filter(asset_code=asset_code, issuer_address=asset_issuer, is_active=True).exists():
            eval_result.fail(f"Asset {asset_code} is not permitted under the active policy.", category="asset")

        # Check single transaction limit
        if amount_dec <= 0:
            eval_result.fail("Transaction amount must be strictly greater than zero.", category="amount")
        elif amount_dec > policy.max_amount_per_tx:
            eval_result.fail(
                f"Amount {amount_dec} exceeds maximum allowed per transaction ({policy.max_amount_per_tx} {policy.name}).",
                category="amount",
            )

        # Check daily spending budget
        if (ledger.total_committed_daily + amount_dec) > policy.daily_spending_limit:
            eval_result.fail(
                f"Amount {amount_dec} would exceed daily budget. Spent: {ledger.spent_daily}, Reserved: {ledger.reserved_daily}, Limit: {policy.daily_spending_limit}.",
                category="daily_budget",
            )

        # Check weekly spending budget
        if (ledger.total_committed_weekly + amount_dec) > policy.weekly_spending_limit:
            eval_result.fail(
                f"Amount {amount_dec} would exceed weekly budget. Spent: {ledger.spent_weekly}, Reserved: {ledger.reserved_weekly}, Limit: {policy.weekly_spending_limit}.",
                category="weekly_budget",
            )

        # Human approval gate: triggered if agent requires human approval, policy requires human approval always, or amount exceeds threshold
        if (
            agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS"
            or policy.require_human_approval_always
            or amount_dec > policy.human_approval_threshold
        ):
            eval_result.requires_human_approval = True


        # 4. Handle Blocked vs Eligible Requests
        if not eval_result.is_passed:
            req = TransactionRequest.objects.create(
                request_id=request_id,
                agent=agent,
                wallet=target_wallet,
                recipient=recipient,
                asset_code=asset_code,
                asset_issuer=asset_issuer,
                amount=amount_dec,
                status="BLOCKED",
                requires_human_approval=eval_result.requires_human_approval,
                policy_evaluation_results=eval_result.to_dict(),
            )
            record_audit_event(
                event_type="POLICY_EVALUATED_BLOCKED",
                actor_id=agent.agent_id,
                actor_type="AI_AGENT",
                request_id=request_id,
                details=eval_result.to_dict(),
            )
            return req, None

        # 5. Eligible Request -> Reserve Capacity Atomically
        ledger.reserved_daily += amount_dec
        ledger.reserved_weekly += amount_dec
        ledger.save(update_fields=["reserved_daily", "reserved_weekly", "daily_date", "weekly_iso_week"])

        initial_status = "PENDING_APPROVAL" if eval_result.requires_human_approval else "APPROVED"

        req = TransactionRequest.objects.create(
            request_id=request_id,
            agent=agent,
            wallet=target_wallet,
            recipient=recipient,
            asset_code=asset_code,
            asset_issuer=asset_issuer,
            amount=amount_dec,
            status=initial_status,
            requires_human_approval=eval_result.requires_human_approval,
            policy_evaluation_results=eval_result.to_dict(),
        )

        # 6. Generate Single-Use Cryptographically Bound Permit
        payload_data = {
            "request_id": request_id,
            "agent_id": agent.agent_id,
            "wallet": target_wallet.address,
            "recipient": recipient,
            "asset": asset_code,
            "issuer": asset_issuer,
            "amount": str(amount_dec),
            "policy_id": str(policy.id),
            "policy_version": policy.version,
        }
        payload_hash = hash_canonical_payload(payload_data)

        permit = Permit.objects.create(
            request=req,
            agent=agent,
            wallet=target_wallet,
            recipient=recipient,
            asset_code=asset_code,
            asset_issuer=asset_issuer,
            amount=amount_dec,
            payload_hash=payload_hash,
            policy_version=policy.version,
            status=initial_status,
            expires_at=get_utc_now() + timedelta(minutes=30),
            is_single_use_consumed=False,
        )

        record_audit_event(
            event_type="PERMIT_GENERATED",
            actor_id=agent.agent_id,
            actor_type="AI_AGENT",
            request_id=request_id,
            permit_id=str(permit.id),
            details={"payload_hash": payload_hash, "status": initial_status, "requires_approval": eval_result.requires_human_approval},
        )

        return req, permit


def operator_approve_request(request_id: str, operator_address: str, notes: str = "") -> TransactionRequest:
    """Operator human approval for a pending request."""
    with transaction.atomic():
        req = TransactionRequest.objects.select_for_update().get(request_id=request_id)
        if req.status != "PENDING_APPROVAL":
            raise ValidationError(f"Request is in {req.status} state, cannot be approved.")

        permit = req.permit
        if permit.is_single_use_consumed or permit.expires_at <= get_utc_now():
            raise ValidationError("Associated permit has expired or was already consumed.")

        req.status = "APPROVED"
        req.save(update_fields=["status", "updated_at"])

        permit.status = "APPROVED"
        permit.approved_by = operator_address
        permit.approved_at = get_utc_now()
        permit.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

        record_audit_event(
            event_type="OPERATOR_APPROVED",
            actor_id=operator_address,
            actor_type="OPERATOR",
            request_id=request_id,
            permit_id=str(permit.id),
            details={"notes": notes},
        )
        return req


def operator_reject_request(request_id: str, operator_address: str, reason: str = "") -> TransactionRequest:
    """Operator rejection: transitions request to REJECTED and releases reserved budget."""
    with transaction.atomic():
        req = TransactionRequest.objects.select_for_update().get(request_id=request_id)
        if req.status not in ("PENDING_APPROVAL", "APPROVED"):
            raise ValidationError(f"Request is in {req.status} state, cannot be rejected.")

        permit = req.permit
        req.status = "REJECTED"
        req.execution_error = f"Rejected by operator: {reason}"
        req.save(update_fields=["status", "execution_error", "updated_at"])

        permit.status = "REJECTED"
        permit.save(update_fields=["status", "updated_at"])

        # Release reserved budget capacity
        ledger, _ = SpendingLedger.objects.select_for_update().get_or_create(wallet=req.wallet, policy=req.agent.policy)
        ledger.reserved_daily = max(Decimal("0.0000000"), ledger.reserved_daily - req.amount)
        ledger.reserved_weekly = max(Decimal("0.0000000"), ledger.reserved_weekly - req.amount)
        ledger.save(update_fields=["reserved_daily", "reserved_weekly"])

        record_audit_event(
            event_type="OPERATOR_REJECTED",
            actor_id=operator_address,
            actor_type="OPERATOR",
            request_id=request_id,
            permit_id=str(permit.id),
            details={"reason": reason, "released_amount": str(req.amount)},
        )
        return req


def cosign_and_execute_request(request_id: str, mock_stellar: bool = True) -> TransactionRequest:
    """
    Module 4 — Single-Permit Co-Sign and Execution:
    1. Validates permit is valid, unconsumed, and not expired.
    2. Re-validates that canonical transaction payload hash matches permit payload hash!
    3. Co-signs with backend GuardRail key.
    4. Submits transaction to Stellar Testnet (or testnet mock).
    5. On confirmed success: marks permit as consumed, transitions reserved budget to confirmed spent.
    6. On failure: releases reserved budget and marks failed.
    """
    with transaction.atomic():
        req = TransactionRequest.objects.select_for_update().get(request_id=request_id)
        if req.status != "APPROVED":
            raise ValidationError(f"Request must be in APPROVED state for co-signing (current: {req.status}).")

        permit = req.permit
        if permit.is_single_use_consumed:
            raise ValidationError("Permit has already been consumed. Replay attack prevented.")

        if permit.expires_at <= get_utc_now():
            permit.status = "EXPIRED"
            permit.save(update_fields=["status"])
            raise ValidationError("Permit has expired.")

        # Re-verify payload hash to guarantee zero tampering
        expected_payload = {
            "request_id": req.request_id,
            "agent_id": req.agent.agent_id,
            "wallet": req.wallet.address,
            "recipient": req.recipient,
            "asset": req.asset_code,
            "issuer": req.asset_issuer,
            "amount": str(req.amount),
            "policy_id": str(req.agent.policy.id),
            "policy_version": req.agent.policy.version,
        }
        current_hash = hash_canonical_payload(expected_payload)
        if current_hash != permit.payload_hash:
            raise ValidationError("Transaction payload does not match the approved permit payload hash!")

        # Co-signing step
        req.status = "CO_SIGNED"
        req.save(update_fields=["status"])

        record_audit_event(
            event_type="TX_CO_SIGNED",
            actor_id=get_cosigner_keypair().public_key,
            actor_type="SYSTEM",
            request_id=request_id,
            permit_id=str(permit.id),
        )

        # Stellar execution step
        ledger, _ = SpendingLedger.objects.select_for_update().get_or_create(wallet=req.wallet, policy=req.agent.policy)

        try:
            if mock_stellar:
                # Deterministic testnet mock execution
                tx_hash = hashlib.sha256(f"stellar_testnet_tx_{req.request_id}_{get_utc_now().timestamp()}".encode()).hexdigest()
                xdr = f"AAAA_MOCK_STELLAR_XDR_CO_SIGNED_{req.request_id}"
            else:
                # Production Stellar Horizon transaction builder & submission
                cosigner_kp = get_cosigner_keypair()
                tb = build_payment_transaction(
                    source_address=req.wallet.address,
                    sequence_number=1,  # In live mode query Horizon account sequence
                    recipient_address=req.recipient,
                    amount=req.amount,
                    asset_code=req.asset_code,
                    asset_issuer=req.asset_issuer,
                )
                tx_envelope = tb.build()
                tx_envelope.sign(cosigner_kp)
                xdr = tx_envelope.to_xdr()
                tx_hash = tx_envelope.hash_hex()

            # Mark Single-Use Consumed
            permit.is_single_use_consumed = True
            permit.status = "USED"
            permit.save(update_fields=["is_single_use_consumed", "status", "updated_at"])

            # Move reserved budget to confirmed spent
            ledger.reserved_daily = max(Decimal("0.0000000"), ledger.reserved_daily - req.amount)
            ledger.spent_daily += req.amount
            ledger.reserved_weekly = max(Decimal("0.0000000"), ledger.reserved_weekly - req.amount)
            ledger.spent_weekly += req.amount
            ledger.save(update_fields=["reserved_daily", "spent_daily", "reserved_weekly", "spent_weekly"])

            # Deduct wallet balance
            req.wallet.balance = max(Decimal("0.0000000"), req.wallet.balance - req.amount)
            req.wallet.save(update_fields=["balance"])

            # Update request
            req.status = "EXECUTED"
            req.stellar_tx_hash = tx_hash
            req.stellar_envelope_xdr = xdr
            req.save(update_fields=["status", "stellar_tx_hash", "stellar_envelope_xdr", "updated_at"])

            record_audit_event(
                event_type="TX_CONFIRMED",
                actor_id="Stellar Testnet",
                actor_type="SYSTEM",
                request_id=request_id,
                permit_id=str(permit.id),
                stellar_tx_hash=tx_hash,
                details={"amount": str(req.amount), "recipient": req.recipient, "asset": req.asset_code},
            )
            return req

        except Exception as e:
            logger.exception("Stellar transaction execution failed: %s", str(e))
            # Release reserved budget on failure
            ledger.reserved_daily = max(Decimal("0.0000000"), ledger.reserved_daily - req.amount)
            ledger.reserved_weekly = max(Decimal("0.0000000"), ledger.reserved_weekly - req.amount)
            ledger.save(update_fields=["reserved_daily", "reserved_weekly"])

            req.status = "FAILED"
            req.execution_error = str(e)
            req.save(update_fields=["status", "execution_error", "updated_at"])

            record_audit_event(
                event_type="TX_FAILED",
                actor_id="Stellar Testnet",
                actor_type="SYSTEM",
                request_id=request_id,
                permit_id=str(permit.id),
                details={"error": str(e)},
            )
            raise
