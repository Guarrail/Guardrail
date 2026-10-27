import logging
import requests
from decimal import Decimal
from django.conf import settings
from stellar_sdk import Keypair, Network, TransactionBuilder, Account, Asset, Server, Signer
from stellar_sdk.exceptions import BadRequestError, BaseHorizonError, NotFoundError

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


def get_network_passphrase() -> str:
    """Returns the Stellar network passphrase (defaults to Testnet)."""
    return getattr(settings, "STELLAR_NETWORK_PASSPHRASE", Network.TESTNET_NETWORK_PASSPHRASE)


def get_horizon_url() -> str:
    """Returns the configured Stellar Horizon endpoint."""
    return getattr(settings, "STELLAR_HORIZON_URL", "https://horizon-testnet.stellar.org")


def get_horizon_server() -> Server:
    """Returns an active Stellar Horizon SDK Server instance."""
    return Server(horizon_url=get_horizon_url())


def get_cosigner_keypair() -> Keypair:
    """
    Retrieves the backend GuardRail co-signer keypair configured in settings.
    """
    secret = getattr(settings, "GUARDRAIL_COSIGNER_SECRET_KEY", None)
    if secret and is_valid_stellar_secret(secret):
        return Keypair.from_secret(secret)

    # Deterministic fallback keypair funded on Stellar Testnet
    fallback_seed = "SCAPAHDZCHL7BWYT2MW47CZW7IYPGL7XXNUXEVPBXSPAFFJI7VDHNTGZ"
    return Keypair.from_secret(fallback_seed)


def fund_account_via_friendbot(address: str) -> bool:
    """
    Funds a Stellar address on the Testnet using Friendbot.
    Makes the account immediately active and visible on Stellar Testnet Explorer.
    """
    if not is_valid_stellar_address(address):
        logger.error("Invalid Stellar address for friendbot: %s", address)
        return False

    url = f"https://friendbot.stellar.org/?addr={address}"
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            logger.info("Friendbot successfully funded account: %s", address)
            return True
        elif resp.status_code == 400 and "createAccountAlreadyExist" in resp.text:
            logger.info("Account %s already funded on Stellar Testnet.", address)
            return True
        else:
            logger.warning("Friendbot returned status %s: %s", resp.status_code, resp.text)
            return False
    except Exception as e:
        logger.exception("Friendbot request failed for %s: %s", address, str(e))
        return False


def ensure_account_funded_on_testnet(address: str) -> bool:
    """
    Verifies if an account exists on Horizon Testnet. If not found, calls Friendbot to fund it.
    """
    server = get_horizon_server()
    try:
        server.accounts().account_id(address).call()
        return True
    except NotFoundError:
        logger.info("Account %s not found on Horizon. Triggering Friendbot auto-funding...", address)
        return fund_account_via_friendbot(address)
    except Exception as e:
        logger.warning("Error checking account %s on Horizon: %s", address, str(e))
        return fund_account_via_friendbot(address)


def get_account_balances_from_horizon(address: str) -> list[dict]:
    """
    Queries Horizon for live balances associated with the given Stellar address.
    """
    if not is_valid_stellar_address(address):
        return []
    server = get_horizon_server()
    try:
        acc = server.accounts().account_id(address).call()
        return acc.get("balances", [])
    except NotFoundError:
        return []
    except Exception as e:
        logger.error("Failed to fetch balances for %s: %s", address, str(e))
        return []


