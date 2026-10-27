export type TabView = 
  | 'landing'
  | 'onboarding'
  | 'dashboard'
  | 'requests'
  | 'policies'
  | 'ai-agent'
  | 'wallet-security'
  | 'audit-log'
  | 'settings'
  | 'help';

export type RequestFilter = 
  | 'all' 
  | 'pending' 
  | 'eligible' 
  | 'blocked' 
  | 'approved' 
  | 'rejected' 
  | 'executed';

export interface PolicyCheckItem {
  id: string;
  title: string;
  detail: string;
  passed: boolean;
}

export interface OperatorSignature {
  operator_address: string;
  signature: string;
  weight: number;
  role?: string;
  notes?: string;
  signed_at: string;
}

export interface AgentRequest {
  id: string; // e.g. REQ-1042 or UUID
  backendId?: string; // Backend UUID
  requestId?: string;
  agentId: string; // agt_7f3k29xq
  agentName: string; // Payroll Assistant
  agentPublicKey?: string;
  walletAddress?: string;
  delegatedOperators?: string[];
  recipientName: string; // Ada Studio (contractor)
  recipientAddress: string; // GDQP3X7KMN2WRZ8YL4HBVT5JCEF9SA6UQ2NLKO7MXPG4RYW9TBJE
  amount: number;
  asset: 'USDC' | 'XLM' | string;
  assetIssuer?: string;
  time: string; // Today, 09:42
  timestamp: string;
  policyResult: 'Passed' | 'Failed';
  policyDecisionText: 'Allowed' | 'Denied';
  approvalRequired: boolean;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected' | 'Not Required';
  status: 'Pending' | 'Eligible' | 'Blocked' | 'Approved' | 'Rejected' | 'Executed';
  networkFee: string; // 0.00001 XLM
  expiresInMinutes: number;
  policyVersion: string; // v3
  payloadHash: string;
  permitId: string;
  stellarTxHash?: string;
  checks: PolicyCheckItem[];
  operatorSignatures?: OperatorSignature[];
  collectedWeight?: number;
  requiredWeight?: number;
}

export interface PolicyConfig {
  id?: string;
  name?: string;
  description?: string;
  version?: number;
  maxPerTransaction: number;
  dailyLimit: number;
  weeklyLimit: number;
  dailySpent: number;
  weeklySpent: number;
  requireHumanApproval: boolean;
  approvalThreshold: number;
  approvedRecipients: Array<{
    id: string;
    name: string;
    address: string;
    addedDate?: string;
  }>;
  blockedRecipients?: Array<{
    id: string;
    name: string;
    address: string;
    reason?: string;
    addedDate?: string;
  }>;
  assetControls: Array<{
    id: string;
    asset: string;
    issuer: string;
    enabled: boolean;
    isNative?: boolean;
  }>;
}

export interface WalletAsset {
  asset_code: string;
  asset_name: string;
  issuer: string | null;
  balance: string;
  is_native: boolean;
  usd_rate: number;
}

export interface WalletSigner {
  role: string;
  name: string;
  address: string;
  weight: number;
  description: string;
  status: 'active' | 'pending';
}

export interface ControlledWalletState {
  id?: string;
  address: string;
  name?: string;
  network: string;
  balanceUsdc: number;
  balanceXlm?: string;
  ownershipVerified: boolean;
  masterWeight?: number;
  agentSignerAddress?: string;
  agentSignerWeight?: number;
  cosignerAddress?: string;
  cosignerWeight?: number;
  currentSignersCount: number;
  currentThreshold: number;
  proposedThreshold: number;
  isPaused: boolean;
  smartContractConnected?: boolean;
  smartContractAddress?: string;
  assetBalances?: WalletAsset[];
}

export interface OperatorWalletState {
  connected: boolean;
  address: string;
  ownershipVerified: boolean;
  balanceXlm?: string;
  walletName?: string;
  username?: string;
  displayName?: string;
  role?: string;
  effectiveRole?: string;
  avatar?: string;
  email?: string;
}

export interface AIAgentItem {
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

export interface PrivilegeEscalationItem {
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

export interface OperatorProfile {
  id: string;
  address: string;
  alias: string;
  role: string;
  effective_role: string;
  is_verified: boolean;
  last_login: string | null;
  created_at: string;
}

