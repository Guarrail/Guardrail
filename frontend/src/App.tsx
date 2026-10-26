import React, { useState, useEffect, useCallback } from 'react';
import {
  TabView,
  AgentRequest,
  PolicyConfig,
  ControlledWalletState,
  OperatorWalletState,
  WalletSigner,
} from './types';
import { api, ApiTransactionRequest, ApiPolicy, ApiControlledWallet } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { OnboardingView } from './components/OnboardingView';
import { DashboardView } from './components/DashboardView';
import { RequestsView } from './components/RequestsView';
import { PolicyConfigView } from './components/PolicyConfigView';
import { WalletSecurityView } from './components/WalletSecurityView';
import { AIAgentView } from './components/AIAgentView';
import { AuditLogView } from './components/AuditLogView';
import { SettingsView } from './components/SettingsView';
import { RequestDetailModal } from './components/RequestDetailModal';
import { SimulateRequestModal } from './components/SimulateRequestModal';
import {
  LayoutDashboard,
  FileText,
  Shield,
  Bot,
  Wallet,
} from 'lucide-react';

const DEFAULT_OPERATOR: OperatorWalletState = {
  connected: true,
  address: 'GB4KGM6UEOARGKYWQLRJQOZXBKBCOLBUGXIGQLTM7YCMGTSFL5UGKKPX',
  ownershipVerified: true,
  balanceXlm: '100.00',
  walletName: 'Stellar Testnet Operator',
};

const DEFAULT_CONTROLLED: ControlledWalletState = {
  address: 'GBVYF7JVPDVWOHV6V334O3DUK2NO76F4ML23BNYPQ4BXDGN7ZCVGEW7K',
  network: 'Stellar Testnet',
  balanceUsdc: 500.0,
  balanceXlm: '500.00',
  ownershipVerified: true,
  currentSignersCount: 3,
  currentThreshold: 2,
  proposedThreshold: 2,
  isPaused: false,
  smartContractConnected: true,
  smartContractAddress: 'CDEMOGUARDRAILCONTRACTTESTNET1234567890ABCDEFGH',
};