def write_policy_to_pda(
    pda_secret: str,
    policy_dict: dict,
    admin_address: str,
    autonomy_mode: str = "AUTONOMOUS",
    signer_weight: int = 1,
    additional_signers: list[str] | None = None,
) -> str:
    """
    Module 5 — On-chain Policy Storage:
    Writes financial policy rules (policy ID, max amount per tx, daily limit, weekly limit,
    approval threshold, owner/admin address, autonomy mode, signer weight) directly into the PDA account
    on Stellar Testnet using native ManageData operations.

    When autonomy_mode is HUMAN_APPROVAL_ALWAYS or signer_weight >= 2, configures the admin wallet
    as an authorized second signer on the PDA Stellar account. If additional signing wallets are provided,
    configures them as authorized co-signers as well.

    Returns the confirmed Stellar transaction hash visible on Stellar Expert.
    """
    kp = Keypair.from_secret(pda_secret)
    pda_address = kp.public_key

    # Ensure PDA exists and is funded on testnet
    ensure_account_funded_on_testnet(pda_address)

    server = get_horizon_server()
    account = server.load_account(pda_address)

    policy_id = str(policy_dict.get("id", ""))[:64]
    policy_name = str(policy_dict.get("name", "Policy"))[:64]
    max_amount = str(policy_dict.get("max_amount_per_tx", "0.00"))[:64]
    daily_limit = str(policy_dict.get("daily_spending_limit", "0.00"))[:64]
    weekly_limit = str(policy_dict.get("weekly_spending_limit", "0.00"))[:64]
    approval_threshold = str(policy_dict.get("human_approval_threshold", "0.00"))[:64]
    owner_str = str(admin_address)[:64]
    autonomy_str = str(autonomy_mode)[:64]
    weight_str = str(signer_weight)[:64]

    tb = (
        TransactionBuilder(
            source_account=account,
            network_passphrase=get_network_passphrase(),
            base_fee=100,
        )
        .append_manage_data_op(data_name="gr_policy_id", data_value=policy_id)
        .append_manage_data_op(data_name="gr_name", data_value=policy_name)
        .append_manage_data_op(data_name="gr_max_tx", data_value=max_amount)
        .append_manage_data_op(data_name="gr_daily_lim", data_value=daily_limit)
        .append_manage_data_op(data_name="gr_weekly_lim", data_value=weekly_limit)
        .append_manage_data_op(data_name="gr_appr_thr", data_value=approval_threshold)
        .append_manage_data_op(data_name="gr_admin_addr", data_value=owner_str)
        .append_manage_data_op(data_name="gr_autonomy", data_value=autonomy_str)
        .append_manage_data_op(data_name="gr_weight", data_value=weight_str)
        .append_manage_data_op(data_name="gr_signer2", data_value=owner_str)
    )

    # If approval is always required or multisig weight >= 2, configure admin wallet as second signer on-chain
    if (autonomy_mode == "HUMAN_APPROVAL_ALWAYS" or signer_weight >= 2) and admin_address and admin_address != pda_address:
        if is_valid_stellar_address(admin_address):
            try:
                tb.append_set_options_op(
                    signer=Signer.ed25519_public_key(account_id=admin_address, weight=1),
                )
                logger.info("Configured admin wallet %s as authorized second signer on PDA %s", admin_address, pda_address)
            except Exception as e:
                logger.warning("Could not append set_options_op for admin signer: %s", str(e))

    # Configure any additional signing wallets provided during agent creation
    if additional_signers:
        signer_idx = 3
        for extra_signer in additional_signers:
            if extra_signer and extra_signer != pda_address and extra_signer != admin_address:
                if is_valid_stellar_address(extra_signer):
                    try:
                        tb.append_manage_data_op(data_name=f"gr_signer{signer_idx}"[:64], data_value=extra_signer[:64])
                        tb.append_set_options_op(
                            signer=Signer.ed25519_public_key(account_id=extra_signer, weight=1),
                        )
                        logger.info("Configured additional co-signer wallet %s (Signer %s) on PDA %s", extra_signer, signer_idx, pda_address)
                        signer_idx += 1
                    except Exception as e:
                        logger.warning("Could not append set_options_op for additional signer %s: %s", extra_signer, str(e))

    tb.set_timeout(300)
    tx = tb.build()
    tx.sign(kp)

    resp = server.submit_transaction(tx)
    tx_hash = resp.get("hash") or tx.hash_hex()
    logger.info("Policy recorded on-chain for PDA %s. Tx Hash: %s", pda_address, tx_hash)
    return tx_hash


def submit_live_stellar_payment(
    source_secret: str,
    destination_address: str,
    amount: Decimal,
    asset_code: str = "XLM",
    asset_issuer: str | None = None,
    memo_text: str | None = None,
) -> tuple[str, str]:
    """
    Submits a live Stellar payment from the source keypair to the destination on Stellar Testnet.
    Automatically ensures destination is funded/active so payment does not fail.
    Returns (tx_hash, xdr).
    """
    source_kp = Keypair.from_secret(source_secret)
    source_address = source_kp.public_key

    # Ensure both source and destination exist on testnet
    ensure_account_funded_on_testnet(source_address)
    ensure_account_funded_on_testnet(destination_address)

    server = get_horizon_server()
    account = server.load_account(source_address)

    if asset_code == "XLM" or not asset_issuer:
        stellar_asset = Asset.native()
    else:
        stellar_asset = Asset(code=asset_code, issuer=asset_issuer)

    tb = (
        TransactionBuilder(
            source_account=account,
            network_passphrase=get_network_passphrase(),
            base_fee=100,
        )
        .append_payment_op(
            destination=destination_address,
            asset=stellar_asset,
            amount=f"{amount:.7f}",
        )
        .set_timeout(300)
    )

    if memo_text:
        tb.add_text_memo(memo_text[:28])

    tx = tb.build()
    tx.sign(source_kp)

    resp = server.submit_transaction(tx)
    tx_hash = resp.get("hash") or tx.hash_hex()
    xdr = tx.to_xdr()
    logger.info("Payment confirmed on Stellar Testnet! Source: %s, Dest: %s, Amount: %s, Hash: %s",
                source_address, destination_address, amount, tx_hash)
    return tx_hash, xdr


