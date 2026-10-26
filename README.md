# GuardRail: Policy-Controlled Capital Governance for AI Agents

[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat&logo=django)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.18-red?style=flat)](https://www.django-rest-framework.org/)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0_Swagger-85EA2D?style=flat&logo=swagger)](http://localhost:8000/api/docs/)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-black?style=flat&logo=stellar)](https://stellar.org/)
[![Soroban](https://img.shields.io/badge/Soroban-Rust_Smart_Contract-DEA584?style=flat&logo=rust)](https://soroban.stellar.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://www.docker.com/)

**GuardRail** is a policy-controlled capital management infrastructure built on Stellar that enables autonomous AI agents to initiate financial transactions without giving them unrestricted control over digital assets.

By decoupling transaction initiation from final authorization, GuardRail introduces an enforceable programmable security boundary between AI agents and protected treasury wallets.

---

## 1. System Architecture & Core Flow

```mermaid
sequenceDiagram
    autonumber
    actor Agent as AI Agent (Autonomous)
    participant Coordinator as GuardRail Coordinator (Django API)
    participant DB as Atomic Ledger (PostgreSQL)
    actor Operator as Operator (Human Oversight)
    participant Signer as Co-Signer Engine
    participant Stellar as Stellar Network / Soroban Contract

    Agent->>Coordinator: POST /api/v1/agent/requests/ (X-Agent-Key, Amount, Recipient)
    Note over Coordinator,DB: Atomic row-lock (select_for_update)
    Coordinator->>Coordinator: Evaluate Policy (Amount <= Max, Recipient/Asset Allowlist)
    Coordinator->>DB: Check & Reserve Daily/Weekly Budget Capacity
    alt Violates Policy
        Coordinator-->>Agent: Status: BLOCKED (Checklist details)
    else Compliant Request
        Coordinator->>Coordinator: Generate Permit (Payload Hash SHA-256)
        alt Exceeds Human Approval Threshold
            Coordinator-->>Operator: Request Flagged for Review (PENDING_APPROVAL)
            Operator->>Coordinator: POST /api/v1/coordinator/requests/{id}/approve/
        end
        Coordinator->>Signer: Verify Permit Payload Hash & Unconsumed Status
        Signer->>Signer: Sign Transaction Envelope (GuardRail Co-Signer Key)
        Signer->>Stellar: Submit Multi-Signed Transaction
        Stellar-->>Signer: Transaction Confirmed (Tx Hash)
        Signer->>DB: Transition Reserved Budget -> Confirmed Spent
        Signer->>DB: Mark Permit as USED (Replay Protection)
        Coordinator-->>Agent: Status: EXECUTED (Stellar Tx Hash)
    end
```

### The Security Boundary Model
- **Independent Transfer Prevention**: The controlled wallet is configured on Stellar with signing weights:
  - Agent signer: **Weight 1**
  - GuardRail co-signer: **Weight 1**
  - Medium threshold (payments): **Weight 2**
  - Result: An agent alone **cannot** sign or move funds. Final payment execution strictly requires the co-signer signature, which is only released when off-chain or on-chain policy checks pass.
- **Single-Use Cryptographic Permits**: Every permit is bound to a SHA-256 digest of the canonical transaction parameters (`recipient`, `amount`, `asset`, `wallet`, `policy_id`, `request_id`). Any modification causes hash mismatch and immediate rejection.
- **Race Condition Immunity**: Parallel requests lock the wallet's `SpendingLedger` using `select_for_update()` inside atomic database transactions, preventing double-spend and budget overdraft attacks.

---

## 2. Soroban Smart Contract (`contracts/guardrail/`)

GuardRail includes an on-chain **Soroban Smart Contract** written in Rust, offering smart treasury governance directly on the Stellar Virtual Machine.

### Features
- **On-chain Dual Authorization**: Requires `agent.require_auth()` and `cosigner.require_auth()`.
- **Replay Protection**: Single-use permit tracking via `DataKey::ExecutedPermit(permit_id)`.
- **Time Windows**: Deterministic rolling 24-hour and 7-day budget tracking based on ledger timestamps.
- **Allowlists**: Dynamic recipient and token allowlists managed by operator admin.
- **Emergency Circuit Breaker**: Immediate pause/unpause capability to halt capital flight.

### Testing the Smart Contract
```bash
cargo test --manifest-path contracts/guardrail/Cargo.toml
```
All 11 Rust tests pass, validating:
1. `test_initialization_and_policy`
2. `test_successful_payment_execution`
3. `test_replay_protection_permit_already_used` (panics with `PermitAlreadyUsed`)
4. `test_expired_permit_rejected` (panics with `PermitExpired`)
5. `test_unauthorized_recipient_blocked` (panics with `RecipientNotAllowed`)
6. `test_unauthorized_token_blocked` (panics with `TokenNotAllowed`)
7. `test_exceeding_max_per_tx_blocked` (panics with `AmountExceedsMaxPerTx`)
8. `test_daily_spending_budget_enforced` (panics with `DailyLimitExceeded`)
9. `test_emergency_pause_blocks_execution` (panics with `ContractPaused`)
10. `test_unpause_restores_execution`
11. `test_deactivated_agent_blocked` (panics with `AgentInactive`)

---

## 3. Backend Architecture (Django & DRF)

Built with a modular Django architecture adhering to clean enterprise design:

| Module | Responsibility |
| :--- | :--- |
| `apps.core` | Abstract UUID models, SHA-256 canonical payload hashing, 7-decimal stroop math, Stellar SDK wrappers. |
| `apps.accounts` | Operator identity, SEP-10 challenge-response authentication with Ed25519 signature verification. |
| `apps.wallets` | Controlled wallet registry, multisig weight configuration, security boundary compliance audits. |
| `apps.policies` | Financial policy engine, per-tx limits, daily/weekly budgets, recipient/asset allowlists. |
| `apps.agents` | AI Agent registration, hashed API keys (`gr_live_...`), credential rotation, emergency killswitch. |
| `apps.coordinator` | Core request evaluation, permit generation, budget reservation, operator approval & co-signing. |
| `apps.audit` | Immutable audit log mapping decisions, permit hashes, and Stellar Explorer URLs. |
| `apps.smart_contracts` | Soroban contract simulation, status inspection, and on-chain event verification. |

---

## 4. Swagger & OpenAPI 3.0 Documentation

Interactive API documentation is automatically generated via `drf-spectacular`:

- **Swagger UI**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- **ReDoc**: [http://localhost:8000/api/redoc/](http://localhost:8000/api/redoc/)
- **OpenAPI 3.0 Schema**: [http://localhost:8000/api/schema/](http://localhost:8000/api/schema/)

### Authentication Schemes in Swagger
- **AgentApiKeyAuth**: Header `X-Agent-Key: gr_live_<secret>` for autonomous agents.
- **Operator Session / Signature**: Challenge-response endpoints for operators.

---

## 5. API Endpoints Reference

### AI Agent Endpoints (Authenticated via `X-Agent-Key`)
```http
POST   /api/v1/agent/requests/            # Propose a transaction (evaluates policy & issues permit)
GET    /api/v1/agent/requests/{req_id}/   # Check request status, permit, and Stellar tx hash
GET    /api/v1/agent/policy-summary/      # Active limits, remaining budgets, and allowlists
```

#### Example Agent Request:
```json
POST /api/v1/agent/requests/
Headers:
  X-Agent-Key: gr_live_9a7b...
Body:
{
  "request_id": "agent_req_20261026_001",
  "recipient": "GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE",
  "amount": "12.5000000",
  "asset": "XLM"
}
```

### Operator & Coordinator Endpoints
```http
# Operator Authentication (SEP-10 style)
POST   /api/v1/auth/challenge/            # Request cryptographic challenge nonce
POST   /api/v1/auth/verify/               # Verify Ed25519 signature & login (persists alias)
GET    /api/v1/auth/me/                   # Current operator profile
PATCH  /api/v1/auth/me/                   # Update operator profile (alias / username)

# Controlled Wallets & Security Boundary
GET    /api/v1/wallets/                   # List controlled wallets
POST   /api/v1/wallets/                   # Register controlled wallet
GET    /api/v1/wallets/{id}/security-audit/ # Audit multisig weights & thresholds

# Policies & Budget Management
GET    /api/v1/policies/                  # List active policies
POST   /api/v1/policies/{id}/budget-status/ # Real-time daily/weekly spending remaining
POST   /api/v1/policies/{id}/add-recipient/ # Add address to allowlist
POST   /api/v1/policies/{id}/add-asset/     # Add asset to allowlist

# AI Agent Supervision
GET    /api/v1/agents/                    # List registered AI agents
POST   /api/v1/agents/                    # Register agent (returns secret API key once)
POST   /api/v1/agents/{id}/rotate-key/    # Invalidate old credentials & issue new
POST   /api/v1/agents/{id}/emergency-disable/ # Instant killswitch to halt co-signing
POST   /api/v1/agents/{id}/activate/      # Re-enable disabled agent

# Coordinator Requests & Approvals
GET    /api/v1/coordinator/requests/      # Filter requests (PENDING_APPROVAL, BLOCKED, etc.)
GET    /api/v1/coordinator/requests/{id}/ # Detailed request view with policy checklist
POST   /api/v1/coordinator/requests/{id}/approve/ # Operator human approval
POST   /api/v1/coordinator/requests/{id}/reject/  # Operator rejection (releases reserved budget)
POST   /api/v1/coordinator/requests/{id}/cosign-and-submit/ # Co-sign & submit to Stellar Testnet
GET    /api/v1/coordinator/permits/       # Inspect single-use authorization permits
GET    /api/v1/coordinator/dashboard-stats/ # Aggregated metrics for dashboard cards

# Audit Log
GET    /api/v1/audit/logs/                # Immutable history with Stellar Explorer links

# Soroban Smart Contract
GET    /api/v1/smart-contract/status/     # Inspect contract parameters
POST   /api/v1/smart-contract/simulate/   # Simulate on-chain permit execution
```

---

## 6. Local Quickstart

### Prerequisites
- Python 3.13+
- Rust & Cargo 1.80+ (optional, for Soroban contract compilation)
- Docker & Docker Compose (optional, for containerized run)

### 1. Setup Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run Migrations & Start Server
```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
Visit [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/) to view the Swagger interface.

---

## 7. Frontend Application & Screen Flows (`frontend/`)

GuardRail features an enterprise-grade React dashboard built with Tailwind CSS, Lucide icons, and the official Stellar Wallets Kit.

### Screen Flows & Features
- **Landing Page (`/`)**: Architecture walkthrough, core value proposition, feature overview, and direct call-to-actions to launch the app or start onboarding.
- **Onboarding & Sign-Up Flow (`/onboarding`)**:
  1. **Connect Official Stellar Wallet**: Integrates `@creit.tech/stellar-wallets-kit` supporting Freighter, xBull, and Albedo on Stellar Testnet.
  2. **Cryptographic SEP-10 Verification**: Requests a nonce challenge from `/api/v1/accounts/challenge/` and verifies the operator's Ed25519 signature.
  3. **Soroban Smart Contract Binding**: Connects treasury wallet to `/api/v1/smart-contracts/status/` and registers the controlled treasury in the coordinator registry (`/api/v1/coordinator/wallets/`).
- **Dashboard Navigation Profile**:
  - Live operator wallet profile badge in both the sticky Top Header and collapsible Sidebar.
  - Real-time Stellar Testnet XLM balance fetched directly from Horizon Testnet (`/accounts/{address}`).
  - Dynamic status indicator with pulse animation and modal management.
- **Transaction Flow & Modal Review**:
  - Real-time policy checklists (Rule 1 through Rule 6).
  - Quick Approve / Reject and comprehensive Co-signing modal calling `/api/v1/coordinator/requests/{id}/approve/` and `/cosign/`.
- **Policy Configuration (`/policies`)**: Live limits management updating `/api/v1/coordinator/policies/{id}/`.
- **Zero Placeholder / Mock Data**: All views query and mutate live backend DRF endpoints with full TypeScript definitions.

---

## 8. Docker Deployment

The entire stack is containerized with multi-stage, security-hardened Dockerfiles:
- **`db`**: PostgreSQL 16 Alpine with persistent data volume and healthchecks.
- **`web`**: Python 3.13 Slim running Django + Gunicorn on port `8000`.
- **`frontend`**: Node 22 Alpine builder + Nginx Alpine running on port `3000` with automated SPA routing and `/api/` proxying to `web`.

### Build & Run Stack with Docker Compose
```bash
# Build all images (db, web, frontend)
docker compose build

# Start services in the background
docker compose up -d
```

### Accessing the Platform
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Coordinator API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- **Health Check**: [http://localhost:8000/health/](http://localhost:8000/health/)

---

## 9. Comprehensive Test Suite

Both backend unit tests and smart contract unit tests are automated:

### Run Django Unit Tests (38 Tests)
```bash
pytest
```
```text
============================== 38 passed in 0.45s ==============================
```

### Run Soroban Contract Tests (11 Tests)
```bash
cargo test --manifest-path contracts/guardrail/Cargo.toml
```
```text
test result: ok. 11 passed; 0 failed; 0 ignored; finished in 0.03s
```

### Test Coverage Highlights
- [x] **Rule 1 (Max Single Amount)**: Amounts exceeding limit blocked.
- [x] **Rule 2 (Daily Spending Budget)**: Cumulative daily spend capped at budget limit.
- [x] **Rule 3 (Recipient Allowlist)**: Transfers to unapproved Stellar addresses blocked.
- [x] **Rule 4 (Asset Allowlist)**: Transfers involving non-whitelisted tokens blocked.
- [x] **Rule 5 (Human Oversight)**: Requests exceeding approval threshold gated for operator review.
- [x] **Replay Protection**: Single-use permits cannot be executed a second time.
- [x] **Tampering Detection**: Any modification to amount/recipient after permit issuance triggers hash mismatch error.
- [x] **Rejection Accounting**: Operator rejection immediately releases reserved budget back to available balance.
- [x] **Idempotency**: Repeated requests with the same `request_id` do not reserve double budget or trigger duplicate payments.
- [x] **Multisig Boundary**: Proof that Agent signing weight alone is insufficient to satisfy transaction thresholds.
- [x] **Killswitch Verification**: Emergency-disabled agent is immediately rejected by authentication and policy layers.

---

## 10. Security & Compliance Summary

1. **Private Key Segregation**: The GuardRail co-signer secret key is isolated in environment variables/KMS. It is never exposed in API responses or visible to AI agents.
2. **Deterministic Stroop Precision**: All financial operations use Python `Decimal` and Rust `i128` stroops to eliminate IEEE 754 floating-point rounding vulnerabilities.
3. **Defense-in-Depth**: Policy checks are evaluated off-chain before co-signing, and re-verified on-chain via Soroban smart contracts.
