import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ControlledWalletState } from '../types';
import { api, ApiAgent, ApiPolicy } from '../services/api';
import { AgentApiConfigModal } from './AgentApiConfigModal';
import { fetchLiveAccountBalances } from '../services/stellarWallet';
import {
  Bot,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Play,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Edit3,
  ExternalLink,
  Shield,
  Lock,
  Zap,
  Sliders,
  CheckCircle2,
  X,
  Radio,
  Terminal,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  UserPlus,
  ChevronDown,
  Settings,
  Send,
  WalletCards,
} from 'lucide-react';

interface AIAgentViewProps {
  controlledWallet: ControlledWalletState;
  onOpenSimulateModal?: () => void;
  onRequestCreated?: () => void;
}

export const AIAgentView: React.FC<AIAgentViewProps> = ({
  controlledWallet,
  onOpenSimulateModal,
  onRequestCreated,
}) => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [policies, setPolicies] = useState<ApiPolicy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED' | 'INACTIVE'>('ALL');
  const [toastMessage, setToastMessage] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<{ agentId: string; menu: 'manage' | 'settings' } | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setOpenMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Creation modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newAgentId, setNewAgentId] = useState<string>('');
  const [newAgentName, setNewAgentName] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newPolicyId, setNewPolicyId] = useState<string>('');
  const [newSignerWeight, setNewSignerWeight] = useState<number>(1);
  const [newAutonomyMode, setNewAutonomyMode] = useState<'AUTONOMOUS' | 'HUMAN_APPROVAL_ALWAYS'>('AUTONOMOUS');
  const [additionalSigners, setAdditionalSigners] = useState<string[]>([]);
  const [newSignerInput, setNewSignerInput] = useState<string>('');
  const [signerInputError, setSignerInputError] = useState<string>('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [createdAgentCredentials, setCreatedAgentCredentials] = useState<{
    agent: ApiAgent;
    api_key: string;
    stellar_public_key: string;
    stellar_secret_key?: string;
  } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);

  // Dedicated API Configuration & Transaction Runner Modal
  const [configModalData, setConfigModalData] = useState<{
    agent: ApiAgent;
    apiKey?: string;
    stellarSecretKey?: string;
    policy?: ApiPolicy;
  } | null>(null);

  // Edit modal state
  const [editingAgent, setEditingAgent] = useState<ApiAgent | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPolicyId, setEditPolicyId] = useState<string>('');
  const [editSignerWeight, setEditSignerWeight] = useState<number>(1);
  const [editAutonomyMode, setEditAutonomyMode] = useState<'AUTONOMOUS' | 'HUMAN_APPROVAL_ALWAYS'>('AUTONOMOUS');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Quick Create Policy modal inside Agent Create
  const [isQuickPolicyModalOpen, setIsQuickPolicyModalOpen] = useState<boolean>(false);
  const [quickPolicyName, setQuickPolicyName] = useState<string>('');
  const [quickMaxTx, setQuickMaxTx] = useState<string>('25.0');
  const [quickDaily, setQuickDaily] = useState<string>('100.0');
  const [quickWeekly, setQuickWeekly] = useState<string>('500.0');
  const [quickThreshold, setQuickThreshold] = useState<string>('15.0');
  const [quickAlwaysApprove, setQuickAlwaysApprove] = useState<boolean>(false);
  const [isSubmittingQuickPolicy, setIsSubmittingQuickPolicy] = useState<boolean>(false);

  // Available assisting operators for multisig selection
  const [availableOperators, setAvailableOperators] = useState<Array<{ id: string; address: string; alias: string; role: string }>>([]);

  // Assets & PDA Transfers Modal state
  const [assetModalAgent, setAssetModalAgent] = useState<ApiAgent | null>(null);
  const [assetModalTab, setAssetModalTab] = useState<'send' | 'topup'>('send');
  const [assetBalances, setAssetBalances] = useState<Array<{
    asset_code: string;
    balance: string;
    is_native: boolean;
    issuer?: string | null;
  }>>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);
  const [selectedAssetCode, setSelectedAssetCode] = useState<string>('XLM');
  const [destinationType, setDestinationType] = useState<'self' | 'other'>('self');
  const [customDestination, setCustomDestination] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');
  const [transferSuccess, setTransferSuccess] = useState<{
    message: string;
    txHash: string;
    amount: string;
    asset: string;
    destination?: string;
    explorerUrl: string;
  } | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);
  const [isFriendbotFunding, setIsFriendbotFunding] = useState<boolean>(false);

  // Delegate Operator to Agent styled modal state
  const [delegateModalAgent, setDelegateModalAgent] = useState<ApiAgent | null>(null);
  const [delegateAddress, setDelegateAddress] = useState<string>('');
  const [delegateAlias, setDelegateAlias] = useState<string>('');
  const [delegateError, setDelegateError] = useState<string>('');
  const [isSubmittingDelegate, setIsSubmittingDelegate] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agentsData, policiesData, opsData] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getPolicies().catch(() => []),
        api.getOperators().catch(() => []),
      ]);

      const agentList = Array.isArray(agentsData)
        ? agentsData
        : (agentsData as { results?: ApiAgent[] })?.results || [];
      const policyList = Array.isArray(policiesData)
        ? policiesData
        : (policiesData as { results?: ApiPolicy[] })?.results || [];
      const opsList = Array.isArray(opsData)
        ? opsData
        : (opsData as { results?: Array<{ id: string; address: string; alias: string; role: string }> })?.results || [];

      setAgents(agentList);
      setPolicies(policyList);
      setAvailableOperators(opsList);

      setAgents(agentList);
      setPolicies(policyList);

      if (policyList.length > 0 && !newPolicyId) {
        setNewPolicyId(policyList[0].id);
      }
    } catch (e) {
      console.warn('Error fetching agent view data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    const randomSlug = Math.random().toString(36).substring(2, 8);
    setNewAgentId(`agt_${randomSlug}`);
    setNewAgentName('');
    setNewDescription('');
    setNewSignerWeight(1);
    setNewAutonomyMode('AUTONOMOUS');
    setAdditionalSigners([]);
    setNewSignerInput('');
    setSignerInputError('');
    if (policies.length > 0) {
      setNewPolicyId(policies[0].id);
    }
    setCreatedAgentCredentials(null);
    setIsCreateModalOpen(true);
  };

  const handleAddAdditionalSigner = () => {
    const addr = newSignerInput.trim().toUpperCase();
    if (!addr) return;
    if (!/^G[A-Z0-9]{55}$/.test(addr)) {
      setSignerInputError('Must be a valid 56-character Stellar public address (starting with G)');
      return;
    }
    if (controlledWallet.address && addr === controlledWallet.address.toUpperCase()) {
      setSignerInputError('Your connected admin wallet is already registered as Signer 2');
      return;
    }
    if (additionalSigners.includes(addr)) {
      setSignerInputError('This signing wallet address is already added');
      return;
    }
    const updated = [...additionalSigners, addr];
    setAdditionalSigners(updated);
    setNewSignerInput('');
    setSignerInputError('');
  };

  const handleRemoveAdditionalSigner = (index: number) => {
    const updated = additionalSigners.filter((_, i) => i !== index);
    setAdditionalSigners(updated);
    const maxPossible = 2 + updated.length;
    if (newSignerWeight > maxPossible) {
      setNewSignerWeight(maxPossible);
    }
  };

  const openEditModal = (ag: ApiAgent) => {
    setEditingAgent(ag);
    setEditName(ag.name);
    setEditDescription(ag.description);
    setEditPolicyId(ag.policy);
    setEditSignerWeight(ag.autonomy_mode === 'AUTONOMOUS' ? 1 : Math.max(2, ag.signer_weight || 2));
    setEditAutonomyMode(ag.autonomy_mode || 'AUTONOMOUS');
    setEditStatus(ag.status);
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    try {
      setIsSubmittingCreate(true);
      const walletId = controlledWallet.id;
      if (!walletId) throw new Error('Controlled wallet not found');

      const finalWeight = newAutonomyMode === 'AUTONOMOUS' ? 1 : Math.max(2, newSignerWeight || 2);

      const res = await api.createAgent({
        agent_id: newAgentId.trim() || `agt_${Date.now()}`,
        name: newAgentName.trim(),
        description: newDescription.trim(),
        wallet: walletId,
        policy: newPolicyId,
        signer_weight: finalWeight,
        autonomy_mode: newAutonomyMode,
        delegated_operator_addresses: additionalSigners,
      });

      setCreatedAgentCredentials(res);
      setIsCreateModalOpen(false);
      const foundPolicy = policies.find((p) => p.id === newPolicyId);
      setConfigModalData({
        agent: res.agent,
        apiKey: res.api_key,
        stellarSecretKey: res.stellar_secret_key,
        policy: foundPolicy,
      });
      setToastMessage(`Agent ${res.agent.name} successfully created! API Config opened.`);
      fetchData();
    } catch (err: unknown) {
      setToastMessage(`Creation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingCreate(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  const handleEditAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    try {
      setIsSubmittingEdit(true);
      const finalWeight = editAutonomyMode === 'AUTONOMOUS' ? 1 : Math.max(2, editSignerWeight || 2);
      const res = await api.updateAgent(editingAgent.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        policy: editPolicyId,
        signer_weight: finalWeight,
        autonomy_mode: editAutonomyMode,
        status: editStatus,
      });

      setEditingAgent(null);
      setToastMessage(`Agent ${res.name} updated successfully.`);
      fetchData();
    } catch (err: unknown) {
      setToastMessage(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingEdit(false);
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const handleCreateQuickPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPolicyName.trim()) return;

    try {
      setIsSubmittingQuickPolicy(true);
      const created = await api.createPolicy({
        name: quickPolicyName.trim(),
        max_amount_per_tx: quickMaxTx,
        daily_spending_limit: quickDaily,
        weekly_spending_limit: quickWeekly,
        human_approval_threshold: quickThreshold,
        require_human_approval_always: quickAlwaysApprove,
      });

      setPolicies((prev) => [created, ...prev]);
      setNewPolicyId(created.id);
      setIsQuickPolicyModalOpen(false);
      setToastMessage(`Policy "${created.name}" created and assigned!`);
    } catch (err: unknown) {
      setToastMessage(`Failed to create policy: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingQuickPolicy(false);
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const handleToggleKillswitch = async (agent: ApiAgent) => {
    try {
      if (agent.status === 'ACTIVE') {
        await api.emergencyDisableAgent(agent.id);
        setToastMessage(`Emergency Killswitch: Agent ${agent.name} disabled.`);
      } else {
        await api.activateAgent(agent.id);
        setToastMessage(`Agent ${agent.name} re-activated.`);
      }
      fetchData();
    } catch (err: unknown) {
      setToastMessage(`Killswitch action failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const handleRotateKey = async (agent: ApiAgent) => {
    try {
      const res = await api.rotateAgentKey(agent.id);
      const foundPolicy = policies.find((p) => p.id === agent.policy);
      setConfigModalData({
        agent: res.agent,
        apiKey: res.api_key,
        policy: foundPolicy,
      });
      setToastMessage(`Rotated API Key for ${agent.name}. New key displayed in API Config.`);
      fetchData();
    } catch (err: unknown) {
      setToastMessage(`Key rotation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFundPda = async (agent: ApiAgent) => {
    try {
      setToastMessage(`Funding PDA ${agent.stellar_public_key.slice(0, 8)}... via Stellar Testnet Friendbot...`);
      await api.requestAgentFunds(agent.id, 'friendbot');
      setToastMessage(`PDA funded with 10,000 XLM on Stellar Testnet!`);
      fetchData();
    } catch (err: unknown) {
      setToastMessage(`PDA funding failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  const loadAgentBalances = async (agent: ApiAgent) => {
    setIsLoadingBalances(true);
    try {
      const horizonData = await fetchLiveAccountBalances(agent.stellar_public_key).catch(() => null);
      if (horizonData && horizonData.allBalances && horizonData.allBalances.length > 0) {
        const list = [...horizonData.allBalances];
        if (!list.some((a) => a.asset_code === 'USDC')) {
          list.push({ asset_code: 'USDC', balance: '0.00', is_native: false, issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' });
        }
        if (!list.some((a) => a.asset_code === 'EURC')) {
          list.push({ asset_code: 'EURC', balance: '0.00', is_native: false, issuer: 'GDQOE23CFSUMSVQK4Y5JHPP0C4VNMSJ53O234LMNASDFG342' });
        }
        setAssetBalances(list);
      } else {
        const liveApi = await api.getAgentLiveBalance(agent.id).catch(() => null);
        const nativeBal = liveApi?.native_balance || agent.pda_balance_xlm || '10,000.00';
        setAssetBalances([
          { asset_code: 'XLM', balance: nativeBal, is_native: true, issuer: null },
          { asset_code: 'USDC', balance: '0.00', is_native: false, issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
          { asset_code: 'EURC', balance: '0.00', is_native: false, issuer: 'GDQOE23CFSUMSVQK4Y5JHPP0C4VNMSJ53O234LMNASDFG342' },
        ]);
      }
    } catch (err) {
      console.warn('Error fetching PDA balances:', err);
      setAssetBalances([
        { asset_code: 'XLM', balance: agent.pda_balance_xlm || '10,000.00', is_native: true, issuer: null },
        { asset_code: 'USDC', balance: '0.00', is_native: false, issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
      ]);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  const openAssetModal = (agent: ApiAgent, tab: 'send' | 'topup' = 'send', assetCode: string = 'XLM') => {
    setAssetModalAgent(agent);
    setAssetModalTab(tab);
    setSelectedAssetCode(assetCode);
    setDestinationType('self');
    setCustomDestination('');
    setTransferAmount('');
    setTransferError('');
    setTransferSuccess(null);
    loadAgentBalances(agent);
  };

  const handleFriendbotTopup = async () => {
    if (!assetModalAgent) return;
    try {
      setIsFriendbotFunding(true);
      setTransferError('');
      setToastMessage(`Funding PDA ${assetModalAgent.stellar_public_key.slice(0, 8)}... with 10,000 XLM from Friendbot...`);
      await api.requestAgentFunds(assetModalAgent.id, 'friendbot');
      setToastMessage(`Funded PDA with 10,000 XLM on Stellar Testnet!`);
      await loadAgentBalances(assetModalAgent);
      fetchData();
    } catch (err: unknown) {
      setTransferError(`Friendbot top-up failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsFriendbotFunding(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetModalAgent) return;

    const targetAddress = destinationType === 'self'
      ? (assetModalAgent.wallet?.address || controlledWallet.address)
      : customDestination.trim();

    if (!targetAddress || !targetAddress.startsWith('G') || targetAddress.length !== 56) {
      setTransferError('Please provide a valid 56-character Stellar public key (starting with G).');
      return;
    }

    if (transferAmount.trim() !== '' && (isNaN(Number(transferAmount)) || Number(transferAmount) <= 0)) {
      setTransferError('Please enter a valid numeric amount greater than zero.');
      return;
    }

    const curAsset = assetBalances.find((a) => a.asset_code === selectedAssetCode);

    try {
      setIsSubmittingTransfer(true);
      setTransferError('');
      setTransferSuccess(null);
      setToastMessage(`Submitting transfer from PDA to ${targetAddress.slice(0, 8)}...`);

      const res = await api.refundAgentFundsToOwner(assetModalAgent.id, {
        destination: targetAddress,
        asset: selectedAssetCode,
        amount: transferAmount.trim() || undefined,
        asset_issuer: curAsset?.issuer || undefined,
      });

      setTransferSuccess({
        message: res.message || `Successfully transferred ${res.amount} ${selectedAssetCode}`,
        txHash: res.stellar_tx_hash,
        amount: res.amount,
        asset: selectedAssetCode,
        destination: targetAddress,
        explorerUrl: res.explorer_url,
      });

      setToastMessage(`Transferred ${res.amount} ${selectedAssetCode}! Stellar Tx: ${res.stellar_tx_hash.slice(0, 10)}...`);
      setTransferAmount('');
      await loadAgentBalances(assetModalAgent);
      fetchData();
    } catch (err: unknown) {
      setTransferError(`Transfer failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingTransfer(false);
      setTimeout(() => setToastMessage(''), 4500);
    }
  };

  const openDelegateModal = (agent: ApiAgent) => {
    setDelegateModalAgent(agent);
    setDelegateAddress('');
    setDelegateAlias('');
    setDelegateError('');
  };

  const handleConfirmDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateModalAgent) return;
    const addr = delegateAddress.trim();
    if (!addr.startsWith('G') || addr.length !== 56) {
      setDelegateError('Invalid Stellar public key format. Must start with G and be 56 characters.');
      return;
    }
    try {
      setIsSubmittingDelegate(true);
      setDelegateError('');
      await api.delegateOperatorToAgent(delegateModalAgent.id, addr, delegateAlias.trim());
      setToastMessage(`Operator ${addr.slice(0, 8)}... delegated to ${delegateModalAgent.name}!`);
      setDelegateModalAgent(null);
      fetchData();
    } catch (err: unknown) {
      setDelegateError(`Delegation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingDelegate(false);
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const filteredAgents = agents.filter((ag) => {
    if (filter === 'ALL') return true;
    return ag.status === filter;
  });

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in duration-200 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center shadow-inner">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-space text-2xl font-bold text-white tracking-tight">AI Agent Supervision</h1>
            <p className="text-xs sm:text-sm text-white/50">
              Register, manage, and enforce multisig PDA keys and policy boundaries for autonomous agents.
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-[0_4px_16px_rgba(37,99,235,0.35)] transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create AI Agent</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
        {(['ALL', 'ACTIVE', 'DISABLED', 'INACTIVE'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === tab
                ? 'bg-white/[0.1] text-white border border-white/[0.15] shadow-sm'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            }`}
          >
            {tab === 'ALL' ? `All Agents (${agents.length})` : `${tab} (${agents.filter((a) => a.status === tab).length})`}
          </button>
        ))}
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-xs text-white/50">Loading registered agents...</span>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="py-16 px-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex flex-col items-center justify-center text-center gap-3">
          <Bot className="w-10 h-10 text-white/20" />
          <h3 className="font-space text-base font-bold text-white">No agents found</h3>
          <p className="text-xs text-white/50 max-w-md">
            No agents match this filter. Click &quot;Create AI Agent&quot; to provision a new agent with a dedicated PDA address.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create AI Agent</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgents.map((ag) => {
            const isKillswitch = ag.status === 'DISABLED';
            const isAuto = ag.autonomy_mode === 'AUTONOMOUS';

            return (
              <div
                key={ag.id}
                className="p-5 sm:p-6 bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] rounded-2xl flex flex-col justify-between gap-5 shadow-[0_4px_24px_rgba(0,0,0,0.28),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all group"
              >
                <div className="flex flex-col gap-4">
                  {/* Top: Status & Name */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-space font-bold text-white text-base tracking-tight">{ag.name}</h3>
                        <span className="text-[11px] font-mono text-white/40">{ag.agent_id}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                        ag.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                          : ag.status === 'DISABLED'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                          : 'bg-white/10 text-white/50 border border-white/10'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${ag.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {ag.status}
                    </span>
                  </div>

                  <p className="text-xs text-white/60 line-clamp-2 min-h-[32px]">{ag.description || 'No description provided.'}</p>

                  {/* Autonomy Mode & Weight Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                        isAuto
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      }`}
                      title={isAuto ? 'Auto-signs within policy limits' : 'Requires operator approval for all txs'}
                    >
                      {isAuto ? <Zap className="w-3 h-3 text-purple-400" /> : <Lock className="w-3 h-3 text-amber-400" />}
                      <span>{isAuto ? 'Autonomous' : 'Human Approval Required'}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.04] text-white/70 border border-white/[0.08]">
                      <span>Weight: {ag.signer_weight || 1}</span>
                    </span>
                  </div>

                  {/* Policy and PDA key info */}
                  <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
                    <div className="flex items-center justify-between text-white/50 text-[11px]">
                      <span>Assigned Policy</span>
                      <span className="font-semibold text-white/90 truncate max-w-[140px]">{ag.policy_name || 'Policy'}</span>
                    </div>

                    <div className="flex items-center justify-between text-white/50 text-[11px] pt-1 border-t border-white/[0.04]">
                      <span>PDA Address</span>
                      {ag.stellar_public_key ? (
                        <div className="flex items-center gap-1.5 font-mono text-white/80">
                          <span>{ag.stellar_public_key.slice(0, 5)}...{ag.stellar_public_key.slice(-4)}</span>
                          <button
                            onClick={() => copyText(ag.stellar_public_key, `pda_${ag.id}`)}
                            className="hover:text-white transition-colors cursor-pointer"
                            title="Copy PDA address"
                          >
                            {copiedKey === `pda_${ag.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-white/40 hover:text-white" />
                            )}
                          </button>
                          <a
                            href={`https://stellar.expert/explorer/testnet/account/${ag.stellar_public_key}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:text-blue-300 ml-0.5"
                            title="View PDA on Stellar Expert Testnet"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-white/30 italic">Not set</span>
                      )}
                    </div>

                    {ag.pda_tx_hash && (
                      <div className="flex items-center justify-between text-white/50 text-[11px] pt-1 border-t border-white/[0.04]">
                        <span>Policy On-Chain</span>
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${ag.pda_tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono"
                          title="View on-chain ManageData policy entry on Stellar Expert"
                        >
                          <span>ManageData Verified</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-white/50 text-[11px] pt-1 border-t border-white/[0.04]">
                      <span>Delegated Approvers</span>
                      <span className="text-white/80 font-mono text-[11px]">
                        {ag.delegated_operators && ag.delegated_operators.length > 0
                          ? `${ag.delegated_operators.length} Operator(s)`
                          : 'None (Owner only)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-white/50 text-[11px] pt-1 border-t border-white/[0.04]">
                      <span>API Key</span>
                      <div className="flex items-center gap-1.5 font-mono text-emerald-300">
                        <span>{ag.api_key ? `${ag.api_key.slice(0, 15)}...` : `${ag.api_key_prefix}...`}</span>
                        <button
                          onClick={() => copyText(ag.api_key || ag.api_key_prefix, `apikey_${ag.id}`)}
                          className="hover:text-white transition-colors cursor-pointer"
                          title="Copy Full API Key"
                        >
                          {copiedKey === `apikey_${ag.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-white/40 hover:text-white" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categorized Card Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] relative">
                  {/* 1. Primary Direct Action */}
                  <button
                    onClick={() => {
                      const foundPolicy = policies.find((p) => p.id === ag.policy);
                      setConfigModalData({
                        agent: ag,
                        apiKey: ag.api_key || ag.api_key_prefix,
                        stellarSecretKey: ag.stellar_secret_key,
                        policy: foundPolicy,
                      });
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/35 text-blue-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
                    title="Open API & Transaction Runner"
                  >
                    <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>API</span>
                  </button>

                  {/* 2. Manage Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu((prev) =>
                          prev?.agentId === ag.id && prev?.menu === 'manage'
                            ? null
                            : { agentId: ag.id, menu: 'manage' }
                        );
                      }}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        openMenu?.agentId === ag.id && openMenu?.menu === 'manage'
                          ? 'bg-white/[0.12] text-white border-white/25 shadow-sm'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-white/80 hover:text-white'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Manage</span>
                      <ChevronDown
                        className={`w-3 h-3 text-white/50 transition-transform duration-200 ${
                          openMenu?.agentId === ag.id && openMenu?.menu === 'manage' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openMenu?.agentId === ag.id && openMenu?.menu === 'manage' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 bottom-full mb-2 w-60 bg-[#0B111D]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.08)] p-2 z-40 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150"
                      >
                        <span className="text-[10px] uppercase font-bold text-white/40 px-2.5 py-1 tracking-wider">
                          PDA & Delegation
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            openAssetModal(ag);
                          }}
                          className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.07] rounded-xl text-xs text-white/90 hover:text-white transition-all text-left cursor-pointer"
                        >
                          <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">Assets</span>
                            <span className="text-[10px] text-white/50">Send to self/other or top up</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            openDelegateModal(ag);
                          }}
                          className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.07] rounded-xl text-xs text-white/90 hover:text-white transition-all text-left cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4 text-purple-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">Delegate Operator</span>
                            <span className="text-[10px] text-white/50">Assign assisting co-signer</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3. Settings Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu((prev) =>
                          prev?.agentId === ag.id && prev?.menu === 'settings'
                            ? null
                            : { agentId: ag.id, menu: 'settings' }
                        );
                      }}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        openMenu?.agentId === ag.id && openMenu?.menu === 'settings'
                          ? 'bg-white/[0.12] text-white border-white/25 shadow-sm'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-white/80 hover:text-white'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Settings</span>
                      <ChevronDown
                        className={`w-3 h-3 text-white/50 transition-transform duration-200 ${
                          openMenu?.agentId === ag.id && openMenu?.menu === 'settings' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openMenu?.agentId === ag.id && openMenu?.menu === 'settings' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 bottom-full mb-2 w-56 bg-[#0B111D]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.08)] p-2 z-40 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150"
                      >
                        <span className="text-[10px] uppercase font-bold text-white/40 px-2.5 py-1 tracking-wider">
                          Configuration & Security
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            openEditModal(ag);
                          }}
                          className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.07] rounded-xl text-xs text-white/90 hover:text-white transition-all text-left cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">Edit Agent</span>
                            <span className="text-[10px] text-white/50">Modify policy, autonomy, weight</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            handleRotateKey(ag);
                          }}
                          className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.07] rounded-xl text-xs text-white/90 hover:text-white transition-all text-left cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">Rotate API Key</span>
                            <span className="text-[10px] text-white/50">Invalidate & generate new key</span>
                          </div>
                        </button>

                        <div className="my-1 border-t border-white/[0.06]" />

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            handleToggleKillswitch(ag);
                          }}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                            isKillswitch
                              ? 'hover:bg-emerald-500/15 text-emerald-300'
                              : 'hover:bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {isKillswitch ? (
                            <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-semibold">{isKillswitch ? 'Reactivate Agent' : 'Killswitch'}</span>
                            <span className="text-[10px] opacity-75">
                              {isKillswitch ? 'Restore signing permits' : 'Emergency freeze agent'}
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL: CREATE AI AGENT --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl p-6 sm:p-8 bg-[#0d1522]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.1)] flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-space text-lg sm:text-xl font-bold text-white">
                    {createdAgentCredentials ? 'Agent Created Successfully' : 'Create New AI Agent'}
                  </h2>
                  <p className="text-xs text-white/50">
                    {createdAgentCredentials
                      ? 'Securely store the generated Stellar PDA secret key and API key.'
                      : 'Provision an autonomous agent with a unique PDA address & policy boundary.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If Credentials Generated Screen */}
            {createdAgentCredentials ? (
              <div className="flex flex-col gap-5">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-300 text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold">CRITICAL SECURITY WARNING:</span>
                    <p className="mt-0.5 text-white/80">
                      The generated Stellar Secret Key (PDA private key) and API Key are displayed ONLY ONCE. They cannot be recovered after closing this modal.
                    </p>
                  </div>
                </div>

                {/* PDA Address */}
                <div className="flex flex-col gap-1.5 p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                  <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                    Generated Stellar PDA Address (Public Key)
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-white break-all">{createdAgentCredentials.stellar_public_key}</span>
                    <button
                      onClick={() => copyText(createdAgentCredentials.stellar_public_key, 'pda_new')}
                      className="p-1.5 bg-white/[0.06] hover:bg-white/[0.12] rounded-lg text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
                      title="Copy PDA address"
                    >
                      {copiedKey === 'pda_new' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Secret Key */}
                {createdAgentCredentials.stellar_secret_key && (
                  <div className="flex flex-col gap-1.5 p-3.5 bg-rose-500/[0.08] border border-rose-500/25 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">
                        Stellar Secret Key (PDA Private Key)
                      </span>
                      <button
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="text-[11px] text-rose-300/80 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
                      >
                        {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showSecretKey ? 'Hide' : 'Reveal'}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-white break-all">
                        {showSecretKey ? createdAgentCredentials.stellar_secret_key : '•'.repeat(48)}
                      </span>
                      <button
                        onClick={() => copyText(createdAgentCredentials.stellar_secret_key!, 'secret_new')}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg transition-all cursor-pointer shrink-0"
                        title="Copy Secret Key"
                      >
                        {copiedKey === 'secret_new' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* API Key */}
                <div className="flex flex-col gap-1.5 p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                  <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Agent API Key (Full Secret)</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-emerald-300 break-all">{createdAgentCredentials.api_key}</span>
                    <button
                      onClick={() => copyText(createdAgentCredentials.api_key, 'api_new')}
                      className="p-1.5 bg-white/[0.06] hover:bg-white/[0.12] rounded-lg text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
                      title="Copy API Key"
                    >
                      {copiedKey === 'api_new' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer mt-2"
                >
                  I Have Stored These Credentials Safely
                </button>
              </div>
            ) : (
              /* Agent Creation Form */
              <form onSubmit={handleCreateAgent} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Agent ID / Slug</label>
                    <input
                      type="text"
                      required
                      value={newAgentId}
                      onChange={(e) => setNewAgentId(e.target.value)}
                      placeholder="e.g. agt_liquidity_v1"
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Agent Name</label>
                    <input
                      type="text"
                      required
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      placeholder="e.g. Treasury Liquidity Bot"
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/70">Description</label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Operational scope, authorized tasks, schedule..."
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Policy Selector with inline Create Policy option */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white/70">Assigned Policy</label>
                    <button
                      type="button"
                      onClick={() => setIsQuickPolicyModalOpen(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create New Policy</span>
                    </button>
                  </div>

                  <select
                    value={newPolicyId}
                    onChange={(e) => setNewPolicyId(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#141b27] border border-white/[0.12] text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {policies.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#141b27] text-white">
                        {p.name} (Max {p.max_amount_per_tx} XLM / Daily {p.daily_spending_limit} XLM)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Signer Weight & Autonomy Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white/70">PDA Signer Weight</label>
                      {newAutonomyMode === 'AUTONOMOUS' && (
                        <span className="text-[10px] text-amber-400 font-medium">Locked (1)</span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={newAutonomyMode === 'AUTONOMOUS' ? 1 : 2}
                      max={newAutonomyMode === 'AUTONOMOUS' ? 1 : 10}
                      disabled={newAutonomyMode === 'AUTONOMOUS'}
                      value={newAutonomyMode === 'AUTONOMOUS' ? 1 : newSignerWeight}
                      onChange={(e) => setNewSignerWeight(Math.max(2, parseInt(e.target.value) || 2))}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all ${
                        newAutonomyMode === 'AUTONOMOUS'
                          ? 'bg-white/[0.02] border-white/[0.05] text-white/40 cursor-not-allowed'
                          : 'bg-white/[0.04] border-white/[0.1] text-white focus:outline-none focus:border-blue-500'
                      }`}
                    />
                    <span className="text-[10px] text-white/40">
                      {newAutonomyMode === 'AUTONOMOUS'
                        ? 'Weight is strictly locked to 1 in Autonomous Mode.'
                        : 'Default weight: 2 (Multisig 2-of-2 requirement)'}
                    </span>
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Autonomy Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewAutonomyMode('AUTONOMOUS');
                          setNewSignerWeight(1);
                        }}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          newAutonomyMode === 'AUTONOMOUS'
                            ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                            : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                          <Zap className="w-3.5 h-3.5 text-purple-400" />
                          <span>Autonomous</span>
                        </div>
                        <span className="text-[10px] text-white/50">Auto-signs payments (Weight locked to 1)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewAutonomyMode('HUMAN_APPROVAL_ALWAYS');
                          setNewSignerWeight(2);
                        }}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          newAutonomyMode === 'HUMAN_APPROVAL_ALWAYS'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                            : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Approval Always</span>
                        </div>
                        <span className="text-[10px] text-white/50">Defaults to Weight 2 + Admin Wallet Signer</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multisig Signing Setup Card when in Approval Always mode */}
                {newAutonomyMode === 'HUMAN_APPROVAL_ALWAYS' && (
                  <div className="flex flex-col gap-3 p-4 bg-blue-500/[0.08] border border-blue-500/25 rounded-2xl animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-white text-xs">
                          Multisig Signing Architecture (2+ Signatures)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/20">
                        Threshold: {newSignerWeight} of {2 + additionalSigners.length} Signatures
                      </span>
                    </div>

                    <p className="text-[11px] text-white/70">
                      Transactions proposed by this agent will require <strong>{newSignerWeight}</strong> cryptographic signatures before broadcast to Stellar Testnet:
                    </p>

                    {/* Pre-configured Signer 1 & Signer 2 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Signer 1: Agent PDA */}
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[11px] font-bold shrink-0">
                          1
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-white text-[11px] block">Signer 1: AI Agent PDA</span>
                          <span className="text-[10px] text-emerald-400">Auto-signs initial proposal (+1 Weight)</span>
                        </div>
                      </div>

                      {/* Signer 2: User Admin Wallet */}
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-[11px] font-bold shrink-0">
                          2
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-white text-[11px] block">Signer 2: Your Admin Wallet</span>
                          <span className="font-mono text-[10px] text-blue-300 truncate block">
                            {controlledWallet.address ? `${controlledWallet.address.slice(0, 10)}...${controlledWallet.address.slice(-6)}` : 'Connected Wallet (+1 Weight)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Assisting Operators Selection (Added by main owner / user) */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white/80">
                          Select Assisting Operators (Added by Owner)
                        </span>
                        <span className="text-[10px] text-white/40">
                          {availableOperators.length} operator{availableOperators.length === 1 ? '' : 's'} available
                        </span>
                      </div>

                      {availableOperators.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-white/40 text-center">
                          No delegated operators found. You can delegate operators under Wallet Security or enter an address below.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {availableOperators.map((op) => {
                            const isSelected = additionalSigners.includes(op.address);
                            return (
                              <div
                                key={op.id || op.address}
                                onClick={() => {
                                  if (isSelected) {
                                    setAdditionalSigners(additionalSigners.filter((a) => a !== op.address));
                                  } else {
                                    setAdditionalSigners([...additionalSigners, op.address]);
                                  }
                                }}
                                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                                  isSelected
                                    ? 'bg-blue-600/15 border-blue-500/40 text-white'
                                    : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'border-white/30 bg-transparent'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="min-w-0 flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-xs text-white truncate">
                                        {op.alias || 'Assisting Operator'}
                                      </span>
                                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-white/[0.08] text-white/70">
                                        {op.role}
                                      </span>
                                    </div>
                                    <span className="font-mono text-[10px] text-white/40 truncate">
                                      {op.address}
                                    </span>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-semibold shrink-0 ${isSelected ? 'text-blue-300' : 'text-white/40'}`}>
                                  {isSelected ? 'Selected' : 'Add'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Soroban Smart Contract Multisig sync indicator */}
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-[10px] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>
                        Selected signers and threshold <strong>({newSignerWeight})</strong> will be registered directly into the Soroban Smart Contract upon agent creation.
                      </span>
                    </div>

                    {/* Additional Signing Wallets List */}
                    {additionalSigners.length > 0 && (
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-white/[0.06]">
                        <span className="text-[11px] font-semibold text-white/70">
                          Additional Co-Signing Wallets ({additionalSigners.length}):
                        </span>
                        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                          {additionalSigners.map((signerAddr, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {idx + 3}
                                </span>
                                <span className="font-mono text-white/80 truncate">
                                  {signerAddr}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdditionalSigner(idx)}
                                className="p-1 text-white/40 hover:text-rose-400 rounded transition-colors cursor-pointer shrink-0 ml-2"
                                title="Remove signing wallet"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add More Signing Wallets Input */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/[0.06]">
                      <label className="text-[11px] font-semibold text-white/70">
                        Add More Signing Wallets (Optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newSignerInput}
                          onChange={(e) => {
                            setNewSignerInput(e.target.value);
                            setSignerInputError('');
                          }}
                          placeholder="Stellar public address: e.g. GBDF5GHLWUQ..."
                          className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddAdditionalSigner}
                          className="px-3 py-2 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 border border-blue-500/30"
                        >
                          + Add Signer
                        </button>
                      </div>
                      {signerInputError && (
                        <span className="text-[10px] text-rose-400 font-medium">
                          {signerInputError}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    {isSubmittingCreate ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                    <span>{isSubmittingCreate ? 'Generating Keypair...' : 'Generate Agent & PDA'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT AI AGENT --- */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg p-6 sm:p-8 bg-[#0d1522]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.1)] flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-space text-lg sm:text-xl font-bold text-white">Edit AI Agent</h2>
                  <p className="text-xs text-white/50">{editingAgent.agent_id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAgent(null)}
                className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditAgent} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/70">Agent Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/70">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/70">Assigned Policy</label>
                <select
                  value={editPolicyId}
                  onChange={(e) => setEditPolicyId(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#141b27] border border-white/[0.12] text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {policies.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#141b27] text-white">
                      {p.name} (Max {p.max_amount_per_tx} XLM)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white/70">Signer Weight</label>
                    {editAutonomyMode === 'AUTONOMOUS' && (
                      <span className="text-[10px] text-amber-400 font-medium">Locked (1)</span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={editAutonomyMode === 'AUTONOMOUS' ? 1 : 2}
                    max={editAutonomyMode === 'AUTONOMOUS' ? 1 : 10}
                    disabled={editAutonomyMode === 'AUTONOMOUS'}
                    value={editAutonomyMode === 'AUTONOMOUS' ? 1 : editSignerWeight}
                    onChange={(e) => setEditSignerWeight(Math.max(2, parseInt(e.target.value) || 2))}
                    className={`px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all ${
                      editAutonomyMode === 'AUTONOMOUS'
                        ? 'bg-white/[0.02] border-white/[0.05] text-white/40 cursor-not-allowed'
                        : 'bg-white/[0.04] border-white/[0.1] text-white font-mono focus:outline-none focus:border-blue-500'
                    }`}
                  />
                  <span className="text-[10px] text-white/40">
                    {editAutonomyMode === 'AUTONOMOUS'
                      ? 'Weight is locked to 1 in Autonomous Mode.'
                      : 'Weight 2 enables 2-of-2 multisig.'}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/70">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#141b27] border border-white/[0.12] text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/70">Autonomy Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditAutonomyMode('AUTONOMOUS');
                      setEditSignerWeight(1);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                      editAutonomyMode === 'AUTONOMOUS'
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold">Autonomous</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditAutonomyMode('HUMAN_APPROVAL_ALWAYS');
                      if (editSignerWeight < 2) setEditSignerWeight(2);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                      editAutonomyMode === 'HUMAN_APPROVAL_ALWAYS'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold">Approval Always</span>
                  </button>
                </div>
              </div>

              {editAutonomyMode === 'HUMAN_APPROVAL_ALWAYS' && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-white block">Second Signer: Admin Wallet Active</span>
                    <p className="text-[11px] font-mono text-blue-300 truncate">{controlledWallet.address}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- INLINE MODAL: QUICK CREATE POLICY --- */}
      {isQuickPolicyModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md p-6 bg-[#0e1624] border border-white/[0.14] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="font-space font-bold text-white text-base">Create Financial Policy</h3>
              </div>
              <button
                onClick={() => setIsQuickPolicyModalOpen(false)}
                className="text-white/50 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickPolicy} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-white/70 font-semibold">Policy Name</label>
                <input
                  type="text"
                  required
                  value={quickPolicyName}
                  onChange={(e) => setQuickPolicyName(e.target.value)}
                  placeholder="e.g. Micro-Payments Policy"
                  className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-white/70 font-semibold">Max Per Tx (XLM)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={quickMaxTx}
                    onChange={(e) => setQuickMaxTx(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-white/70 font-semibold">Approval Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={quickThreshold}
                    onChange={(e) => setQuickThreshold(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-white/70 font-semibold">Daily Limit (XLM)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={quickDaily}
                    onChange={(e) => setQuickDaily(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-white/70 font-semibold">Weekly Limit (XLM)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={quickWeekly}
                    onChange={(e) => setQuickWeekly(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsQuickPolicyModalOpen(false)}
                  className="px-3 py-2 text-white/60 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickPolicy}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-md transition-all cursor-pointer"
                >
                  {isSubmittingQuickPolicy ? 'Creating...' : 'Save & Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: AGENT PDA ASSETS & TRANSFERS (TOP-UP / SEND TO SELF OR OTHER) --- */}
      {assetModalAgent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0B111D]/98 backdrop-blur-2xl border border-white/[0.14] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.08)] flex flex-col gap-5 p-5 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-space font-bold text-white text-lg">Agent PDA Assets</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                      On-Chain
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5 font-mono">
                    <span>{assetModalAgent.name}</span>
                    <span>•</span>
                    <span className="text-[11px] text-white/40">
                      {assetModalAgent.stellar_public_key.slice(0, 6)}...{assetModalAgent.stellar_public_key.slice(-6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(assetModalAgent.stellar_public_key);
                        setToastMessage('Copied PDA address!');
                        setTimeout(() => setToastMessage(''), 2000);
                      }}
                      className="text-white/40 hover:text-white transition-colors cursor-pointer"
                      title="Copy PDA Public Key"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${assetModalAgent.stellar_public_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="View on StellarExpert"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssetModalAgent(null)}
                className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Assets Section */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Holdings Breakdown
                </span>
                <button
                  type="button"
                  disabled={isLoadingBalances}
                  onClick={() => loadAgentBalances(assetModalAgent)}
                  className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                  <span>Refresh Balances</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {assetBalances.map((item) => {
                  const isSelected = selectedAssetCode === item.asset_code;
                  return (
                    <div
                      key={item.asset_code}
                      onClick={() => setSelectedAssetCode(item.asset_code)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-space font-bold text-sm text-white">{item.asset_code}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                          item.is_native
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {item.is_native ? 'Native' : 'Token'}
                        </span>
                      </div>
                      <div>
                        <div className="font-space font-bold text-base text-white tabular-nums truncate">
                          {item.balance}
                        </div>
                        {item.is_native && (
                          <div className="text-[10px] text-white/40 mt-0.5">
                            Avail: {Math.max(0, parseFloat(item.balance.replace(/,/g, '')) - 2.0).toFixed(2)} XLM (2 XLM res.)
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssetCode(item.asset_code);
                            setAssetModalTab('send');
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-white/[0.05] hover:bg-emerald-500/20 text-[10px] font-semibold text-white/80 hover:text-emerald-300 border border-white/[0.06] transition-all text-center cursor-pointer"
                        >
                          Send
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssetCode(item.asset_code);
                            setAssetModalTab('topup');
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-white/[0.05] hover:bg-blue-500/20 text-[10px] font-semibold text-white/80 hover:text-blue-300 border border-white/[0.06] transition-all text-center cursor-pointer"
                        >
                          Top up
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Tabs: Send / Refund vs Top up */}
            <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
              <button
                type="button"
                onClick={() => setAssetModalTab('send')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  assetModalTab === 'send'
                    ? 'bg-emerald-500 text-[#09101A] font-bold shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Send / Refund Asset</span>
              </button>
              <button
                type="button"
                onClick={() => setAssetModalTab('topup')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  assetModalTab === 'topup'
                    ? 'bg-blue-500 text-white font-bold shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Top up PDA</span>
              </button>
            </div>

            {/* Tab 1 Content: Send / Refund */}
            {assetModalTab === 'send' && (
              <form onSubmit={handleConfirmTransfer} className="flex flex-col gap-4 text-xs">
                {/* Destination Choice: Self vs Other */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/70 font-semibold">Recipient Destination</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDestinationType('self')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        destinationType === 'self'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Send to Self (Master Wallet)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationType('other')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        destinationType === 'other'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Send to Other Wallet</span>
                    </button>
                  </div>
                </div>

                {destinationType === 'self' ? (
                  <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/50">Master Wallet Address:</span>
                      <span className="text-emerald-400 font-semibold font-mono">
                        {(assetModalAgent.wallet?.address || controlledWallet.address || '').slice(0, 8)}...{(assetModalAgent.wallet?.address || controlledWallet.address || '').slice(-6)}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40">
                      Funds will be securely refunded from this AI Agent's PDA back into your signup master wallet.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/70 font-semibold">Other Stellar Address (G...)</label>
                    <input
                      type="text"
                      required
                      placeholder="GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE"
                      value={customDestination}
                      onChange={(e) => {
                        setCustomDestination(e.target.value);
                        setTransferError('');
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Asset & Amount Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/70 font-semibold">Select Asset</label>
                    <select
                      value={selectedAssetCode}
                      onChange={(e) => setSelectedAssetCode(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl bg-[#09101A] border border-white/[0.1] text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {assetBalances.map((a) => (
                        <option key={a.asset_code} value={a.asset_code} className="bg-[#09101A] text-white">
                          {a.asset_code} (Bal: {a.balance})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-white/70 font-semibold">Amount to Send</label>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = assetBalances.find((a) => a.asset_code === selectedAssetCode);
                          if (cur) {
                            const raw = parseFloat(cur.balance.replace(/,/g, ''));
                            if (cur.is_native) {
                              const maxTransfer = Math.max(0, raw - 2.0);
                              setTransferAmount(maxTransfer > 0 ? maxTransfer.toFixed(2) : '0');
                            } else {
                              setTransferAmount(raw.toFixed(2));
                            }
                          }
                        }}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                      >
                        Max {selectedAssetCode === 'XLM' ? '(reserve held)' : ''}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 50.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {transferError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{transferError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {transferSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs rounded-xl flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{transferSuccess.message}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/60 font-mono mt-0.5">
                      <span>Tx: {transferSuccess.txHash.slice(0, 14)}...</span>
                      <a
                        href={transferSuccess.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline flex items-center gap-0.5"
                      >
                        <span>StellarExpert</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setAssetModalAgent(null)}
                    className="px-4 py-2 text-white/60 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTransfer}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-[#09101A] rounded-xl font-bold shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSubmittingTransfer ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending On-Chain...</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Confirm & Send {selectedAssetCode}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2 Content: Top Up */}
            {assetModalTab === 'topup' && (
              <div className="flex flex-col gap-4 text-xs">
                {/* Method 1: Instant Friendbot Top-up */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/25 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-space font-bold text-white text-sm">Instant Friendbot Top-up</h4>
                        <span className="text-[11px] text-white/50">Stellar Testnet Faucet</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-400">+10,000 XLM</span>
                  </div>
                  <p className="text-white/60 text-xs">
                    Instantly credit this AI Agent's PDA on the Stellar Testnet network for transaction fees and operations with a single click.
                  </p>
                  <button
                    type="button"
                    disabled={isFriendbotFunding}
                    onClick={handleFriendbotTopup}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isFriendbotFunding ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Requesting from Friendbot...</span>
                      </>
                    ) : (
                      <>
                        <Coins className="w-3.5 h-3.5" />
                        <span>Top up +10,000 XLM Now</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Method 2: Deposit from Connected / Master Wallet */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-space font-bold text-white text-sm">Deposit from External / Master Wallet</h4>
                      <span className="text-[11px] text-white/50">Deposit XLM, USDC, or EURC</span>
                    </div>
                  </div>
                  <p className="text-white/60 text-xs">
                    Send funds to this AI Agent's PDA address directly from your connected wallet or any Stellar wallet:
                  </p>
                  <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl flex items-center justify-between font-mono text-[11px] text-white/80 break-all">
                    <span className="select-all">{assetModalAgent.stellar_public_key}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(assetModalAgent.stellar_public_key);
                        setToastMessage('Copied PDA Public Key!');
                        setTimeout(() => setToastMessage(''), 2000);
                      }}
                      className="ml-2 p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
                      title="Copy Address"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setAssetModalAgent(null)}
                    className="px-4 py-2 text-white/60 hover:text-white cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: DELEGATE OPERATOR TO AGENT --- */}
      {delegateModalAgent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md p-6 sm:p-7 bg-[#0d1522]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.7)] flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-space font-bold text-white text-base">Delegate Operator</h3>
                  <span className="text-[11px] text-white/50">For Agent: {delegateModalAgent.name}</span>
                </div>
              </div>
              <button
                onClick={() => setDelegateModalAgent(null)}
                className="text-white/50 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelegate} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/70 font-semibold">Stellar Wallet Address (G...)</label>
                <input
                  type="text"
                  required
                  placeholder="GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE"
                  value={delegateAddress}
                  onChange={(e) => {
                    setDelegateAddress(e.target.value);
                    setDelegateError('');
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white/70 font-semibold">Operator Alias / Role Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Risk Auditor / Senior Signer"
                  value={delegateAlias}
                  onChange={(e) => setDelegateAlias(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>

              {delegateError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{delegateError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setDelegateModalAgent(null)}
                  className="px-4 py-2 text-white/60 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDelegate}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md transition-all cursor-pointer"
                >
                  {isSubmittingDelegate ? 'Delegating...' : 'Delegate Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: AGENT API CONFIG & TRANSACTION RUNNER --- */}
      {configModalData && (
        <AgentApiConfigModal
          agent={configModalData.agent}
          initialApiKey={configModalData.apiKey}
          initialStellarSecretKey={configModalData.stellarSecretKey}
          policy={configModalData.policy || policies.find((p) => p.id === configModalData.agent.policy)}
          walletAddress={controlledWallet.address}
          onClose={() => setConfigModalData(null)}
          onRequestCreated={onRequestCreated}
          onNavigateToRequests={() => {
            setConfigModalData(null);
            navigate('/requests');
          }}
        />
      )}
    </div>
  );
};