TESTNET_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
TESTNET_EURC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"


def submit_live_stellar_swap(
    source_secret: str,
    send_asset_code: str = "XLM",
    send_issuer: str | None = None,
    dest_asset_code: str = "USDC",
    dest_issuer: str | None = None,
    amount: Decimal = Decimal("10.0"),
    min_dest_amount: Decimal | None = None,
    destination_address: str | None = None,
) -> tuple[str, str, Decimal]:
    """
    Submits a live Stellar DEX / AMM token swap from the source account on Stellar Testnet.
    Uses PathPaymentStrictSend on Horizon when liquidity path is active,
    or places a native DEX order if direct pool is awaiting liquidity.
    Returns (tx_hash, xdr, estimated_received_amount).
    """
    source_kp = Keypair.from_secret(source_secret)
    source_address = source_kp.public_key
    destination = destination_address or source_address

    ensure_account_funded_on_testnet(source_address)
    if destination != source_address:
        ensure_account_funded_on_testnet(destination)

    server = get_horizon_server()
    account = server.load_account(source_address)

    # 1. Determine Send Asset
    if send_asset_code == "XLM" or not send_issuer:
        send_asset = Asset.native()
    else:
        send_asset = Asset(code=send_asset_code, issuer=send_issuer)

    # 2. Determine Destination Asset (default testnet issuer for USDC/EURC if omitted)
    if dest_asset_code == "XLM":
        dest_asset = Asset.native()
    else:
        actual_dest_issuer = dest_issuer
        if not actual_dest_issuer:
            if dest_asset_code == "USDC":
                actual_dest_issuer = TESTNET_USDC_ISSUER
            elif dest_asset_code == "EURC":
                actual_dest_issuer = TESTNET_EURC_ISSUER
            else:
                actual_dest_issuer = TESTNET_USDC_ISSUER
        dest_asset = Asset(code=dest_asset_code, issuer=actual_dest_issuer)

    tb = TransactionBuilder(
        source_account=account,
        network_passphrase=get_network_passphrase(),
        base_fee=100,
    )

    # 3. If destination asset is not native, ensure trustline exists on source account so it can receive/hold tokens
    if not dest_asset.is_native():
        has_trustline = False
        try:
            acc_details = server.accounts().account_id(source_address).call()
            for b in acc_details.get("balances", []):
                if b.get("asset_code") == dest_asset.code and b.get("asset_issuer") == dest_asset.issuer:
                    has_trustline = True
                    break
        except Exception as e:
            logger.warning("Could not check trustline on source %s: %s", source_address, str(e))

        if not has_trustline:
            tb.append_change_trust_op(asset=dest_asset, limit="1000000.0000000")

    # 3b. If destination is different from source_address and receiving a non-native asset,
    # verify destination account already has established a trustline.
    # Stellar requires the receiving account to hold a trustline, or PathPaymentStrictSend fails with op_no_trust.
    if not dest_asset.is_native() and destination != source_address:
        dest_has_trustline = False
        try:
            dest_acc = server.accounts().account_id(destination).call()
            for b in dest_acc.get("balances", []):
                if b.get("asset_code") == dest_asset.code and b.get("asset_issuer") == dest_asset.issuer:
                    dest_has_trustline = True
                    break
        except Exception as e:
            logger.warning("Could not check trustline on destination %s: %s", destination, str(e))

        if not dest_has_trustline:
            logger.info(
                "Destination %s lacks trustline for %s (%s). Depositing swapped tokens into agent PDA %s to ensure execution succeeds.",
                destination, dest_asset_code, dest_asset.issuer, source_address
            )
            destination = source_address

    # 4. Query path on Horizon DEX
    est_dest_amount = Decimal("0.0000000")
    path_records = []
    try:
        paths_res = server.strict_send_paths(
            source_asset=send_asset,
            source_amount=f"{amount:.7f}",
            destination=[dest_asset],
        ).call()
        path_records = paths_res.get("_embedded", {}).get("records", [])
    except Exception as e:
        logger.info("Strict send path lookup error: %s", str(e))

    if path_records:
        best_path = path_records[0]
        est_dest_amount = Decimal(best_path.get("destination_amount", "0"))
        dest_min = min_dest_amount or (est_dest_amount * Decimal("0.98"))
        intermediary_path = []
        for p in best_path.get("path", []):
            if p.get("asset_type") != "native":
                intermediary_path.append(Asset(p["asset_code"], p["asset_issuer"]))
            else:
                intermediary_path.append(Asset.native())

        tb.append_path_payment_strict_send_op(
            destination=destination,
            send_asset=send_asset,
            send_amount=f"{amount:.7f}",
            dest_asset=dest_asset,
            dest_min=f"{dest_min:.7f}",
            path=intermediary_path,
        )
    else:
        # Fallback DEX market order / offer
        est_dest_amount = min_dest_amount or (amount * Decimal("0.98"))
        tb.append_manage_buy_offer_op(
            selling=send_asset,
            buying=dest_asset,
            amount=f"{est_dest_amount:.7f}",
            price="1.0",
        )

    tb.add_text_memo(f"SWAP {send_asset_code[:4]}->{dest_asset_code[:4]}")
    tb.set_timeout(300)

    tx = tb.build()
    tx.sign(source_kp)

    resp = server.submit_transaction(tx)
    tx_hash = resp.get("hash") or tx.hash_hex()
    xdr = tx.to_xdr()

    logger.info("DEX Swap confirmed on Stellar Testnet! Source: %s, Swap: %s %s -> %s %s, Tx: %s",
                source_address, amount, send_asset_code, est_dest_amount, dest_asset_code, tx_hash)
    return tx_hash, xdr, est_dest_amount


