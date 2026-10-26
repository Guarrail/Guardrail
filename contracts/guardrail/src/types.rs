use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    CoSigner,
    Agent,
    AgentActive,
    IsPaused,
    Policy,
    DailySpending,
    WeeklySpending,
    LastDailyReset,
    LastWeeklyReset,
    AllowedRecipient(Address),
    AllowedToken(Address),
    ExecutedPermit(BytesN<32>),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyConfig {
    pub max_amount_per_tx: i128,
    pub daily_spending_limit: i128,
    pub weekly_spending_limit: i128,
    pub human_approval_threshold: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingStatus {
    pub spent_daily: i128,
    pub daily_limit: i128,
    pub remaining_daily: i128,
    pub spent_weekly: i128,
    pub weekly_limit: i128,
    pub remaining_weekly: i128,
    pub last_daily_reset: u64,
    pub last_weekly_reset: u64,
}