function mapBackendRequest(r: ApiTransactionRequest): AgentRequest {
  const chk = r.policy_evaluation_results?.checklist || {};
  const checklist = [
    {
      id: 'chk_1',
      title: 'Transaction amount within limit',
      detail: chk.amount_within_limit ? 'Compliant with per-transaction cap' : 'Exceeds per-tx limit',
      passed: chk.amount_within_limit ?? true,
    },
    {
      id: 'chk_2',
      title: 'Recipient approved',
      detail: chk.recipient_approved ? 'Verified on active allowlist' : 'Unauthorized recipient address',
      passed: chk.recipient_approved ?? true,
    },
    {
      id: 'chk_3',
      title: 'Asset permitted',
      detail: chk.asset_permitted ? `${r.asset_code} is whitelisted` : 'Restricted asset',
      passed: chk.asset_permitted ?? true,
    },
    {
      id: 'chk_4',
      title: 'Daily spending limit available',
      detail: chk.daily_budget_available ? 'Available under daily budget' : 'Exceeds daily budget limit',
      passed: chk.daily_budget_available ?? true,
    },
    {
      id: 'chk_5',
      title: 'Weekly spending limit available',
      detail: chk.weekly_budget_available ? 'Available under weekly budget' : 'Exceeds weekly budget limit',
      passed: chk.weekly_budget_available ?? true,
    },
    {
      id: 'chk_6',
      title: 'Human approval requirement satisfied',
      detail: r.requires_human_approval
        ? r.status === 'APPROVED' || r.status === 'EXECUTED'
          ? 'Approved by human operator'
          : 'Pending operator review'
        : 'Auto-approved under threshold',
      passed: r.status === 'APPROVED' || r.status === 'EXECUTED' || !r.requires_human_approval,
    },
  ];

  let feStatus: AgentRequest['status'] = 'Pending';
  if (r.status === 'PENDING_APPROVAL') feStatus = 'Pending';
  else if (r.status === 'APPROVED') feStatus = 'Approved';
  else if (r.status === 'BLOCKED') feStatus = 'Blocked';
  else if (r.status === 'REJECTED') feStatus = 'Rejected';
  else if (r.status === 'EXECUTED') feStatus = 'Executed';

  return {
    id: r.request_id,
    backendId: r.id,
    agentId: r.agent,
    agentName: 'Autonomous Agent',
    recipientName: r.recipient ? `${r.recipient.slice(0, 6)}...${r.recipient.slice(-4)}` : 'Approved Vendor',
    recipientAddress: r.recipient,
    amount: parseFloat(r.amount),
    asset: r.asset_code,
    assetIssuer: r.asset_issuer || undefined,
    time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: r.created_at,
    policyResult: r.status === 'BLOCKED' ? 'Failed' : 'Passed',
    policyDecisionText: r.status === 'BLOCKED' ? 'Denied' : 'Allowed',
    approvalRequired: r.requires_human_approval,
    approvalStatus:
      r.status === 'PENDING_APPROVAL'
        ? 'Pending'
        : r.status === 'REJECTED'
        ? 'Rejected'
        : r.status === 'APPROVED' || r.status === 'EXECUTED'
        ? 'Approved'
        : 'Not Required',
    status: feStatus,
    networkFee: '0.00001 XLM',
    expiresInMinutes: 30,
    policyVersion: 'v1',
    payloadHash: r.permit?.payload_hash || 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    permitId: r.permit?.id || '',
    stellarTxHash: r.stellar_tx_hash,
    checks: checklist,
  };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabView>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);

  // Core Application Live State (populated from backend API)
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [policyConfig, setPolicyConfig] = useState<PolicyConfig>({
    maxPerTransaction: 25,
    dailyLimit: 100,
    weeklyLimit: 400,
    dailySpent: 0,
    weeklySpent: 0,
    requireHumanApproval: false,
    approvalThreshold: 15,
    approvedRecipients: [
      {
        id: 'rec_1',
        name: 'Approved Vendor A',
        address: 'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE',
      },
    ],
    assetControls: [
      {
        id: 'ast_1',
        asset: 'XLM',
        issuer: 'Native',
        enabled: true,
        isNative: true,
      },
      {
        id: 'ast_2',
        asset: 'USDC',
        issuer: 'Centre',
        enabled: true,
        isNative: false,
      },
    ],
  });

  const [operatorWallet, setOperatorWallet] = useState<OperatorWalletState>(() => {
    const saved = localStorage.getItem('guardrail_operator_wallet');
    return saved ? JSON.parse(saved) : DEFAULT_OPERATOR;
  });

  const [controlledWallet, setControlledWallet] = useState<ControlledWalletState>(DEFAULT_CONTROLLED);
  const [signers, setSigners] = useState<WalletSigner[]>([
    {
      role: 'Agent signer',
      name: 'Agent Keypair',
      address: 'GCUKGQL43TGXLMV3F2N5JFN7PKUAUXON6VWVIPE6375OJ7VYYKUG7U2G',
      weight: 1,
      description: 'Proposes transactions. Cannot move funds independently.',
      status: 'active',
    },
    {
      role: 'GuardRail co-signer',
      name: 'Backend Automated Co-Signer',
      address: 'GBGUARDRAILCOSIGNERTESTNETPUBKEYDEMO1234567890ABCDEFGH',
      weight: 1,
      description: 'Signs only transactions verified against active policies.',
      status: 'active',
    },
    {
      role: 'Operator signer',
      name: 'Operator Personal Key',
      address: operatorWallet.address || DEFAULT_OPERATOR.address,
      weight: 1,
      description: 'Operator recovery and high-value approvals.',
      status: 'active',
    },
  ]);

  const [selectedRequest, setSelectedRequest] = useState<AgentRequest | null>(null);

  // Save operator wallet changes to localStorage
  useEffect(() => {
    localStorage.setItem('guardrail_operator_wallet', JSON.stringify(operatorWallet));
  }, [operatorWallet]);

  // Load live data from the backend coordinator API
  const refreshBackendData = useCallback(async () => {
    try {
      // 1. Fetch Wallets
      const walletsData = await api.getWallets().catch(() => null);
      const walletsList = Array.isArray(walletsData)
        ? walletsData
        : (walletsData as { results?: ApiControlledWallet[] })?.results || [];

      if (walletsList.length > 0) {
        const w = walletsList[0];
        setControlledWallet((prev) => ({
          ...prev,
          id: w.id,
          address: w.address,
          network: w.network === 'PUBLIC' ? 'Stellar Public' : 'Stellar Testnet',
          balanceUsdc: parseFloat(w.balance),
          balanceXlm: w.balance,
          currentThreshold: w.threshold_med,
          currentSignersCount: 3,
        }));
      }

      // 2. Fetch Policies
      const policiesData = await api.getPolicies().catch(() => null);
      const policiesList = Array.isArray(policiesData)
        ? policiesData
        : (policiesData as { results?: ApiPolicy[] })?.results || [];

      if (policiesList.length > 0) {
        const p = policiesList[0];
        setPolicyConfig((prev) => ({
          ...prev,
          id: p.id,
          name: p.name,
          maxPerTransaction: parseFloat(p.max_amount_per_tx),
          dailyLimit: parseFloat(p.daily_spending_limit),
          weeklyLimit: parseFloat(p.weekly_spending_limit),
          approvalThreshold: parseFloat(p.human_approval_threshold),
          requireHumanApproval: p.require_human_approval_always,
          approvedRecipients: p.allowed_recipients.map((r) => ({
            id: r.id,
            name: r.label || 'Approved Destination',
            address: r.address,
            addedDate: r.created_at,
          })),
          assetControls: p.allowed_assets.map((a) => ({
            id: a.id,
            asset: a.asset_code,
            issuer: a.issuer_address || 'Native',
            enabled: a.is_active,
            isNative: a.asset_code === 'XLM',
          })),
        }));
      }

      // 3. Fetch Requests
      const reqData = await api.getRequests().catch(() => null);
      const reqList = Array.isArray(reqData)
        ? reqData
        : (reqData as { results?: ApiTransactionRequest[] })?.results || [];

      if (reqList.length > 0) {
        setRequests(reqList.map(mapBackendRequest));
      }

      // 4. Fetch Dashboard Stats
      const stats = await api.getDashboardStats().catch(() => null);
      if (stats) {
        setPolicyConfig((prev) => ({
          ...prev,
          dailySpent: parseFloat(stats.spent_daily || '0'),
          weeklySpent: parseFloat(stats.spent_weekly || '0'),
        }));
      }
    } catch (err) {
      console.warn('Backend sync:', err);
    }
  }, []);

  useEffect(() => {
    refreshBackendData();
  }, [refreshBackendData]);

  // Quick Approve action from dashboard
  const handleApproveQuick = async (req: AgentRequest) => {
    setSelectedRequest(req);
  };

  // Quick Reject action from dashboard (calls backend to release reserved budget)
  const handleRejectQuick = async (req: AgentRequest) => {
    try {
      await api.rejectRequest(
        req.backendId || req.id,
        operatorWallet.address || DEFAULT_OPERATOR.address,
        'Quick rejected from dashboard'
      );
      await refreshBackendData();
    } catch {
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'Rejected', approvalStatus: 'Rejected' } : r))
      );
    }
  };

  // Modal approve success (called after co-signing and stellar submission)
  const handleApproveSuccess = async (reqId: string, txHash: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'Executed',
              approvalStatus: 'Approved',
              stellarTxHash: txHash,
            }
          : r
      )
    );
    await refreshBackendData();
  };

  const handleRejectRequest = async (reqId: string) => {
    try {
      await api.rejectRequest(
        reqId,
        operatorWallet.address || DEFAULT_OPERATOR.address,
        'Operator rejected proposal'
      );
    } catch (e) {
      console.warn(e);
    }
    await refreshBackendData();
  };

  const handleAddSimulatedRequest = async (newReq: AgentRequest) => {
    setRequests((prev) => [newReq, ...prev]);
    await refreshBackendData();
  };

  const handleApplyMultisigConfig = () => {
    setControlledWallet((prev) => ({
      ...prev,
      currentThreshold: 2,
      currentSignersCount: 3,
    }));
  };

  const handleResetData = async () => {
    await refreshBackendData();
  };

  // If user is on the Landing Page
  if (currentTab === 'landing') {
    return (
      <LandingPage
        onLaunchApp={() => setCurrentTab('dashboard')}
        onOpenOnboarding={() => setCurrentTab('onboarding')}
      />
    );
  }

  // If user is in the Onboarding Wizard
  if (currentTab === 'onboarding') {
    return (
      <OnboardingView
        operatorWallet={operatorWallet}
        setOperatorWallet={setOperatorWallet}
        controlledWallet={controlledWallet}
        setControlledWallet={setControlledWallet}
        onComplete={() => setCurrentTab('dashboard')}
        onExit={() => setCurrentTab('dashboard')}
      />
    );
  }

  const pendingRequestsCount = requests.filter((r) => r.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-[#09101A] text-white flex flex-col lg:flex-row font-manrope selection:bg-[#4AC777]/30 selection:text-white">
      {/* Sidebar for Desktop & Mobile Drawer */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        pendingCount={pendingRequestsCount}
        onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
        operatorWallet={operatorWallet}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        {/* App Header with Wallet Profile and Live Balance */}
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
          controlledWallet={controlledWallet}
          operatorWallet={operatorWallet}
          setOperatorWallet={setOperatorWallet}
          onSelectTab={setCurrentTab}
        />

        {/* Tab Content */}
        <main className="flex-1 pb-20 lg:pb-8">
          {currentTab === 'dashboard' && (
            <DashboardView
              requests={requests}
              policyConfig={policyConfig}
              controlledWallet={controlledWallet}
              onSelectTab={setCurrentTab}
              onSelectRequest={setSelectedRequest}
              onApproveQuick={handleApproveQuick}
              onRejectQuick={handleRejectQuick}
              onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
            />
          )}

          {currentTab === 'requests' && (
            <RequestsView
              requests={requests}
              onSelectRequest={setSelectedRequest}
              onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
            />
          )}

          {currentTab === 'policies' && (
            <PolicyConfigView
              policyConfig={policyConfig}
              setPolicyConfig={setPolicyConfig}
            />
          )}

          {currentTab === 'wallet-security' && (
            <WalletSecurityView
              controlledWallet={controlledWallet}
              signers={signers}
              onApplyConfig={handleApplyMultisigConfig}
            />
          )}

          {currentTab === 'ai-agent' && (
            <AIAgentView
              controlledWallet={controlledWallet}
              onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
            />
          )}

          {currentTab === 'audit-log' && (
            <AuditLogView
              requests={requests}
              onSelectRequest={setSelectedRequest}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              operatorWallet={operatorWallet}
              controlledWallet={controlledWallet}
              setControlledWallet={setControlledWallet}
              onResetData={handleResetData}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1D2430]/95 backdrop-blur-md border-t border-[#2B3340] px-2 py-1.5 flex items-center justify-around">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
              currentTab === 'dashboard' ? 'text-[#4AC777]' : 'text-[#9099A5]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dash</span>
          </button>

          <button
            onClick={() => setCurrentTab('requests')}
            className={`relative flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
              currentTab === 'requests' ? 'text-[#4AC777]' : 'text-[#9099A5]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-[#F2B036]" />
            )}
          </button>

          <button
            onClick={() => setCurrentTab('policies')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
              currentTab === 'policies' ? 'text-[#4AC777]' : 'text-[#9099A5]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Policies</span>
          </button>

          <button
            onClick={() => setCurrentTab('ai-agent')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
              currentTab === 'ai-agent' ? 'text-[#4AC777]' : 'text-[#9099A5]'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Agent</span>
          </button>

          <button
            onClick={() => setCurrentTab('wallet-security')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
              currentTab === 'wallet-security' ? 'text-[#4AC777]' : 'text-[#9099A5]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Security</span>
          </button>
        </div>
      </div>

      {/* Request Details Modal */}
      <RequestDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onApproveSuccess={handleApproveSuccess}
        onRejectRequest={handleRejectRequest}
        operatorAddress={operatorWallet.address}
      />

      {/* Live Request Simulator Modal */}
      <SimulateRequestModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        policyConfig={policyConfig}
        controlledWallet={controlledWallet}
        onAddRequest={handleAddSimulatedRequest}
      />
    </div>
  );
}