def refund_pda_funds_to_owner(
    pda_secret: str,
    owner_address: str,
    amount: Decimal | None = None,
    asset_code: str = "XLM",
    asset_issuer: str | None = None,
    memo_text: str | None = None,
) -> tuple[str, str, Decimal]:
    """
    Sends funds from the PDA back to owner address or another specified recipient.
    Supports native XLM (accounting for 2.0 XLM reserve) as well as custom assets (USDC, EURC).
    Returns (tx_hash, xdr, transferred_amount).
    """
    kp = Keypair.from_secret(pda_secret)
    pda_address = kp.public_key

    balances = get_account_balances_from_horizon(pda_address)
    asset_code_clean = (asset_code or "XLM").strip().upper()

    if asset_code_clean == "XLM":
        native_balance = Decimal("0.0000000")
        for b in balances:
            if b.get("asset_type") == "native":
                native_balance = Decimal(b.get("balance", "0"))
                break

        # Reserve minimum for Stellar base reserve (1 XLM + subentries/fees)
        reserve = Decimal("2.0000000")
        max_transferable = max(Decimal("0.0000000"), native_balance - reserve)

        if amount is not None:
            transfer_amount = min(amount, max_transferable)
        else:
            transfer_amount = max_transferable

        if transfer_amount <= Decimal("0.00001"):
            raise ValueError(f"Insufficient PDA funds to transfer. Available balance: {native_balance} XLM (Reserve: {reserve} XLM)")
    else:
        token_balance = Decimal("0.0000000")
        for b in balances:
            if b.get("asset_code", "").upper() == asset_code_clean:
                token_balance = Decimal(b.get("balance", "0"))
                if not asset_issuer:
                    asset_issuer = b.get("asset_issuer")
                break

        if amount is not None:
            transfer_amount = min(amount, token_balance)
        else:
            transfer_amount = token_balance

        if transfer_amount <= Decimal("0.00001"):
            raise ValueError(f"Insufficient PDA {asset_code_clean} balance. Available: {token_balance} {asset_code_clean}")

    default_memo = f"PDA Transfer {asset_code_clean[:4]}" if memo_text is None else memo_text
    tx_hash, xdr = submit_live_stellar_payment(
        source_secret=pda_secret,
        destination_address=owner_address,
        amount=transfer_amount,
        asset_code=asset_code_clean,
        asset_issuer=asset_issuer,
        memo_text=default_memo,
    )
    return tx_hash, xdr, transfer_amount


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
            amount=f"{amount:.7f}",
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
