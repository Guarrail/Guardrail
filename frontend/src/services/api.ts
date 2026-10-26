/**
 * GuardRail Backend API Client
 * Replaces all static/mock placeholder data with real endpoints on the Django REST Framework coordinator.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error || errJson.detail || JSON.stringify(errJson);
    } catch {
      // Keep default error
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export interface ApiDashboardStats {
  wallet_balance: string;
  active_agents: number;
  pending_approvals: number;
  approved_transactions: number;
  blocked_transactions: number;
  executed_transactions: number;
  spent_daily: string;
  daily_limit: string;
  spent_weekly: string;
  weekly_limit: string;
}

export interface ApiTransactionRequest {
  id: string;
  request_id: string;
  agent: string;
  wallet: string;
  recipient: string;
  asset_code: string;
  asset_issuer?: string | null;
  amount: string;
  status: 'PENDING_EVALUATION' | 'BLOCKED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CO_SIGNED' | 'EXECUTED' | 'FAILED';
  requires_human_approval: boolean;
  policy_evaluation_results: {
    checklist?: {
      amount_within_limit?: boolean;
      recipient_approved?: boolean;
      asset_permitted?: boolean;
      daily_budget_available?: boolean;
      weekly_budget_available?: boolean;
      requires_human_approval?: boolean;
    };
    failure_reasons?: string[];
  };
  stellar_tx_hash?: string;
  stellar_explorer_url?: string;
  execution_error?: string;
  operator_signatures?: Array<{
    operator_address: string;
    signature: string;
    weight: number;
    notes?: string;
    signed_at: string;
  }>;
  collected_weight?: number;
  required_weight?: number;
  agent_name?: string;
  agent_id?: string;
  permit?: {
    id: string;
    payload_hash: string;
    status: string;
    expires_at: string;
    is_single_use_consumed: boolean;
    approved_by?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ApiPolicy {
  id: string;
  name: string;
  description: string;
  version: number;
  max_amount_per_tx: string;
  daily_spending_limit: string;
  weekly_spending_limit: string;
  human_approval_threshold: string;
  require_human_approval_always: boolean;
  is_active: boolean;
  allowed_recipients: Array<{
    id: string;
    address: string;
    label: string;
    is_active: boolean;
    created_at: string;
  }>;
  allowed_assets: Array<{
    id: string;
    asset_code: string;
    issuer_address: string | null;
    is_active: boolean;
  }>;
  created_at: string;
}

export interface ApiControlledWallet {
  id: string;
  address: string;
  name: string;
  network: string;
  is_verified: boolean;
  is_active: boolean;
  balance: string;
  asset_code: string;
  master_weight: number;
  agent_signer_address: string;
  agent_signer_weight: number;
  cosigner_address: string;
  cosigner_weight: number;
  threshold_low: number;
  threshold_med: number;
  threshold_high: number;
  is_compliant: boolean;
  compliance_message: string;
  asset_balances?: Array<{
    asset_code: string;
    asset_name: string;
    issuer: string | null;
    balance: string;
    is_native: boolean;
    usd_rate: number;
  }>;
}

export interface ApiAgent {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  wallet: string;
  wallet_address?: string;
  policy: string;
  policy_name?: string;
  stellar_public_key: string;
  signer_weight: number;
  autonomy_mode: 'AUTONOMOUS' | 'HUMAN_APPROVAL_ALWAYS';
  api_key_prefix: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' | 'REVOKED';
  is_operational: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ApiPrivilegeEscalation {
  id: string;
  operator: string;
  operator_address: string;
  operator_alias: string;
  requested_role: string;
  reason: string;
  duration_hours: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  reviewed_by?: string;
  reviewed_by_address?: string;
  reviewed_at?: string;
  expires_at?: string;
  review_notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ApiAuditLog {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string;
  request_id: string;
  permit_id: string;
  stellar_tx_hash: string;
  stellar_explorer_url?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ApiSmartContractStatus {
  contract_name: string;
  version: string;
  blockchain: string;
  contract_address: string;
  features: string[];
  status: string;
}


export const api = {
  // --- Auth / Wallet Ownership & Profile ---
  getChallenge: (address: string) =>
    fetchJson<{ address: string; challenge: string; nonce: string }>('/api/v1/auth/challenge/', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  verifyChallenge: (address: string, signature: string, alias?: string, challenge?: string) =>
    fetchJson<{ message: string; operator: { address: string; alias?: string; is_verified: boolean } }>('/api/v1/auth/verify/', {
      method: 'POST',
      body: JSON.stringify({ address, signature, alias, challenge }),
    }),

  getOperatorProfile: (address: string) =>
    fetchJson<{ id: string; address: string; alias: string; is_verified: boolean; last_login: string | null }>(
      `/api/v1/accounts/me/?address=${encodeURIComponent(address)}`
    ),

  updateOperatorProfile: (data: { address: string; alias?: string }) =>
    fetchJson<{ id: string; address: string; alias: string; is_verified: boolean }>('/api/v1/accounts/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // --- Dashboard & Coordinator Stats ---
  getDashboardStats: () => fetchJson<ApiDashboardStats>('/api/v1/coordinator/dashboard-stats/'),

  // --- Transaction Requests ---
  getRequests: (statusParam?: string) => {
    const query = statusParam && statusParam !== 'all' ? `?status=${statusParam}` : '';
    return fetchJson<ApiTransactionRequest[] | { results: ApiTransactionRequest[] }>(`/api/v1/coordinator/requests/${query}`);
  },

  getRequest: (id: string) => fetchJson<ApiTransactionRequest>(`/api/v1/coordinator/requests/${id}/`),

  approveRequest: (id: string, operatorAddress: string, notes: string = '') =>
    fetchJson<ApiTransactionRequest>(`/api/v1/coordinator/requests/${id}/approve/`, {
      method: 'POST',
      body: JSON.stringify({ operator_address: operatorAddress, notes }),
    }),

  rejectRequest: (id: string, operatorAddress: string, reason: string) =>
    fetchJson<ApiTransactionRequest>(`/api/v1/coordinator/requests/${id}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ operator_address: operatorAddress, reason }),
    }),

  cosignAndSubmit: (id: string, mockStellar: boolean = true) =>
    fetchJson<ApiTransactionRequest>(`/api/v1/coordinator/requests/${id}/cosign-and-submit/`, {
      method: 'POST',
      body: JSON.stringify({ mock_stellar: mockStellar }),
    }),

  signRequest: (
    id: string,
    data: { operator_address: string; signature?: string; weight?: number; notes?: string }
  ) =>
    fetchJson<ApiTransactionRequest>(`/api/v1/coordinator/requests/${id}/sign/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Agent Direct Proposal (Simulation or Live)
  submitAgentRequest: (
    data: {
      request_id: string;
      recipient: string;
      amount: string;
      asset: string;
      issuer?: string | null;
      wallet_id?: string;
    },
    apiKey?: string
  ) => {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['X-Agent-Key'] = apiKey;
    }
    return fetchJson<ApiTransactionRequest>('/api/v1/agent/requests/', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  },

  // --- Policies ---
  getPolicies: () => fetchJson<ApiPolicy[] | { results: ApiPolicy[] }>('/api/v1/policies/'),

  createPolicy: (data: {
    name: string;
    description?: string;
    max_amount_per_tx: string;
    daily_spending_limit: string;
    weekly_spending_limit: string;
    human_approval_threshold: string;
    require_human_approval_always?: boolean;
  }) =>
    fetchJson<ApiPolicy>('/api/v1/policies/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePolicy: (id: string, data: Partial<ApiPolicy>) =>
    fetchJson<ApiPolicy>(`/api/v1/policies/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getBudgetStatus: (policyId: string, walletId: string) =>
    fetchJson<{
      daily_date: string;
      spent_daily: string;
      reserved_daily: string;
      daily_limit: string;
      remaining_daily: string;
      spent_weekly: string;
      weekly_limit: string;
      remaining_weekly: string;
    }>(`/api/v1/policies/${policyId}/budget-status/?wallet_id=${walletId}`),

  addRecipient: (policyId: string, data: { address: string; label: string }) =>
    fetchJson(`/api/v1/policies/${policyId}/add-recipient/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addAsset: (policyId: string, data: { asset_code: string; issuer_address?: string | null }) =>
    fetchJson(`/api/v1/policies/${policyId}/add-asset/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // --- Controlled Wallets ---
  getWallets: () => fetchJson<ApiControlledWallet[] | { results: ApiControlledWallet[] }>('/api/v1/wallets/'),

  generateVaultAddress: () =>
    fetchJson<{ address: string; network: string; message: string }>('/api/v1/wallets/generate-address/'),

  createWallet: (data: {
    address?: string;
    name: string;
    operator_address: string;
    network?: string;
    agent_signer_address?: string;
    balance?: string;
  }) =>
    fetchJson<ApiControlledWallet>('/api/v1/wallets/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateWalletWeights: (
    walletId: string,
    weights: {
      master_weight?: number;
      agent_signer_weight?: number;
      cosigner_weight?: number;
      threshold_med?: number;
      threshold_low?: number;
      threshold_high?: number;
    }
  ) =>
    fetchJson<ApiControlledWallet>(`/api/v1/wallets/${walletId}/update-weights/`, {
      method: 'POST',
      body: JSON.stringify(weights),
    }),

  getWalletSecurityAudit: (walletId: string) =>
    fetchJson<{
      wallet_address: string;
      is_compliant: boolean;
      reason: string;
      signing_model: {
        master_weight: number;
        agent_signer_weight: number;
        cosigner_weight: number;
        threshold_med: number;
      };
      agent_independent_signing_prevented: boolean;
      cosigner_required: boolean;
    }>(`/api/v1/wallets/${walletId}/security-audit/`),

  // --- Agents ---
  getAgents: () => fetchJson<ApiAgent[] | { results: ApiAgent[] }>('/api/v1/agents/'),

  createAgent: (data: {
    agent_id: string;
    name: string;
    description?: string;
    wallet: string;
    policy: string;
    stellar_public_key?: string;
    signer_weight?: number;
    autonomy_mode?: string;
  }) =>
    fetchJson<{
      agent: ApiAgent;
      api_key: string;
      stellar_public_key: string;
      stellar_secret_key?: string;
      warning: string;
    }>('/api/v1/agents/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAgent: (
    id: string,
    data: {
      name?: string;
      description?: string;
      policy?: string;
      wallet?: string;
      signer_weight?: number;
      autonomy_mode?: string;
      status?: string;
    }
  ) =>
    fetchJson<ApiAgent>(`/api/v1/agents/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  emergencyDisableAgent: (id: string) =>
    fetchJson<{ message: string; agent: ApiAgent }>(`/api/v1/agents/${id}/emergency-disable/`, {
      method: 'POST',
    }),

  activateAgent: (id: string) =>
    fetchJson<{ message: string; agent: ApiAgent }>(`/api/v1/agents/${id}/activate/`, {
      method: 'POST',
    }),

  rotateAgentKey: (id: string) =>
    fetchJson<{ agent: ApiAgent; api_key: string; warning: string }>(`/api/v1/agents/${id}/rotate-key/`, {
      method: 'POST',
    }),

  // --- Shared Account & Privilege Escalation ---
  getOperators: () =>
    fetchJson<
      Array<{
        id: string;
        address: string;
        alias: string;
        role: string;
        effective_role: string;
        is_verified: boolean;
        last_login: string | null;
      }>
    >('/api/v1/accounts/operators/'),

  getEscalationRequests: () =>
    fetchJson<ApiPrivilegeEscalation[] | { results: ApiPrivilegeEscalation[] }>('/api/v1/accounts/escalations/'),

  createEscalationRequest: (data: {
    operator_address: string;
    requested_role: string;
    reason: string;
    duration_hours?: number;
  }) =>
    fetchJson<ApiPrivilegeEscalation>('/api/v1/accounts/escalations/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approveEscalationRequest: (id: string, reviewerAddress: string, notes: string = '') =>
    fetchJson<ApiPrivilegeEscalation>(`/api/v1/accounts/escalations/${id}/approve/`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_address: reviewerAddress, notes }),
    }),

  rejectEscalationRequest: (id: string, reviewerAddress: string, notes: string = '') =>
    fetchJson<ApiPrivilegeEscalation>(`/api/v1/accounts/escalations/${id}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_address: reviewerAddress, notes }),
    }),

  // --- Audit Logs ---

  getAuditLogs: (eventType?: string, requestId?: string) => {
    const params = new URLSearchParams();
    if (eventType) params.append('event_type', eventType);
    if (requestId) params.append('request_id', requestId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<ApiAuditLog[] | { results: ApiAuditLog[] }>(`/api/v1/audit/logs/${query}`);
  },

  // --- Soroban Smart Contract ---
  getSmartContractStatus: () => fetchJson<ApiSmartContractStatus>('/api/v1/smart-contract/status/'),

  simulateSmartContract: (data: {
    permit_id_hex: string;
    token_address: string;
    recipient_address: string;
    amount_stroops: number;
    expires_at_timestamp: number;
    agent_address: string;
    cosigner_address: string;
  }) =>
    fetchJson<{
      success: boolean;
      contract_address?: string;
      simulated_tx_hash?: string;
      events_emitted?: Array<{ topic: string; permit_id: string; recipient: string; amount_stroops: number }>;
      error?: string;
    }>('/api/v1/smart-contract/simulate/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
