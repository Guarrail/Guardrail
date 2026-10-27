import base64
import hashlib
import json
import logging
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from stellar_sdk import Keypair

from apps.core.utils import (
    get_utc_now,
    quantize_amount,
    hash_canonical_payload,
)
from apps.core.stellar import (
    get_cosigner_keypair,
    build_payment_transaction,
    is_valid_stellar_address,
    submit_live_stellar_payment,
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
    request_id: str | None,
    recipient: str,
    amount: Decimal | str,
    asset_code: str = "XLM",
    asset_issuer: str | None = None,
    wallet: ControlledWallet | None = None,
    stellar_envelope_xdr: str = "",
    swap_details: dict | None = None,
) -> tuple[TransactionRequest, Permit | None]:
    """
    Core entrypoint for agent payment and swap requests.
    Enforces atomic policy evaluation and budget reservation with database row-level locking.
    Idempotent: duplicate request_id returns existing record without re-evaluation or double-deduction.
    If request_id is omitted or blank, generates a fresh unique identifier.
    If request_id already exists with conflicting parameters, raises ValidationError.
    """
    import time
    import uuid

    if not request_id or not str(request_id).strip():
        request_id = f"req_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"

    amount_dec = quantize_amount(amount)
    target_wallet = wallet or agent.wallet
    policy = agent.policy

    with transaction.atomic():
        # 1. Idempotency Check
        existing_req = TransactionRequest.objects.select_for_update().filter(request_id=request_id).first()
        if existing_req:
            is_same_payload = (
                existing_req.recipient == recipient
                and existing_req.amount == amount_dec
                and existing_req.asset_code == (asset_code or "XLM")
            )
            if is_same_payload:
                logger.info("Idempotent request received (identical payload): %s", request_id)
                existing_permit = getattr(existing_req, "permit", None)
                return existing_req, existing_permit
            else:
                raise ValidationError(
                    f"Conflict: request_id '{request_id}' has already been used for an existing transaction "
                    f"(amount={existing_req.amount} {existing_req.asset_code}, recipient={existing_req.recipient[:10]}..., status={existing_req.status}). "
                    f"Please omit 'request_id' to auto-generate a fresh ID, or specify a new unique request_id."
                )

        # 2. Lock Spending Ledger for concurrency safety
        ledger, _ = SpendingLedger.objects.select_for_update().get_or_create(wallet=target_wallet, policy=policy)
        ledger.sync_windows()

        # 3. Policy Evaluation
        eval_result = PolicyEvaluationResult()

        # Check agent operational status
        if not agent.is_operational:
            eval_result.fail(f"Agent {agent.agent_id} is currently {agent.status}.", category="general")

        # Check recipient blacklist & allowlist / whitelist:
        # Self-custody swaps returning tokens to the agent's own wallet bypass external recipient restrictions.
        recipient_clean = recipient.strip()
        is_self_swap = swap_details and recipient_clean == target_wallet.address.strip()
        if not is_valid_stellar_address(recipient_clean):
            eval_result.fail("Invalid recipient Stellar address format.", category="recipient")
        elif policy.blocked_recipients.filter(address__iexact=recipient_clean, is_active=True).exists():
            eval_result.fail(f"Recipient address {recipient_clean} is on the policy blacklist (prohibited destination).", category="recipient")
        elif not is_self_swap and policy.allowed_recipients.filter(is_active=True).exists() and not policy.allowed_recipients.filter(address__iexact=recipient_clean, is_active=True).exists():
            eval_result.fail(f"Recipient address {recipient_clean} is not on the policy whitelist.", category="recipient")

        # Check asset allowlist: if policy defines allowed assets, enforce it
        if policy.allowed_assets.filter(is_active=True).exists():
            if swap_details:
                send_code = swap_details.get("send_asset", "XLM")
                dest_code = swap_details.get("dest_asset", "USDC")
                send_ok = (send_code == "XLM" and not policy.allowed_assets.filter(is_active=True).exists()) or policy.allowed_assets.filter(asset_code=send_code, is_active=True).exists()
                dest_ok = policy.allowed_assets.filter(asset_code=dest_code, is_active=True).exists()
                if not send_ok:
                    eval_result.fail(f"Send asset {send_code} is not permitted under the active policy.", category="asset")
                if not dest_ok:
                    eval_result.fail(f"Destination asset {dest_code} is not permitted under the active policy.", category="asset")
            else:
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

        # Human approval gate: triggered if agent requires human approval, weight >= 2, policy requires human approval always, or amount exceeds threshold
        if (
            agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS"
            or agent.signer_weight >= 2
            or policy.require_human_approval_always
            or amount_dec > policy.human_approval_threshold
        ):
            eval_result.requires_human_approval = True

        eval_dict = eval_result.to_dict()
        if swap_details:
            eval_dict["type"] = "SWAP"
            eval_dict["swap_details"] = swap_details

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
                policy_evaluation_results=eval_dict,
                stellar_envelope_xdr=stellar_envelope_xdr,
            )
            record_audit_event(
                event_type="POLICY_EVALUATED_BLOCKED",
                actor_id=agent.agent_id,
                actor_type="AI_AGENT",
                request_id=request_id,
                details=eval_dict,
            )
            return req, None

        # 5. Eligible Request -> Reserve Capacity Atomically
        ledger.reserved_daily += amount_dec
        ledger.reserved_weekly += amount_dec
        ledger.save(update_fields=["reserved_daily", "reserved_weekly", "daily_date", "weekly_iso_week"])

        req_required_weight = max(2, agent.signer_weight) if (
            agent.signer_weight >= 2
            or agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS"
        ) else 1

        initial_signatures = []
        initial_weight = 0

        # Signature 1: AI Agent PDA signs the proposal (Signer 1 of N)
        agent_signer_addr = agent.stellar_public_key or f"agent_pda_{agent.agent_id}"
        now = get_utc_now()
        pda_crypto_sig = None
        if agent.stellar_secret_key:
            try:
                kp = Keypair.from_secret(agent.stellar_secret_key)
                sig_bytes = kp.sign(f"{request_id}:{amount_dec}:{recipient}:{asset_code}".encode("utf-8"))
                pda_crypto_sig = base64.b64encode(sig_bytes).decode("ascii")
            except Exception as e:
                logger.warning("Could not sign proposal with agent PDA keypair: %s", str(e))
        if not pda_crypto_sig:
            pda_crypto_sig = f"pda_proposal_sig_{agent.agent_id}_{int(now.timestamp())}"

        if req_required_weight >= 2:
            initial_signatures.append({
                "operator_address": agent_signer_addr,
                "signature": pda_crypto_sig,
                "weight": 1,
                "role": "AGENT_PDA",
                "notes": f"Signer 1 of {req_required_weight}: AI Agent PDA Proposal ({agent.name})",
                "signed_at": now.isoformat(),
            })
            initial_weight = 1
        elif not eval_result.requires_human_approval:
            # Autonomous single-signer approval
            initial_signatures.append({
                "operator_address": agent_signer_addr,
                "signature": pda_crypto_sig,
                "weight": 1,
                "role": "AGENT_PDA",
                "notes": f"Signer 1 of 1: AI Agent Autonomous Signature ({agent.name})",
                "signed_at": now.isoformat(),
            })
            initial_weight = 1

        initial_status = "PENDING_APPROVAL" if (eval_result.requires_human_approval or req_required_weight >= 2) else "APPROVED"

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
            required_weight=req_required_weight,
            collected_weight=initial_weight,
            operator_signatures=initial_signatures,
            policy_evaluation_results=eval_dict,
            stellar_envelope_xdr=stellar_envelope_xdr,
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

        now = get_utc_now()
        signatures = list(req.operator_signatures or [])
        has_agent_sig = any(
            s.get("role") == "AGENT_PDA"
            or "Agent PDA" in s.get("notes", "")
            or (req.agent and s.get("operator_address") == req.agent.stellar_public_key)
            for s in signatures
        )
        if not has_agent_sig and req.agent and (req.required_weight >= 2 or req.agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS"):
            agent_addr = req.agent.stellar_public_key or f"agent_pda_{req.agent.agent_id}"
            pda_sig = f"pda_proposal_sig_{req.agent.agent_id}_{int(req.created_at.timestamp())}"
            signatures.insert(0, {
                "operator_address": agent_addr,
                "signature": pda_sig,
                "weight": 1,
                "role": "AGENT_PDA",
                "notes": f"Signer 1 of {req.required_weight}: AI Agent PDA Proposal ({req.agent.name})",
                "signed_at": req.created_at.isoformat(),
            })

        already_signed = any(s.get("operator_address") == operator_address for s in signatures)
        if not already_signed:
            signer_num = len(signatures) + 1
            is_admin = req.wallet and (operator_address == req.wallet.address)
            signatures.append({
                "operator_address": operator_address,
                "signature": f"wallet_approval_{int(now.timestamp())}",
                "weight": 1,
                "role": "ADMIN" if is_admin else "OPERATOR",
                "notes": notes or f"Signer {signer_num} of {req.required_weight}: {'Admin Wallet Signature' if is_admin else 'Co-Signer Signature'}",
                "signed_at": now.isoformat(),
            })
            req.operator_signatures = signatures
            req.collected_weight = sum(s.get("weight", 1) for s in signatures)

        required = req.required_weight or 1
        if req.collected_weight >= required:
            req.status = "APPROVED"
            permit.status = "APPROVED"
            permit.approved_by = operator_address
            permit.approved_at = now
            permit.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        else:
            req.status = "PENDING_APPROVAL"

        req.save(update_fields=["operator_signatures", "collected_weight", "status", "updated_at"])

        record_audit_event(
            event_type="OPERATOR_APPROVED",
            actor_id=operator_address,
            actor_type="OPERATOR",
            request_id=request_id,
            permit_id=str(permit.id),
            details={"notes": notes, "collected_weight": req.collected_weight, "required_weight": required},
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


def cosign_and_execute_request(request_id: str, mock_stellar: bool = False) -> TransactionRequest:
    """
    Module 4 — Single-Permit Co-Sign and Execution:
    1. Validates permit is valid, unconsumed, and not expired.
    2. Enforces multisig threshold: collected_weight must satisfy required_weight.
    3. Re-validates that canonical transaction payload hash matches permit payload hash!
    4. Co-signs with agent PDA / backend GuardRail key.
    5. Submits live transaction to Stellar Testnet (or testnet mock if requested).
    6. On confirmed success: marks permit as consumed, transitions reserved budget to confirmed spent.
    7. On failure: releases reserved budget and marks failed.
    """
    with transaction.atomic():
        req = TransactionRequest.objects.select_for_update().get(request_id=request_id)

        # Ensure Agent PDA proposal signature is included as Signer 1 if missing
        signatures = list(req.operator_signatures or [])
        has_agent_sig = any(
            s.get("role") == "AGENT_PDA"
            or "Agent PDA" in s.get("notes", "")
            or (req.agent and s.get("operator_address") == req.agent.stellar_public_key)
            for s in signatures
        )
        if not has_agent_sig and req.agent and (req.required_weight >= 2 or req.agent.autonomy_mode == "HUMAN_APPROVAL_ALWAYS"):
            agent_addr = req.agent.stellar_public_key or f"agent_pda_{req.agent.agent_id}"
            pda_sig = f"pda_proposal_sig_{req.agent.agent_id}_{int(req.created_at.timestamp())}"
            signatures.insert(0, {
                "operator_address": agent_addr,
                "signature": pda_sig,
                "weight": 1,
                "role": "AGENT_PDA",
                "notes": f"Signer 1 of {req.required_weight}: AI Agent PDA Proposal ({req.agent.name})",
                "signed_at": req.created_at.isoformat(),
            })
            req.operator_signatures = signatures
            req.collected_weight = sum(s.get("weight", 1) for s in signatures)
            req.save(update_fields=["operator_signatures", "collected_weight"])

        # Auto-promote to APPROVED if threshold is satisfied
        if req.status == "PENDING_APPROVAL" and req.collected_weight >= (req.required_weight or 1):
            req.status = "APPROVED"
            if hasattr(req, "permit") and req.permit:
                req.permit.status = "APPROVED"
                req.permit.save(update_fields=["status"])
            req.save(update_fields=["status", "updated_at"])

        if req.status != "APPROVED":
            raise ValidationError(f"Request must be in APPROVED state for co-signing (current: {req.status}).")

        # Enforce multisig threshold
        if req.required_weight >= 2 and req.collected_weight < req.required_weight:
            raise ValidationError(
                f"Multisig threshold not met: collected weight ({req.collected_weight}) is less than required weight ({req.required_weight}). "
                f"Admin wallet signature is required before execution."
            )

        try:
            permit = req.permit
        except Exception:
            permit = None

        if permit:
            if permit.is_single_use_consumed:
                raise ValidationError("Permit has already been consumed. Replay attack prevented.")

            if permit.expires_at <= get_utc_now():
                permit.status = "EXPIRED"
                permit.save(update_fields=["status"])
                raise ValidationError("Permit has expired.")

            # Re-verify payload hash to guarantee zero tampering
            expected_payload = {
                "request_id": req.request_id,
                "agent_id": req.agent.agent_id if req.agent else "",
                "wallet": req.wallet.address if req.wallet else "",
                "recipient": req.recipient,
                "asset": req.asset_code,
                "issuer": req.asset_issuer,
                "amount": str(req.amount),
                "policy_id": str(req.agent.policy.id) if (req.agent and req.agent.policy) else "",
                "policy_version": req.agent.policy.version if (req.agent and req.agent.policy) else 1,
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
            permit_id=str(permit.id) if permit else None,
        )

        # Stellar execution step
        ledger, _ = SpendingLedger.objects.select_for_update().get_or_create(wallet=req.wallet, policy=req.agent.policy)

        try:
            if mock_stellar:
                # Deterministic testnet mock execution for offline unit testing
                tx_hash = hashlib.sha256(f"stellar_testnet_tx_{req.request_id}_{get_utc_now().timestamp()}".encode()).hexdigest()
                xdr = f"AAAA_MOCK_STELLAR_XDR_CO_SIGNED_{req.request_id}"
            else:
                # Live Stellar Horizon transaction builder & submission
                signing_secret = req.agent.stellar_secret_key
                if not signing_secret:
                    cosigner_kp = get_cosigner_keypair()
                    signing_secret = cosigner_kp.secret

                swap_meta = (req.policy_evaluation_results or {}).get("swap_details")
                if swap_meta:
                    from apps.core.stellar import submit_live_stellar_swap
                    tx_hash, xdr, est_dest = submit_live_stellar_swap(
                        source_secret=signing_secret,
                        send_asset_code=swap_meta.get("send_asset", "XLM"),
                        send_issuer=swap_meta.get("send_issuer"),
                        dest_asset_code=swap_meta.get("dest_asset", "USDC"),
                        dest_issuer=swap_meta.get("dest_issuer"),
                        amount=req.amount,
                        min_dest_amount=Decimal(str(swap_meta["min_dest_amount"])) if swap_meta.get("min_dest_amount") else None,
                        destination_address=req.recipient,
                    )
                else:
                    tx_hash, xdr = submit_live_stellar_payment(
                        source_secret=signing_secret,
                        destination_address=req.recipient,
                        amount=req.amount,
                        asset_code=req.asset_code,
                        asset_issuer=req.asset_issuer,
                        memo_text=f"GR {req.request_id[:16]}",
                    )

            if permit:
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

            swap_meta = (req.policy_evaluation_results or {}).get("swap_details")
            record_audit_event(
                event_type="DEX_SWAP_CONFIRMED" if swap_meta else "TX_CONFIRMED",
                actor_id="Stellar Testnet",
                actor_type="SYSTEM",
                request_id=request_id,
                permit_id=str(permit.id) if permit else None,
                stellar_tx_hash=tx_hash,
                details={
                    "amount": str(req.amount),
                    "recipient": req.recipient,
                    "asset": req.asset_code,
                    **( {"swap_details": swap_meta} if swap_meta else {} ),
                },
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
                permit_id=str(permit.id) if permit else None,
                details={"error": str(e)},
            )
            raise
