#![no_std]

mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, symbol_short, token, Address,
    BytesN, Env, Symbol,
};
pub use types::{DataKey, PolicyConfig, SpendingStatus};

const ONE_DAY_SECONDS: u64 = 86_400;
const ONE_WEEK_SECONDS: u64 = 604_800;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GuardrailError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ContractPaused = 3,
    AgentInactive = 4,
    PermitAlreadyUsed = 5,
    PermitExpired = 6,
    RecipientNotAllowed = 7,
    TokenNotAllowed = 8,
    AmountExceedsMaxPerTx = 9,
    DailyLimitExceeded = 10,
    WeeklyLimitExceeded = 11,
    InvalidAmount = 12,
    Unauthorized = 13,
    RecipientBlacklisted = 14,
}

#[contract]
pub struct GuardrailContract;

#[contractimpl]
impl GuardrailContract {
    /// Initialize the GuardRail policy contract with operator admin, backend co-signer, and AI agent.
    pub fn initialize(
        e: Env,
        admin: Address,
        cosigner: Address,
        agent: Address,
        policy: PolicyConfig,
    ) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&e, GuardrailError::AlreadyInitialized);
        }

        admin.require_auth();

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::CoSigner, &cosigner);
        e.storage().instance().set(&DataKey::Agent, &agent);
        e.storage().instance().set(&DataKey::AgentActive, &true);
        e.storage().instance().set(&DataKey::IsPaused, &false);

        Self::validate_policy(&e, &policy);
        e.storage().instance().set(&DataKey::Policy, &policy);

        let now = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::DailySpending, &0i128);
        e.storage().instance().set(&DataKey::WeeklySpending, &0i128);
        e.storage().instance().set(&DataKey::LastDailyReset, &now);
        e.storage().instance().set(&DataKey::LastWeeklyReset, &now);

        e.events().publish((symbol_short!("init"),), admin);
    }

    /// Update the financial policy rules (admin only).
    pub fn update_policy(e: Env, policy: PolicyConfig) {
        Self::require_admin(&e);
        Self::validate_policy(&e, &policy);

        e.storage().instance().set(&DataKey::Policy, &policy);
        e.events().publish((symbol_short!("pol_upd"),), policy.max_amount_per_tx);
    }

    /// Add or remove an address from the approved recipient allowlist.
    pub fn set_recipient_status(e: Env, recipient: Address, allowed: bool) {
        Self::require_admin(&e);
        e.storage().persistent().set(&DataKey::AllowedRecipient(recipient.clone()), &allowed);
        e.events().publish((symbol_short!("rec_upd"), recipient), allowed);
    }

    /// Add or remove an address from the prohibited recipient blacklist.
    pub fn set_blocked_recipient_status(e: Env, recipient: Address, blocked: bool) {
        Self::require_admin(&e);
        e.storage().persistent().set(&DataKey::BlockedRecipient(recipient.clone()), &blocked);
        e.events().publish((symbol_short!("blk_upd"), recipient), blocked);
    }

    /// Configure a multisig signer's weight in the smart contract.
    pub fn set_signer_weight(e: Env, signer: Address, weight: u32) {
        Self::require_admin(&e);
        e.storage().persistent().set(&DataKey::SignerWeight(signer.clone()), &weight);
        e.events().publish((symbol_short!("sig_upd"), signer), weight);
    }

    /// Configure the required multisig threshold in the smart contract.
    pub fn set_required_weight(e: Env, weight: u32) {
        Self::require_admin(&e);
        e.storage().instance().set(&DataKey::RequiredMultisigWeight, &weight);
        e.events().publish((symbol_short!("req_upd"),), weight);
    }

    /// Add or remove an asset token from the approved asset allowlist.
    pub fn set_token_status(e: Env, token: Address, allowed: bool) {
        Self::require_admin(&e);
        e.storage().persistent().set(&DataKey::AllowedToken(token.clone()), &allowed);
        e.events().publish((symbol_short!("tok_upd"), token), allowed);
    }

    /// Activate or deactivate the AI agent (admin only).
    pub fn set_agent_active(e: Env, active: bool) {
        Self::require_admin(&e);
        e.storage().instance().set(&DataKey::AgentActive, &active);
        e.events().publish((symbol_short!("agent_st"),), active);
    }

    /// Emergency pause to immediately freeze all outbound transactions.
    /// Can be triggered by either admin or cosigner for defense-in-depth.
    pub fn emergency_pause(e: Env, caller: Address) {
        caller.require_auth();
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        let cosigner: Address = e.storage().instance().get(&DataKey::CoSigner).unwrap();

        if caller != admin && caller != cosigner {
            panic_with_error!(&e, GuardrailError::Unauthorized);
        }

        e.storage().instance().set(&DataKey::IsPaused, &true);
        e.events().publish((symbol_short!("pause"),), caller);
    }

    /// Unpause the contract (admin only).
    pub fn unpause(e: Env) {
        Self::require_admin(&e);
        e.storage().instance().set(&DataKey::IsPaused, &false);
        e.events().publish((symbol_short!("unpause"),), true);
    }

    /// Execute a policy-checked payment.
    /// Requires dual authorization from Agent and GuardRail CoSigner.
    pub fn execute_payment(
        e: Env,
        permit_id: BytesN<32>,
        token: Address,
        recipient: Address,
        amount: i128,
        expires_at: u64,
    ) {
        // 1. Verify system state & active agent
        if Self::is_paused(e.clone()) {
            panic_with_error!(&e, GuardrailError::ContractPaused);
        }

        let agent: Address = e.storage().instance().get(&DataKey::Agent).unwrap();
        let cosigner: Address = e.storage().instance().get(&DataKey::CoSigner).unwrap();
        let agent_active: bool = e.storage().instance().get(&DataKey::AgentActive).unwrap();

        if !agent_active {
            panic_with_error!(&e, GuardrailError::AgentInactive);
        }

        // 2. Dual Authorization Requirement (Multisig Guardrail)
        agent.require_auth();
        cosigner.require_auth();

        // 3. Amount validity
        if amount <= 0 {
            panic_with_error!(&e, GuardrailError::InvalidAmount);
        }

        // 4. Expiration check
        let now = e.ledger().timestamp();
        if now > expires_at {
            panic_with_error!(&e, GuardrailError::PermitExpired);
        }

        // 5. Single-use replay protection
        if e.storage().persistent().has(&DataKey::ExecutedPermit(permit_id.clone())) {
            panic_with_error!(&e, GuardrailError::PermitAlreadyUsed);
        }

        // 6. Recipient blacklist check
        if Self::is_recipient_blocked(e.clone(), recipient.clone()) {
            panic_with_error!(&e, GuardrailError::RecipientBlacklisted);
        }

        // 7. Recipient allowlist check
        if !Self::is_recipient_allowed(e.clone(), recipient.clone()) {
            panic_with_error!(&e, GuardrailError::RecipientNotAllowed);
        }

        // 7. Token allowlist check
        if !Self::is_token_allowed(e.clone(), token.clone()) {
            panic_with_error!(&e, GuardrailError::TokenNotAllowed);
        }

        // 8. Policy Evaluation
        let policy: PolicyConfig = e.storage().instance().get(&DataKey::Policy).unwrap();
        if amount > policy.max_amount_per_tx {
            panic_with_error!(&e, GuardrailError::AmountExceedsMaxPerTx);
        }

        // 9. Daily & Weekly Budget Evaluation with Window Reset
        let mut spent_daily: i128 = e.storage().instance().get(&DataKey::DailySpending).unwrap();
        let mut last_daily: u64 = e.storage().instance().get(&DataKey::LastDailyReset).unwrap();

        if now >= last_daily + ONE_DAY_SECONDS {
            spent_daily = 0;
            last_daily = now;
            e.storage().instance().set(&DataKey::LastDailyReset, &last_daily);
        }

        if spent_daily + amount > policy.daily_spending_limit {
            panic_with_error!(&e, GuardrailError::DailyLimitExceeded);
        }

        let mut spent_weekly: i128 = e.storage().instance().get(&DataKey::WeeklySpending).unwrap();
        let mut last_weekly: u64 = e.storage().instance().get(&DataKey::LastWeeklyReset).unwrap();

        if now >= last_weekly + ONE_WEEK_SECONDS {
            spent_weekly = 0;
            last_weekly = now;
            e.storage().instance().set(&DataKey::LastWeeklyReset, &last_weekly);
        }

        if spent_weekly + amount > policy.weekly_spending_limit {
            panic_with_error!(&e, GuardrailError::WeeklyLimitExceeded);
        }

        // 10. Update Accounting & Mark Permit Executed
        spent_daily += amount;
        spent_weekly += amount;
        e.storage().instance().set(&DataKey::DailySpending, &spent_daily);
        e.storage().instance().set(&DataKey::WeeklySpending, &spent_weekly);
        e.storage().persistent().set(&DataKey::ExecutedPermit(permit_id.clone()), &true);

        // 11. Execute Safe Token Transfer
        let client = token::Client::new(&e, &token);
        client.transfer(&e.current_contract_address(), &recipient, &amount);

        // 12. Emit Audit Event
        e.events().publish(
            (Symbol::new(&e, "permit_exec"), permit_id),
            (recipient, amount),
        );
    }

    // --- View Functions ---

    pub fn get_policy(e: Env) -> PolicyConfig {
        e.storage().instance().get(&DataKey::Policy).unwrap()
    }

    pub fn get_spending_status(e: Env) -> SpendingStatus {
        let policy: PolicyConfig = e.storage().instance().get(&DataKey::Policy).unwrap();
        let now = e.ledger().timestamp();

        let last_daily: u64 = e.storage().instance().get(&DataKey::LastDailyReset).unwrap();
        let spent_daily: i128 = if now >= last_daily + ONE_DAY_SECONDS {
            0
        } else {
            e.storage().instance().get(&DataKey::DailySpending).unwrap()
        };

        let last_weekly: u64 = e.storage().instance().get(&DataKey::LastWeeklyReset).unwrap();
        let spent_weekly: i128 = if now >= last_weekly + ONE_WEEK_SECONDS {
            0
        } else {
            e.storage().instance().get(&DataKey::WeeklySpending).unwrap()
        };

        SpendingStatus {
            spent_daily,
            daily_limit: policy.daily_spending_limit,
            remaining_daily: (policy.daily_spending_limit - spent_daily).max(0),
            spent_weekly,
            weekly_limit: policy.weekly_spending_limit,
            remaining_weekly: (policy.weekly_spending_limit - spent_weekly).max(0),
            last_daily_reset: last_daily,
            last_weekly_reset: last_weekly,
        }
    }

    pub fn is_permit_used(e: Env, permit_id: BytesN<32>) -> bool {
        e.storage().persistent().get(&DataKey::ExecutedPermit(permit_id)).unwrap_or(false)
    }

    pub fn is_recipient_allowed(e: Env, recipient: Address) -> bool {
        e.storage().persistent().get(&DataKey::AllowedRecipient(recipient)).unwrap_or(false)
    }

    pub fn is_recipient_blocked(e: Env, recipient: Address) -> bool {
        e.storage().persistent().get(&DataKey::BlockedRecipient(recipient)).unwrap_or(false)
    }

    pub fn get_signer_weight(e: Env, signer: Address) -> u32 {
        e.storage().persistent().get(&DataKey::SignerWeight(signer)).unwrap_or(0)
    }

    pub fn get_required_weight(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::RequiredMultisigWeight).unwrap_or(2)
    }

    pub fn is_token_allowed(e: Env, token: Address) -> bool {
        e.storage().persistent().get(&DataKey::AllowedToken(token)).unwrap_or(false)
    }

    pub fn get_admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn get_cosigner(e: Env) -> Address {
        e.storage().instance().get(&DataKey::CoSigner).unwrap()
    }

    pub fn get_agent(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Agent).unwrap()
    }

    pub fn is_paused(e: Env) -> bool {
        e.storage().instance().get(&DataKey::IsPaused).unwrap_or(false)
    }

    pub fn is_agent_active(e: Env) -> bool {
        e.storage().instance().get(&DataKey::AgentActive).unwrap_or(false)
    }

    // --- Internal Helpers ---

    fn require_admin(e: &Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    fn validate_policy(e: &Env, policy: &PolicyConfig) {
        if policy.max_amount_per_tx <= 0
            || policy.daily_spending_limit <= 0
            || policy.weekly_spending_limit <= 0
        {
            panic_with_error!(e, GuardrailError::InvalidAmount);
        }
        if policy.max_amount_per_tx > policy.daily_spending_limit {
            panic_with_error!(e, GuardrailError::InvalidAmount);
        }
        if policy.daily_spending_limit > policy.weekly_spending_limit {
            panic_with_error!(e, GuardrailError::InvalidAmount);
        }
    }
}
