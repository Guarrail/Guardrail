import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  TabView,
  AgentRequest,
  PolicyConfig,
  ControlledWalletState,
  OperatorWalletState,
  WalletSigner,
} from './types';
import { api, ApiTransactionRequest, ApiPolicy, ApiControlledWallet, ApiDashboardStats } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { OnboardingView } from './components/OnboardingView';
import { DashboardView } from './components/DashboardView';
import { RequestsView } from './components/RequestsView';
import { PolicyConfigView } from './components/PolicyConfigView';
import { CreatePolicyPage } from './components/CreatePolicyPage';
import { EditPolicyPage } from './components/EditPolicyPage';
import { WalletSecurityView } from './components/WalletSecurityView';
import { AIAgentView } from './components/AIAgentView';
import { AuditLogView } from './components/AuditLogView';
import { SettingsView } from './components/SettingsView';
import { HelpView } from './components/HelpView';
import { RequestDetailModal } from './components/RequestDetailModal';
import { SimulateRequestModal } from './components/SimulateRequestModal';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { fetchLiveAccountBalances } from './services/stellarWallet';
import {
  LayoutDashboard,
  FileText,
  Shield,
  Bot,
  Wallet,
} from 'lucide-react';

const getStoredOperator = (): OperatorWalletState => {
  try {
    const raw = localStorage.getItem('guardrail_operator_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.address && parsed.ownershipVerified) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read stored operator:', e);
  }
  return {
    connected: false,
    address: '',
    ownershipVerified: false,
    balanceXlm: '0.00',
    username: '',
    displayName: '',
    role: '',
    avatar: 'shield',
  };
};

const DEFAULT_OPERATOR: OperatorWalletState = getStoredOperator();

const DEFAULT_CONTROLLED: ControlledWalletState = {
  address: '',
  network: 'Stellar Testnet',
  balanceUsdc: 0.0,
  balanceXlm: '0.00',
  ownershipVerified: false,
  currentSignersCount: 3,
  currentThreshold: 2,
  proposedThreshold: 2,
  isPaused: false,
  smartContractConnected: true,
  smartContractAddress: 'CDEMOGUARDRAILCONTRACTTESTNET1234567890ABCDEFGH',
};

interface ProtectedRouteProps {
  isAuth: boolean;
  children: React.ReactElement;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuth,
  children,
  redirectTo = '/login',
}) => {
  if (!isAuth) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
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
    agentName: r.agent_name || (r.agent_id ? `Agent ${r.agent_id}` : 'Autonomous Agent'),
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
    agentPublicKey: r.agent_public_key,
    walletAddress: r.wallet_address,
    delegatedOperators: r.delegated_operators || [],
    checks: checklist,
    operatorSignatures: r.operator_signatures,
    collectedWeight: r.collected_weight,
    requiredWeight: r.required_weight,
  };
}


