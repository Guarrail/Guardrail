export type TabView = 
  | 'landing'
  | 'onboarding'
  | 'dashboard'
  | 'requests'
  | 'policies'
  | 'ai-agent'
  | 'wallet-security'
  | 'audit-log'
  | 'settings';

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

export interface AgentRequest {
  id: string; // e.g. REQ-1042 or UUID
  backendId?: string; // Backend UUID
  agentId: string; // agt_7f3k29xq
  agentName: string; // Payroll Assistant
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
}

export interface PolicyConfig {
  id?: string;
  name?: string;
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
  assetControls: Array<{
    id: string;
    asset: string;
    issuer: string;
    enabled: boolean;
    isNative?: boolean;
  }>;
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
  network: string;
  balanceUsdc: number;
  balanceXlm?: string;
  ownershipVerified: boolean;
  currentSignersCount: number;
  currentThreshold: number;
  proposedThreshold: number;
  isPaused: boolean;
  smartContractConnected?: boolean;
  smartContractAddress?: string;
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
  avatar?: string;
  email?: string;
}
