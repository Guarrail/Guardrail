import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PolicyConfig } from '../types';
import { api, ApiPolicy } from '../services/api';
import {
  Shield,
  ArrowLeft,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';

interface EditPolicyPageProps {
  policyConfig: PolicyConfig;
  setPolicyConfig: React.Dispatch<React.SetStateAction<PolicyConfig>>;
}

export const EditPolicyPage: React.FC<EditPolicyPageProps> = ({
  policyConfig,
  setPolicyConfig,
}) => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const policyId = paramId || searchParams.get('id') || policyConfig.id || '';

  const [policyData, setPolicyData] = useState<ApiPolicy | null>(null);
  const [localConfig, setLocalConfig] = useState<PolicyConfig>({ ...policyConfig });
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientAddress, setNewRecipientAddress] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        const data = await api.getPolicies();
        const list = Array.isArray(data) ? data : (data as { results?: ApiPolicy[] })?.results || [];
        const found = list.find((p) => p.id === policyId) || list[0];
        if (found) {
          setPolicyData(found);
          const converted: PolicyConfig = {
            id: found.id,
            name: found.name,
            description: found.description,
            version: found.version,
            maxPerTransaction: parseFloat(found.max_amount_per_tx),
            dailyLimit: parseFloat(found.daily_spending_limit),
            weeklyLimit: parseFloat(found.weekly_spending_limit),
            dailySpent: localConfig.dailySpent || 0,
            weeklySpent: localConfig.weeklySpent || 0,
            approvalThreshold: parseFloat(found.human_approval_threshold),
            requireHumanApproval: found.require_human_approval_always,
            approvedRecipients: (found.allowed_recipients || []).map((r) => ({
              id: r.id,
              name: r.label || 'Approved Destination',
              address: r.address,
              addedDate: r.created_at,
            })),
            assetControls: (found.allowed_assets || []).map((a) => ({
              id: a.id,
              asset: a.asset_code,
              issuer: a.issuer_address || 'Native',
              enabled: a.is_active,
              isNative: a.asset_code === 'XLM',
            })),
          };
          setLocalConfig(converted);
        }
      } catch (err) {
        console.warn('Error loading policy:', err);
      } finally {
        setLoading(false);
      }
    };

    if (policyId) {
      loadPolicy();
    }
  }, [policyId]);

  const handleSave = async () => {
    try {
      if (policyId) {
        await api.updatePolicy(policyId, {
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
      setToastMessage('Policy settings saved and synchronized.');
      setTimeout(() => {
        setSaveSuccess(false);
        setToastMessage('');
      }, 3000);
    } catch (err: unknown) {
      setToastMessage(`Failed to save policy: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientName.trim() || !newRecipientAddress.trim()) {
      setRecipientError('Please provide both label and address');
      return;
    }
    if (!newRecipientAddress.startsWith('G') || newRecipientAddress.length < 20) {
      setRecipientError('Stellar addresses start with G (e.g. GB54...)');
      return;
    }

    setRecipientError('');
    try {
      if (policyId) {
        await api.addRecipient(policyId, {
          address: newRecipientAddress.trim(),
          label: newRecipientName.trim(),
        });
      }
    } catch (err) {
      console.warn('Add recipient error:', err);
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

  if (loading) {
    return (
      <div className="p-12 text-center text-white/50 font-manrope">
        Loading policy configuration...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-6xl mx-auto w-full font-manrope">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/policies')}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/60 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Policies</span>
        </button>

        <span className="text-xs text-white/40 font-mono">ID: {policyId.slice(0, 8)}...</span>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in duration-200 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 sm:p-8 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-space text-2xl font-bold text-white tracking-tight">
                {localConfig.name}
              </h1>
              {localConfig.version && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-white/70 font-mono">
                  v{localConfig.version}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-white/50 mt-0.5">
              {localConfig.description || 'Modify spending limits, approval triggers, and allowlists.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/policies')}
            className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-semibold text-white/70 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-emerald-400 hover:bg-emerald-300 text-[#080C14] text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(48,209,88,0.3)] cursor-pointer"
          >
            {saveSuccess ? 'Saved!' : 'Save Policy Changes'}
          </button>
        </div>
      </div>

      {/* 2x2 Bento Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: SPENDING CEILINGS */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h3 className="font-space text-lg font-bold text-white tracking-tight">Spending Ceilings</h3>
            <p className="text-xs text-white/50 mt-0.5">Autonomous limits enforced on Stellar before permit issuance.</p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Limit 1: Max per transaction */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/90">Maximum per Transaction</label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
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
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">
                Any single payment strictly above {localConfig.maxPerTransaction} XLM is blocked immediately.
              </span>
            </div>

            {/* Limit 2: Daily Limit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/90">Daily Spending Limit</label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
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
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">
                The agent cannot exceed {localConfig.dailyLimit} XLM per calendar day (UTC).
              </span>
            </div>

            {/* Limit 3: Weekly Limit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/90">Weekly Spending Limit</label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
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
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">Rolling 7-day budget ceiling of {localConfig.weeklyLimit} XLM.</span>
            </div>
          </div>
        </div>

        {/* CARD 2: APPROVAL CONTROLS */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h3 className="font-space text-lg font-bold text-white tracking-tight">Approval Controls</h3>
            <p className="text-xs text-white/50 mt-0.5">Parameters triggering mandatory human cryptographic authorization.</p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Control 1: Approval Threshold */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/90">Human Approval Threshold</label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-emerald-400/50 backdrop-blur-md transition-all">
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
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">
                Transactions above {localConfig.approvalThreshold} XLM require operator signature.
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
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h3 className="font-space text-lg font-bold text-white tracking-tight">Approved Recipients Allowlist</h3>
            <p className="text-xs text-white/50 mt-0.5">Stellar destination addresses authorized under this policy.</p>
          </div>

          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
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
                placeholder="Label (e.g. AWS Cloud)"
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
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h3 className="font-space text-lg font-bold text-white tracking-tight">Asset Controls</h3>
            <p className="text-xs text-white/50 mt-0.5">Authorized tokens permitted in automated agent transactions.</p>
          </div>

          <div className="flex flex-col divide-y divide-white/[0.06]">
            {localConfig.assetControls.map((ast) => (
              <div key={ast.id} className="py-3 flex items-center justify-between gap-4">
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
    </div>
  );
};
