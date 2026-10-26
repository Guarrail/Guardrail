import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ControlledWalletState } from '../types';
import { api, ApiAgent, ApiPolicy } from '../services/api';
import { AgentApiConfigModal } from './AgentApiConfigModal';
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

  // Creation modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newAgentId, setNewAgentId] = useState<string>('');
  const [newAgentName, setNewAgentName] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newPolicyId, setNewPolicyId] = useState<string>('');
  const [newSignerWeight, setNewSignerWeight] = useState<number>(1);
  const [newAutonomyMode, setNewAutonomyMode] = useState<'AUTONOMOUS' | 'HUMAN_APPROVAL_ALWAYS'>('AUTONOMOUS');
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agentsData, policiesData] = await Promise.all([
        api.getAgents().catch(() => []),
        api.getPolicies().catch(() => []),
      ]);

      const agentList = Array.isArray(agentsData)
        ? agentsData
        : (agentsData as { results?: ApiAgent[] })?.results || [];
      const policyList = Array.isArray(policiesData)
        ? policiesData
        : (policiesData as { results?: ApiPolicy[] })?.results || [];

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
    if (policies.length > 0) {
      setNewPolicyId(policies[0].id);
    }
    setCreatedAgentCredentials(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (ag: ApiAgent) => {
    setEditingAgent(ag);
    setEditName(ag.name);
    setEditDescription(ag.description);
    setEditPolicyId(ag.policy);
    setEditSignerWeight(ag.signer_weight || 1);
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

      const res = await api.createAgent({
        agent_id: newAgentId.trim() || `agt_${Date.now()}`,
        name: newAgentName.trim(),
        description: newDescription.trim(),
        wallet: walletId,
        policy: newPolicyId,
        signer_weight: newSignerWeight,
        autonomy_mode: newAutonomyMode,
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
      const res = await api.updateAgent(editingAgent.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        policy: editPolicyId,
        signer_weight: editSignerWeight,
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

  const handleRefundToOwner = async (agent: ApiAgent) => {
    const amountStr = prompt(`Enter amount of XLM to return from PDA to owner wallet (leave blank for all available):`);
    if (amountStr !== null && amountStr.trim() !== '' && isNaN(Number(amountStr))) {
      alert('Please enter a valid numeric amount.');
      return;
    }
    try {
      setToastMessage(`Submitting on-chain refund from PDA to owner wallet on Stellar Testnet...`);
      const res = await api.refundAgentFundsToOwner(agent.id, amountStr?.trim() || undefined);
      setToastMessage(`Refunded ${res.amount} XLM to owner! Stellar Tx: ${res.stellar_tx_hash.slice(0, 10)}...`);
      fetchData();
    } catch (err: unknown) {
      setToastMessage(`Refund failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => setToastMessage(''), 4500);
    }
  };

  const handleDelegateModal = (agent: ApiAgent) => {
    const address = prompt(`Enter Stellar wallet address (G...) to delegate to agent "${agent.name}":`);
    if (!address || !address.trim().startsWith('G') || address.trim().length !== 56) {
      if (address) alert('Invalid Stellar public key format. Must start with G and be 56 characters.');
      return;
    }
    const alias = prompt('Enter alias/name for this delegated operator (optional):') || '';
    api.delegateOperatorToAgent(agent.id, address.trim(), alias)
      .then((res) => {
        setToastMessage(`Operator ${address.slice(0, 8)} delegated to ${agent.name}!`);
        fetchData();
        setTimeout(() => setToastMessage(''), 3500);
      })
      .catch((err) => {
        setToastMessage(`Delegation failed: ${err instanceof Error ? err.message : String(err)}`);
        setTimeout(() => setToastMessage(''), 3500);
      });
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

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06] flex-wrap">
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
                    className="flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 px-2.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    title="Open API Configuration & Transaction Runner"
                  >
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    <span>API Config</span>
                  </button>

                  <button
                    onClick={() => handleFundPda(ag)}
                    className="flex items-center justify-center gap-1 py-2 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    title="Fund PDA with 10,000 XLM on Stellar Testnet via Friendbot"
                  >
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Top-up PDA</span>
                  </button>

                  <button
                    onClick={() => handleRefundToOwner(ag)}
                    className="flex items-center justify-center gap-1 py-2 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    title="Refund PDA funds back to your signup wallet"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>Refund</span>
                  </button>

                  <button
                    onClick={() => handleDelegateModal(ag)}
                    className="flex items-center justify-center gap-1 py-2 px-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    title="Delegate another operator to approve transactions"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-purple-400" />
                    <span>Delegate</span>
                  </button>

                  <button
                    onClick={() => openEditModal(ag)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleRotateKey(ag)}
                    className="flex items-center justify-center p-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 hover:text-white rounded-xl transition-all cursor-pointer"
                    title="Rotate API Key"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleKillswitch(ag)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isKillswitch
                        ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {isKillswitch ? <Play className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    <span>{isKillswitch ? 'Reactivate' : 'Killswitch'}</span>
                  </button>
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
                    <label className="text-xs font-semibold text-white/70">PDA Signer Weight</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newSignerWeight}
                      onChange={(e) => setNewSignerWeight(parseInt(e.target.value) || 1)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <span className="text-[10px] text-white/40">Default weight: 1 (Multisig med threshold: 2)</span>
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Autonomy Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAutonomyMode('AUTONOMOUS')}
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
                        <span className="text-[10px] text-white/50">Auto-signs payments within policy limits</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewAutonomyMode('HUMAN_APPROVAL_ALWAYS')}
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
                        <span className="text-[10px] text-white/50">Requires human co-signing for every tx</span>
                      </button>
                    </div>
                  </div>
                </div>

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
                  <label className="text-xs font-semibold text-white/70">Signer Weight</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editSignerWeight}
                    onChange={(e) => setEditSignerWeight(parseInt(e.target.value) || 1)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
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
                    onClick={() => setEditAutonomyMode('AUTONOMOUS')}
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
                    onClick={() => setEditAutonomyMode('HUMAN_APPROVAL_ALWAYS')}
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
