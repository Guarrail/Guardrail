#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env,
};

fn setup_test_env<'a>() -> (
    Env,
    Address, // admin
    Address, // cosigner
    Address, // agent
    Address, // recipient
    Address, // token
    GuardrailContractClient<'a>,
) {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let cosigner = Address::generate(&e);
    let agent = Address::generate(&e);
    let recipient = Address::generate(&e);

    let token_admin = Address::generate(&e);
    let token_id = e.register_stellar_asset_contract_v2(token_admin.clone()).address();

    let contract_id = e.register(GuardrailContract, ());
    let client = GuardrailContractClient::new(&e, &contract_id);

    let policy = PolicyConfig {
        max_amount_per_tx: 100_000_000,     // 10 XLM (in stroops)
        daily_spending_limit: 500_000_000,  // 50 XLM
        weekly_spending_limit: 2_000_000_000, // 200 XLM
        human_approval_threshold: 50_000_000, // 5 XLM
    };

    client.initialize(&admin, &cosigner, &agent, &policy);
    client.set_recipient_status(&recipient, &true);
    client.set_token_status(&token_id, &true);

    // Fund the contract treasury
    let sac = StellarAssetClient::new(&e, &token_id);
    sac.mint(&contract_id, &1_000_000_000); // Mint 100 XLM to contract

    (e, admin, cosigner, agent, recipient, token_id, client)
}

#[test]
fn test_initialization_and_policy() {
    let (_, admin, cosigner, agent, _, _, client) = setup_test_env();

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_cosigner(), cosigner);
    assert_eq!(client.get_agent(), agent);
    assert_eq!(client.is_paused(), false);
    assert_eq!(client.is_agent_active(), true);

    let pol = client.get_policy();
    assert_eq!(pol.max_amount_per_tx, 100_000_000);
    assert_eq!(pol.daily_spending_limit, 500_000_000);
}

#[test]
fn test_successful_payment_execution() {
    let (e, _, _, _, recipient, token_id, client) = setup_test_env();
    let token = TokenClient::new(&e, &token_id);

    let permit_id = BytesN::from_array(&e, &[1u8; 32]);
    let amount = 30_000_000i128; // 3 XLM
    let expires_at = e.ledger().timestamp() + 3600;

    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);

    // Verify recipient received funds
    assert_eq!(token.balance(&recipient), 30_000_000);

    // Verify permit marked as used
    assert_eq!(client.is_permit_used(&permit_id), true);

    // Verify spending status updated
    let status = client.get_spending_status();
    assert_eq!(status.spent_daily, 30_000_000);
    assert_eq!(status.remaining_daily, 470_000_000);
    assert_eq!(status.spent_weekly, 30_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // PermitAlreadyUsed
fn test_replay_protection_permit_already_used() {
    let (e, _, _, _, recipient, token_id, client) = setup_test_env();

    let permit_id = BytesN::from_array(&e, &[2u8; 32]);
    let amount = 10_000_000i128;
    let expires_at = e.ledger().timestamp() + 3600;

    // First execution succeeds
    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);

    // Replay attack with same permit must panic
    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // PermitExpired
fn test_expired_permit_rejected() {
    let (e, _, _, _, recipient, token_id, client) = setup_test_env();

    // Set ledger timestamp to 1000, and permit expiration in the past at 500
    e.ledger().set_timestamp(1000);

    let permit_id = BytesN::from_array(&e, &[3u8; 32]);
    let amount = 10_000_000i128;
    let expires_at = 500u64; // Already expired

    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")] // RecipientNotAllowed
fn test_unauthorized_recipient_blocked() {
    let (e, _, _, _, _, token_id, client) = setup_test_env();
    let unapproved_recipient = Address::generate(&e);

    let permit_id = BytesN::from_array(&e, &[4u8; 32]);
    let amount = 10_000_000i128;
    let expires_at = e.ledger().timestamp() + 3600;

    client.execute_payment(&permit_id, &token_id, &unapproved_recipient, &amount, &expires_at);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // TokenNotAllowed
fn test_unauthorized_token_blocked() {
    let (e, _, _, _, recipient, _, client) = setup_test_env();
    let token_admin = Address::generate(&e);
    let unauthorized_token = e.register_stellar_asset_contract_v2(token_admin).address();

    let permit_id = BytesN::from_array(&e, &[5u8; 32]);
    let amount = 10_000_000i128;
    let expires_at = e.ledger().timestamp() + 3600;

    client.execute_payment(&permit_id, &unauthorized_token, &recipient, &amount, &expires_at);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")] // AmountExceedsMaxPerTx
fn test_exceeding_max_per_tx_blocked() {
    let (e, _, _, _, recipient, token_id, client) = setup_test_env();

    let permit_id = BytesN::from_array(&e, &[6u8; 32]);
    let amount = 150_000_000i128; // 15 XLM (Limit is 10 XLM)
    let expires_at = e.ledger().timestamp() + 3600;

    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")] // DailyLimitExceeded
fn test_daily_spending_budget_enforced() {
    let (e, _, _, _, recipient, token_id, client) = setup_test_env();

    // Max per tx is 100M (10 XLM), daily limit is 500M (50 XLM)
    for i in 0..5 {
        let mut seed = [0u8; 32];
        seed[0] = i as u8 + 10;
        let permit_id = BytesN::from_array(&e, &seed);
        client.execute_payment(&permit_id, &token_id, &recipient, &100_000_000, &(e.ledger().timestamp() + 3600));
    }

    // 6th transaction should exceed 500M daily limit
    let permit_id_overflow = BytesN::from_array(&e, &[99u8; 32]);
    client.execute_payment(&permit_id_overflow, &token_id, &recipient, &10_000_000, &(e.ledger().timestamp() + 3600));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // ContractPaused
fn test_emergency_pause_blocks_execution() {
    let (e, admin, _, _, recipient, token_id, client) = setup_test_env();

    client.emergency_pause(&admin);
    assert_eq!(client.is_paused(), true);

    let permit_id = BytesN::from_array(&e, &[7u8; 32]);
    let amount = 10_000_000i128;
    let expires_at = e.ledger().timestamp() + 3600;

    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);
}

#[test]
fn test_unpause_restores_execution() {
    let (e, admin, _, _, recipient, token_id, client) = setup_test_env();

    client.emergency_pause(&admin);
    assert_eq!(client.is_paused(), true);

    client.unpause();
    assert_eq!(client.is_paused(), false);

    let permit_id = BytesN::from_array(&e, &[8u8; 32]);
    let amount = 10_000_000i128;
    let expires_at = e.ledger().timestamp() + 3600;

    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);
    assert_eq!(client.is_permit_used(&permit_id), true);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // AgentInactive
fn test_deactivated_agent_blocked() {
    let (e, _, _, _, recipient, token_id, client) = setup_test_env();

    client.set_agent_active(&false);
    assert_eq!(client.is_agent_active(), false);

    let permit_id = BytesN::from_array(&e, &[9u8; 32]);
    let amount = 10_000_000i128;
    let expires_at = e.ledger().timestamp() + 3600;

    client.execute_payment(&permit_id, &token_id, &recipient, &amount, &expires_at);
}
