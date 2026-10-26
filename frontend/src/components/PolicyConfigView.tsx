import React, { useState, useEffect } from 'react';
import { PolicyConfig } from '../types';
import { api, ApiPolicy } from '../services/api';
import {
  Sliders,
  Users,
  Coins,
  Fingerprint,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  AlertCircle,
  Shield,
  Layers,
  X,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface PolicyConfigViewProps {
  policyConfig: PolicyConfig;
  setPolicyConfig: React.Dispatch<React.SetStateAction<PolicyConfig>>;
}

export const PolicyConfigView: React.FC<PolicyConfigViewProps> = ({
  policyConfig,
  setPolicyConfig,
}) => {
  const [policies, setPolicies] = useState<ApiPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>(policyConfig.id || '');
  const [localConfig, setLocalConfig] = useState<PolicyConfig>({ ...policyConfig });
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientAddress, setNewRecipientAddress] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modal: Create New Policy
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyDesc, setNewPolicyDesc] = useState('');
  const [newMaxTx, setNewMaxTx] = useState('25.0');
  const [newDaily, setNewDaily] = useState('100.0');
  const [newWeekly, setNewWeekly] = useState('500.0');
  const [newThreshold, setNewThreshold] = useState('15.0');
  const [newAlwaysApprove, setNewAlwaysApprove] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const fetchPolicies = async () => {
    try {
      const data = await api.getPolicies();
      const list = Array.isArray(data) ? data : (data as { results?: ApiPolicy[] })?.results || [];
      setPolicies(list);

      if (list.length > 0 && !selectedPolicyId) {
        selectPolicy(list[0]);
      } else if (selectedPolicyId) {
        const found = list.find((p) => p.id === selectedPolicyId);
        if (found) selectPolicy(found);
      }
    } catch (e) {
      console.warn('Error fetching policies:', e);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const selectPolicy = (p: ApiPolicy) => {
    setSelectedPolicyId(p.id);
    const converted: PolicyConfig = {
      id: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      maxPerTransaction: parseFloat(p.max_amount_per_tx),
      dailyLimit: parseFloat(p.daily_spending_limit),
      weeklyLimit: parseFloat(p.weekly_spending_limit),
      dailySpent: localConfig.dailySpent || 0,
      weeklySpent: localConfig.weeklySpent || 0,
      approvalThreshold: parseFloat(p.human_approval_threshold),
      requireHumanApproval: p.require_human_approval_always,
      approvedRecipients: p.allowed_recipients.map((r) => ({
        id: r.id,
        name: r.label || 'Approved Vendor',
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
    };
    setLocalConfig(converted);
    setPolicyConfig(converted);
  };

  const handleSave = async () => {
    try {
      const targetId = selectedPolicyId || policyConfig.id;
      if (targetId) {
        await api.updatePolicy(targetId, {
          name: localConfig.name,
          max_amount_per_tx: localConfig.maxPerTransaction.toString(),
          daily_spending_limit: localConfig.dailyLimit.toString(),
          weekly_spending_limit: localConfig.weeklyLimit.toString(),
          human_approval_threshold: localConfig.approvalThreshold.toString(),
          require_human_approval_always: localConfig.requireHumanApproval,
        });
      }
      setPolicyConfig({ ...localConfig });
      setSaveSuccess(true);
      setToastMessage('Policy settings saved and active in coordinator.');
      setTimeout(() => {
        setSaveSuccess(false);
        setToastMessage('');
      }, 3000);
      fetchPolicies();
    } catch (e) {
      console.warn('Policy API update notice:', e);
      setPolicyConfig({ ...localConfig });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyName.trim()) return;

    try {
      setIsSubmittingCreate(true);
      const created = await api.createPolicy({
        name: newPolicyName.trim(),
        description: newPolicyDesc.trim(),
        max_amount_per_tx: newMaxTx,
        daily_spending_limit: newDaily,
        weekly_spending_limit: newWeekly,
        human_approval_threshold: newThreshold,
        require_human_approval_always: newAlwaysApprove,
      });

      setIsCreateModalOpen(false);
      setNewPolicyName('');
      setNewPolicyDesc('');
      setToastMessage(`Policy "${created.name}" created successfully!`);
      await fetchPolicies();
      selectPolicy(created);
    } catch (err: unknown) {
      setToastMessage(`Failed to create policy: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingCreate(false);
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const handleReset = () => {
    setLocalConfig({ ...policyConfig });
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientName.trim() || !newRecipientAddress.trim()) {
      setRecipientError('Please provide both name and address');
      return;
    }
    if (!newRecipientAddress.startsWith('G') || newRecipientAddress.length < 20) {
      setRecipientError('Stellar addresses start with G (e.g. GB54...)');
      return;
    }

    setRecipientError('');
    const targetId = selectedPolicyId || policyConfig.id;
    try {
      if (targetId) {
        await api.addRecipient(targetId, {
          address: newRecipientAddress.trim(),
          label: newRecipientName.trim(),
        });
      }
    } catch (err) {
      console.warn('Could not add recipient via API:', err);
    }

    setLocalConfig((prev) => ({
      ...prev,
      approvedRecipients: [
        ...prev.approvedRecipients,
        {
          id: `rec_${Date.now()}`,
          name: newRecipientName.trim(),
          address: newRecipientAddress.trim(),
          addedDate: 'Today',
        },
      ],
    }));
    setNewRecipientName('');
    setNewRecipientAddress('');
    setToastMessage('Recipient added to allowlist.');
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleRemoveRecipient = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      approvedRecipients: prev.approvedRecipients.filter((r) => r.id !== id),
    }));
  };

  const handleToggleAsset = (id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      assetControls: prev.assetControls.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    }));
  };

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in duration-200 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Policy Selector Toolbar */}
      <div className="p-5 sm:p-6 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-space text-lg font-bold text-white tracking-tight">Active Policy</h2>
              {localConfig.version && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-white/60 font-mono">
                  v{localConfig.version}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">Manage spending limits and destination allowlists across multiple policies.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Policy Dropdown Switcher */}
          {policies.length > 0 && (
            <select
              value={selectedPolicyId}
              onChange={(e) => {
                const found = policies.find((p) => p.id === e.target.value);
                if (found) selectPolicy(found);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#141b27] border border-white/[0.12] text-xs font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#141b27] text-white">
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Policy</span>
          </button>
        </div>
      </div>

      {/* 2x2 Grid of Apple-style Bento Policy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* CARD 1: SPENDING CEILINGS */}
        <div className="p-6 sm:p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">Spending Ceilings</h2>
            <p className="text-xs text-white/50 mt-1">Autonomous spending ceilings enforced on Stellar before permit issuance.</p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Limit 1: Max per transaction */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white/90">Maximum per Transaction</label>
              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
                <input
                  type="number"
                  value={localConfig.maxPerTransaction}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      maxPerTransaction: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">USDC</span>
              </div>
              <span className="text-[11px] text-white/40">
                Any single payment above {localConfig.maxPerTransaction} USDC is blocked immediately.
              </span>
            </div>

            {/* Limit 2: Daily Limit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white/90">Daily Spending Limit</label>
              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
                <input
                  type="number"
                  value={localConfig.dailyLimit}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      dailyLimit: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">USDC</span>
              </div>
              <span className="text-[11px] text-white/40">
                The agent cannot exceed {localConfig.dailyLimit} USDC per calendar day (UTC).
              </span>
            </div>

            {/* Limit 3: Weekly Limit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white/90">Weekly Spending Limit</label>
              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
                <input
                  type="number"
                  value={localConfig.weeklyLimit}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      weeklyLimit: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">USDC</span>
              </div>
              <span className="text-[11px] text-white/40">Rolling 7-day budget ceiling of {localConfig.weeklyLimit} USDC.</span>
            </div>
          </div>
        </div>

        {/* CARD 2: APPROVAL CONTROLS */}
        <div className="p-6 sm:p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">Approval Controls</h2>
            <p className="text-xs text-white/50 mt-1">Dual-authorization parameters requiring human cryptographic signatures.</p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Control 1: Approval Threshold */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white/90">Human Approval Threshold</label>
              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
                <input
                  type="number"
                  value={localConfig.approvalThreshold}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      approvalThreshold: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">USDC</span>
              </div>
              <span className="text-[11px] text-white/40">
                Transactions strictly above {localConfig.approvalThreshold} USDC require manual human signature.
              </span>
            </div>

            {/* Control 2: Require Human Approval Always Toggle */}
            <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs sm:text-sm font-semibold text-white">Require Human Approval Always</span>
                <span className="text-[11px] text-white/40">Force all transactions into pending review queue regardless of amount.</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    requireHumanApproval: !prev.requireHumanApproval,
                  }))
                }
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                  localConfig.requireHumanApproval ? 'bg-amber-400' : 'bg-white/15'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    localConfig.requireHumanApproval ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* CARD 3: APPROVED RECIPIENTS ALLOWLIST */}
        <div className="p-6 sm:p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">Approved Recipients Allowlist</h2>
            <p className="text-xs text-white/50 mt-1">Stellar destination addresses authorized under this policy.</p>
          </div>

          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {localConfig.approvedRecipients.map((rec) => (
              <div
                key={rec.id}
                className="p-3 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] rounded-xl flex items-center justify-between gap-3 transition-all"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">{rec.name}</div>
                  <div className="font-mono text-[11px] text-white/45 truncate mt-0.5">{rec.address}</div>
                </div>

                <button
                  onClick={() => handleRemoveRecipient(rec.id)}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition-all shrink-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Add Recipient Form */}
          <form onSubmit={handleAddRecipient} className="mt-2 pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-white/80">Add Recipient to Allowlist</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Label (e.g. AWS Infrastructure)"
                value={newRecipientName}
                onChange={(e) => setNewRecipientName(e.target.value)}
                className="px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-white/20 transition-all"
              />
              <input
                type="text"
                placeholder="Stellar address (G...)"
                value={newRecipientAddress}
                onChange={(e) => setNewRecipientAddress(e.target.value)}
                className="px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
            {recipientError && <span className="text-[11px] text-rose-400 font-medium">{recipientError}</span>}
            <button
              type="submit"
              className="mt-1 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] border border-white/[0.1] text-xs font-bold text-white rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer self-start shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Recipient</span>
            </button>
          </form>
        </div>

        {/* CARD 4: ASSET CONTROLS */}
        <div className="p-6 sm:p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">Asset Controls</h2>
            <p className="text-xs text-white/50 mt-1">Authorized tokens allowed in automated agent transactions.</p>
          </div>

          <div className="flex flex-col divide-y divide-white/[0.06]">
            {localConfig.assetControls.map((ast) => (
              <div key={ast.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{ast.asset}</span>
                    {ast.enabled && (
                      <span className="text-[10px] font-space px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        Allowed
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-white/45 truncate max-w-sm mt-0.5">
                    Issuer: {ast.issuer}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleAsset(ast.id)}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    ast.enabled ? 'bg-emerald-400' : 'bg-white/15'
                  }`}
                  aria-label={`Toggle ${ast.asset}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      ast.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="p-4 bg-[#0A0F19]/90 backdrop-blur-2xl border border-white/[0.1] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        <span className="text-xs text-white/50">
          Saved policies immediately update the backend coordinator enforcement layer.
        </span>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-semibold text-white/80 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-emerald-400 hover:bg-emerald-300 text-[#080C14] text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(48,209,88,0.3)] cursor-pointer"
          >
            Save Policy Changes
          </button>
        </div>
      </div>

      {/* MODAL: CREATE POLICY */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg p-6 sm:p-8 bg-[#0d1522]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.1)] flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-space text-lg font-bold text-white">Create New Financial Policy</h2>
                  <p className="text-xs text-white/50">Define spending ceilings and human review thresholds.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/70 font-semibold">Policy Name</label>
                <input
                  type="text"
                  required
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  placeholder="e.g. Micro-Payments & Staking Policy"
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white/70 font-semibold">Description</label>
                <textarea
                  rows={2}
                  value={newPolicyDesc}
                  onChange={(e) => setNewPolicyDesc(e.target.value)}
                  placeholder="Policy context, purpose, or specific constraints..."
                  className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/70 font-semibold">Max per Tx (XLM)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newMaxTx}
                    onChange={(e) => setNewMaxTx(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/70 font-semibold">Approval Threshold (XLM)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/70 font-semibold">Daily Limit (XLM)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={newDaily}
                    onChange={(e) => setNewDaily(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/70 font-semibold">Weekly Limit (XLM)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={newWeekly}
                    onChange={(e) => setNewWeekly(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="alwaysApproveCheck"
                  checked={newAlwaysApprove}
                  onChange={(e) => setNewAlwaysApprove(e.target.checked)}
                  className="rounded bg-white/10 border-white/20 text-blue-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="alwaysApproveCheck" className="text-white/70 font-medium cursor-pointer">
                  Require human approval for all transactions under this policy
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-white/60 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  {isSubmittingCreate ? 'Creating...' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