export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
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
    const saved = localStorage.getItem('guardrail_operator_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.address && parsed.ownershipVerified) {
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading saved session:', e);
      }
    }
    return DEFAULT_OPERATOR;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [controlledWallet, setControlledWallet] = useState<ControlledWalletState>(DEFAULT_CONTROLLED);
  const [dashboardStats, setDashboardStats] = useState<ApiDashboardStats | null>(null);
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

  // Validate session against backend API on mount
  useEffect(() => {
    if (operatorWallet.connected && operatorWallet.address) {
      api
        .getOperatorProfile(operatorWallet.address)
        .then((profile) => {
          if (profile && profile.is_verified) {
            setOperatorWallet((prev) => ({
              ...prev,
              username: profile.alias || prev.username,
              displayName: profile.alias || prev.displayName,
              ownershipVerified: true,
            }));
          } else {
            // Unverified on backend: reset session
            setOperatorWallet(DEFAULT_OPERATOR);
            localStorage.removeItem('guardrail_operator_profile');
            localStorage.removeItem('guardrail_operator_wallet');
          }
        })
        .catch(() => {
          // Address not in backend: reset session
          setOperatorWallet(DEFAULT_OPERATOR);
          localStorage.removeItem('guardrail_operator_profile');
          localStorage.removeItem('guardrail_operator_wallet');
        });
    }
  }, []);

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
        let assetBalances = w.asset_balances || [];
        let balanceXlm = w.balance;
        let balanceUsdc = parseFloat(w.balance);

        // Fetch live balances from Horizon for the controlled wallet address
        try {
          if (w.address && w.address.startsWith('G')) {
            const live = await fetchLiveAccountBalances(w.address);
            if (live.xlm) {
              balanceXlm = live.xlm;
            }
            if (live.allBalances && live.allBalances.length > 0) {
              assetBalances = assetBalances.map((ab) => {
                const found = live.allBalances.find((lb) => lb.asset_code === ab.asset_code);
                return found ? { ...ab, balance: found.balance } : ab;
              });
            }
          }
        } catch (err) {
          console.warn('Live wallet sync error:', err);
        }

        setControlledWallet((prev) => ({
          ...prev,
          id: w.id,
          name: w.name,
          address: w.address,
          network: w.network === 'PUBLIC' ? 'Stellar Public' : 'Stellar Testnet',
          balanceUsdc: balanceUsdc,
          balanceXlm: balanceXlm,
          masterWeight: w.master_weight,
          agentSignerAddress: w.agent_signer_address,
          agentSignerWeight: w.agent_signer_weight,
          cosignerAddress: w.cosigner_address,
          cosignerWeight: w.cosigner_weight,
          currentThreshold: w.threshold_med,
          currentSignersCount: 3,
          assetBalances: assetBalances,
        }));
      }


      // 2. Fetch Policies
      const policiesData = await api.getPolicies().catch(() => null);
      const policiesList = Array.isArray(policiesData)
        ? policiesData
        : (policiesData as { results?: ApiPolicy[] })?.results || [];

      if (policiesList.length > 0) {
        const p = policiesList.find((pol) => pol.is_active) || policiesList[policiesList.length - 1];
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

      setRequests(reqList.map(mapBackendRequest));

      // 4. Fetch Dashboard Stats
      const stats = await api.getDashboardStats().catch(() => null);
      if (stats) {
        setDashboardStats(stats);
        setPolicyConfig((prev) => ({
          ...prev,
          dailySpent: parseFloat(stats.spent_daily || '0'),
          weeklySpent: parseFloat(stats.spent_weekly || '0'),
          dailyLimit: parseFloat(stats.daily_limit || '0') > 0 ? parseFloat(stats.daily_limit) : prev.dailyLimit,
          weeklyLimit: parseFloat(stats.weekly_limit || '0') > 0 ? parseFloat(stats.weekly_limit) : prev.weeklyLimit,
        }));
      }
    } catch (err) {
      console.warn('Backend sync:', err);
    }
  }, []);

  // Dedicated lightweight requests polling function for live auto-updating
  const fetchRequestsOnly = useCallback(async () => {
    try {
      const reqData = await api.getRequests().catch(() => null);
      const reqList = Array.isArray(reqData)
        ? reqData
        : (reqData as { results?: ApiTransactionRequest[] })?.results || [];
      setRequests(reqList.map(mapBackendRequest));
    } catch (err) {
      console.warn('Error auto-syncing requests:', err);
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

  const pendingRequestsCount = requests.filter((r) => r.status === 'Pending').length;

  const isOperatorAuthenticated = Boolean(
    operatorWallet.connected &&
    operatorWallet.address &&
    operatorWallet.ownershipVerified
  );

  return (
    <>
      <Routes>
        {/* 1. Landing Page (Individual page at URL '/') */}
        <Route
          path="/"
          element={
            <LandingPage
              onLaunchApp={() => navigate(isOperatorAuthenticated ? '/dashboard' : '/login')}
              onOpenOnboarding={() => navigate('/signup')}
              onOpenAuthModal={() => navigate('/login')}
              operatorWallet={operatorWallet}
              setOperatorWallet={setOperatorWallet}
            />
          }
        />

        {/* 2. Login Page at URL '/login' */}
        <Route
          path="/login"
          element={
            <LoginPage
              operatorWallet={operatorWallet}
              setOperatorWallet={setOperatorWallet}
              onLoginSuccess={() => {
                refreshBackendData();
                navigate('/dashboard');
              }}
            />
          }
        />

        {/* 3. 5-Step Signup Flow at URL '/signup' and '/onboarding' */}
        <Route
          path="/signup"
          element={
            <OnboardingView
              operatorWallet={operatorWallet}
              setOperatorWallet={setOperatorWallet}
              controlledWallet={controlledWallet}
              setControlledWallet={setControlledWallet}
              onComplete={() => {
                refreshBackendData();
                navigate('/dashboard');
              }}
              onExit={() => navigate('/')}
            />
          }
        />
        <Route path="/onboarding" element={<Navigate to="/signup" replace />} />

        {/* 4. Protected Dashboard and Sub-Feature Pages */}
        <Route
          path="/*"
          element={
            <ProtectedRoute isAuth={isOperatorAuthenticated} redirectTo="/login">
              <div className="min-h-screen bg-[#09101A] text-white flex flex-col lg:flex-row font-manrope selection:bg-[#4AC777]/30 selection:text-white">
                {/* Sidebar for Desktop & Mobile Drawer */}
                <Sidebar
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
                    onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                    onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
                    onOpenAuthModal={() => navigate('/login')}
                    controlledWallet={controlledWallet}
                    operatorWallet={operatorWallet}
                    setOperatorWallet={setOperatorWallet}
                    onSelectTab={(tab) => navigate(tab === 'ai-agent' ? '/ai-agents' : `/${tab}`)}
                  />

              {/* Dynamic Pages Rendered at Individual URLs */}
              <main className="flex-1 pb-20 lg:pb-8">
                <Routes>
                  <Route
                    path="/dashboard"
                    element={
                      <DashboardView
                        requests={requests}
                        policyConfig={policyConfig}
                        controlledWallet={controlledWallet}
                        dashboardStats={dashboardStats}
                        onSelectTab={(tab) => navigate(tab === 'ai-agent' ? '/ai-agents' : `/${tab}`)}
                        onSelectRequest={setSelectedRequest}
                        onApproveQuick={handleApproveQuick}
                        onRejectQuick={handleRejectQuick}
                        onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
                      />
                    }
                  />

                  <Route
                    path="/requests"
                    element={
                      <RequestsView
                        requests={requests}
                        onSelectRequest={setSelectedRequest}
                        onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
                        onRefreshRequests={fetchRequestsOnly}
                      />
                    }
                  />

                  <Route
                    path="/policies"
                    element={
                      <PolicyConfigView
                        policyConfig={policyConfig}
                        setPolicyConfig={setPolicyConfig}
                      />
                    }
                  />

                  <Route
                    path="/policies/create"
                    element={
                      <CreatePolicyPage
                        onPolicyCreated={() => refreshBackendData()}
                      />
                    }
                  />
                  <Route path="/policies/new" element={<Navigate to="/policies/create" replace />} />

                  <Route
                    path="/policies/edit"
                    element={
                      <EditPolicyPage
                        policyConfig={policyConfig}
                        setPolicyConfig={setPolicyConfig}
                      />
                    }
                  />
                  <Route
                    path="/policies/:id/edit"
                    element={
                      <EditPolicyPage
                        policyConfig={policyConfig}
                        setPolicyConfig={setPolicyConfig}
                      />
                    }
                  />

                  <Route
                    path="/wallet-security"
                    element={
                      <WalletSecurityView
                        controlledWallet={controlledWallet}
                        signers={signers}
                        onApplyConfig={handleApplyMultisigConfig}
                      />
                    }
                  />

                  <Route
                    path="/ai-agents"
                    element={
                      <AIAgentView
                        controlledWallet={controlledWallet}
                        onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
                        onRequestCreated={refreshBackendData}
                      />
                    }
                  />
                  <Route path="/ai-agent" element={<Navigate to="/ai-agents" replace />} />

                  <Route
                    path="/audit-log"
                    element={
                      <AuditLogView
                        requests={requests}
                        onSelectRequest={setSelectedRequest}
                      />
                    }
                  />

                  <Route
                    path="/settings"
                    element={
                      <SettingsView
                        operatorWallet={operatorWallet}
                        setOperatorWallet={setOperatorWallet}
                        controlledWallet={controlledWallet}
                        setControlledWallet={setControlledWallet}
                        onResetData={handleResetData}
                      />
                    }
                  />

                  <Route
                    path="/help"
                    element={
                      <HelpView
                        onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
                      />
                    }
                  />

                  {/* Fallback unknown paths to dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>

              {/* Mobile Bottom Navigation Bar */}
              <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1D2430]/95 backdrop-blur-md border-t border-[#2B3340] px-2 py-1.5 flex items-center justify-around">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
                    location.pathname === '/dashboard' ? 'text-[#4AC777]' : 'text-[#9099A5]'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dash</span>
                </button>

                <button
                  onClick={() => navigate('/requests')}
                  className={`relative flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
                    location.pathname === '/requests' ? 'text-[#4AC777]' : 'text-[#9099A5]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Requests</span>
                  {pendingRequestsCount > 0 && (
                    <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-[#F2B036]" />
                  )}
                </button>

                <button
                  onClick={() => navigate('/policies')}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
                    location.pathname === '/policies' ? 'text-[#4AC777]' : 'text-[#9099A5]'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Policies</span>
                </button>

                <button
                  onClick={() => navigate('/ai-agents')}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
                    location.pathname === '/ai-agents' || location.pathname === '/ai-agent'
                      ? 'text-[#4AC777]'
                      : 'text-[#9099A5]'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span>Agent</span>
                </button>

                <button
                  onClick={() => navigate('/wallet-security')}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded text-[10px] font-medium transition-colors ${
                    location.pathname === '/wallet-security' ? 'text-[#4AC777]' : 'text-[#9099A5]'
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
          </ProtectedRoute>
        }
      />
    </Routes>

      {/* Official Stellar Wallets Kit Login & Signup Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(authOp) => {
          setOperatorWallet(authOp);
          refreshBackendData();
        }}
      />
    </>
  );
}
