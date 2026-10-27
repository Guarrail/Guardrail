import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Shield,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Coins,
  Lock,
  Sparkles,
  Ban,
  X,
  ShieldAlert,
  Check,
} from 'lucide-react';

interface CreatePolicyPageProps {
  onPolicyCreated: () => void;
}

export const CreatePolicyPage: React.FC<CreatePolicyPageProps> = ({ onPolicyCreated }) => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxAmountPerTx, setMaxAmountPerTx] = useState('25.0');
  const [dailyLimit, setDailyLimit] = useState('100.0');
  const [weeklyLimit, setWeeklyLimit] = useState('500.0');
  const [approvalThreshold, setApprovalThreshold] = useState('15.0');
  const [requireHumanApproval, setRequireHumanApproval] = useState(false);

  // Allowed whitelist recipients
  const [whitelist, setWhitelist] = useState<Array<{ address: string; label: string }>>([]);
  const [whiteAddr, setWhiteAddr] = useState('');
  const [whiteLabel, setWhiteLabel] = useState('');
  const [whiteError, setWhiteError] = useState('');

  // Prohibited blacklist recipients
  const [blacklist, setBlacklist] = useState<Array<{ address: string; label: string; reason: string }>>([]);
  const [blackAddr, setBlackAddr] = useState('');
  const [blackLabel, setBlackLabel] = useState('');
  const [blackReason, setBlackReason] = useState('');
  const [blackError, setBlackError] = useState('');

  // Active sub-tab for Section 4
  const [recipientTab, setRecipientTab] = useState<'WHITELIST' | 'BLACKLIST'>('WHITELIST');

  // Allowed assets selection
  const [allowedAssets, setAllowedAssets] = useState<string[]>(['XLM', 'USDC']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = whiteAddr.trim();
    if (!addr.startsWith('G') || addr.length !== 56) {
      setWhiteError('Invalid Stellar address. Must start with G and be 56 characters.');
      return;
    }
    setWhiteError('');
    setWhitelist((prev) => [...prev, { address: addr, label: whiteLabel.trim() || 'Approved Destination' }]);
    setWhiteAddr('');
    setWhiteLabel('');
  };

  const handleAddBlacklist = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = blackAddr.trim();
    if (!addr.startsWith('G') || addr.length !== 56) {
      setBlackError('Invalid Stellar address. Must start with G and be 56 characters.');
      return;
    }
    setBlackError('');
    setBlacklist((prev) => [
      ...prev,
      {
        address: addr,
        label: blackLabel.trim() || 'Blocked Wallet',
        reason: blackReason.trim() || 'Prohibited destination',
      },
    ]);
    setBlackAddr('');
    setBlackLabel('');
    setBlackReason('');
  };

  const toggleAsset = (code: string) => {
    setAllowedAssets((prev) =>
      prev.includes(code) ? prev.filter((a) => a !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please provide a policy name.');
      return;
    }

    if (parseFloat(maxAmountPerTx) <= 0 || parseFloat(dailyLimit) <= 0) {
      setErrorMessage('Spending limits must be greater than zero.');
      return;
    }

    // Auto-capture any address typed in the input fields even if user didn't click the "+ Add" button
    const finalWhitelist = [...whitelist];
    if (whiteAddr.trim()) {
      const addr = whiteAddr.trim();
      if (!addr.startsWith('G') || addr.length !== 56) {
        setWhiteError('Invalid Stellar address. Must start with G and be 56 characters.');
        setErrorMessage('Please correct the invalid Stellar address in the Whitelist section.');
        return;
      }
      if (!finalWhitelist.some((w) => w.address === addr)) {
        finalWhitelist.push({ address: addr, label: whiteLabel.trim() || 'Approved Destination' });
      }
    }

    const finalBlacklist = [...blacklist];
    if (blackAddr.trim()) {
      const addr = blackAddr.trim();
      if (!addr.startsWith('G') || addr.length !== 56) {
        setBlackError('Invalid Stellar address. Must start with G and be 56 characters.');
        setErrorMessage('Please correct the invalid Stellar address in the Blacklist section.');
        return;
      }
      if (!finalBlacklist.some((b) => b.address === addr)) {
        finalBlacklist.push({
          address: addr,
          label: blackLabel.trim() || 'Blocked Wallet',
          reason: blackReason.trim() || 'Prohibited destination',
        });
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Create policy with allowed & blocked recipients in the atomic payload
      const created = await api.createPolicy({
        name: name.trim(),
        description: description.trim(),
        max_amount_per_tx: maxAmountPerTx,
        daily_spending_limit: dailyLimit,
        weekly_spending_limit: weeklyLimit,
        human_approval_threshold: approvalThreshold,
        require_human_approval_always: requireHumanApproval,
        allowed_recipients: finalWhitelist,
        blocked_recipients: finalBlacklist,
      });

      // Synchronize individually as an extra guarantee and trigger Soroban smart contract sync
      for (const item of finalWhitelist) {
        try {
          await api.addRecipient(created.id, {
            address: item.address,
            label: item.label,
          });
        } catch (recErr) {
          console.warn('Whitelist recipient sync warning:', recErr);
        }
      }

      for (const item of finalBlacklist) {
        try {
          await api.addBlockedRecipient(created.id, {
            address: item.address,
            label: item.label,
            reason: item.reason,
          });
        } catch (blkErr) {
          console.warn('Blacklist recipient sync warning:', blkErr);
        }
      }

      onPolicyCreated();
      navigate('/policies');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create spending policy. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-5xl mx-auto w-full font-manrope">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/policies')}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/60 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Policies</span>
        </button>

        <span className="text-xs text-white/40">Step-by-step Policy Builder</span>
      </div>

      {/* Header Banner */}
      <div className="p-6 sm:p-8 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="font-space text-2xl font-bold text-white tracking-tight">Create Spending Policy</h1>
          <p className="text-xs sm:text-sm text-white/50 mt-0.5">
            Configure transaction ceilings, multi-sig approval triggers, and allowlists for autonomous AI agents.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* SECTION 1: General Policy Info */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="font-space text-base font-bold text-white">General Information</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Policy Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Micro-Treasury Liquidity Policy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.1] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Description & Context</label>
              <textarea
                rows={2}
                placeholder="Operational purpose, agent bounds, or specific constraints..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-4 py-2 bg-white/[0.04] border border-white/[0.1] rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Spending Ceilings */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="font-space text-base font-bold text-white">Spending Ceilings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Max Single Tx (XLM) *</label>
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.1] rounded-xl focus-within:border-emerald-400/50">
                <input
                  type="number"
                  step="0.1"
                  required
                  value={maxAmountPerTx}
                  onChange={(e) => setMaxAmountPerTx(e.target.value)}
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">Upper bound for any single transaction.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Daily Budget (XLM) *</label>
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.1] rounded-xl focus-within:border-emerald-400/50">
                <input
                  type="number"
                  step="1"
                  required
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">Resets daily at 00:00 UTC.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Weekly Budget (XLM) *</label>
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.1] rounded-xl focus-within:border-emerald-400/50">
                <input
                  type="number"
                  step="1"
                  required
                  value={weeklyLimit}
                  onChange={(e) => setWeeklyLimit(e.target.value)}
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">Cumulative 7-day budget ceiling.</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: Human Oversight & Dual Authorization */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
              3
            </span>
            <h2 className="font-space text-base font-bold text-white">Approval Gates & Governance</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Human Approval Threshold (XLM)</label>
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.1] rounded-xl focus-within:border-amber-400/50">
                <input
                  type="number"
                  step="0.1"
                  required
                  value={approvalThreshold}
                  onChange={(e) => setApprovalThreshold(e.target.value)}
                  className="bg-transparent font-space text-base font-semibold text-white w-full focus:outline-none tabular-nums"
                />
                <span className="text-xs font-space font-semibold text-white/40 ml-2">XLM</span>
              </div>
              <span className="text-[11px] text-white/40">
                Transactions strictly above this value trigger the operator co-sign flow.
              </span>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-white">Require Human Approval Always</span>
                <span className="text-[11px] text-white/40">
                  Force all payment proposals into pending status for manual signature.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setRequireHumanApproval(!requireHumanApproval)}
                className={`w-12 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                  requireHumanApproval ? 'bg-amber-400' : 'bg-white/15'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    requireHumanApproval ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: Recipient Governance: Whitelist & Blacklist */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl flex flex-col gap-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.06] gap-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="font-space text-base font-bold text-white">Recipient Governance: Whitelist & Blacklist</h2>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRecipientTab('WHITELIST')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  recipientTab === 'WHITELIST'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Whitelist ({whitelist.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRecipientTab('BLACKLIST')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  recipientTab === 'BLACKLIST'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Blacklist ({blacklist.length})</span>
              </button>
            </div>
          </div>

          {/* Soroban smart contract sync badge */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>Smart Contract Enforced:</strong> Both whitelist and blacklist wallets are validated on backend and written directly into the Soroban smart contract on Stellar.
            </span>
          </div>

          {recipientTab === 'WHITELIST' ? (
            /* Whitelist UI */
            <div className="flex flex-col gap-4">
              <p className="text-xs text-white/60">
                Wallets agents are <strong>explicitly permitted</strong> to transfer funds to. If whitelist is active, payments to unlisted wallets are blocked.
              </p>

              {whitelist.length > 0 && (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {whitelist.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-white truncate block">{w.label}</span>
                        <span className="font-mono text-[11px] text-emerald-300/80 truncate block">{w.address}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWhitelist(whitelist.filter((_, i) => i !== idx))}
                        className="p-1.5 text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Whitelist Input */}
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex flex-col gap-3">
                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Wallet to Whitelist</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Stellar Address: GB..."
                    value={whiteAddr}
                    onChange={(e) => {
                      setWhiteAddr(e.target.value);
                      setWhiteError('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Label: e.g. Treasury Operations"
                    value={whiteLabel}
                    onChange={(e) => setWhiteLabel(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {whiteError && <span className="text-[11px] text-rose-400">{whiteError}</span>}
                <button
                  type="button"
                  onClick={handleAddWhitelist}
                  className="self-start px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded-xl text-xs font-semibold border border-emerald-500/30 transition-all cursor-pointer"
                >
                  + Add to Whitelist
                </button>
              </div>
            </div>
          ) : (
            /* Blacklist UI */
            <div className="flex flex-col gap-4">
              <p className="text-xs text-white/60">
                Wallets agents are <strong>strictly forbidden</strong> from transferring funds to. Transactions to blacklisted addresses fail policy checks immediately.
              </p>

              {blacklist.length > 0 && (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {blacklist.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-rose-500/[0.05] border border-rose-500/20 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-rose-300 truncate">{b.label}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-200 font-mono">
                            {b.reason}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-white/50 truncate block mt-0.5">{b.address}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBlacklist(blacklist.filter((_, i) => i !== idx))}
                        className="p-1.5 text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Blacklist Input */}
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex flex-col gap-3">
                <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  <span>Add Wallet to Blacklist (Prohibited Destination)</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Stellar Address: GB..."
                    value={blackAddr}
                    onChange={(e) => {
                      setBlackAddr(e.target.value);
                      setBlackError('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-rose-500"
                  />
                  <input
                    type="text"
                    placeholder="Label: e.g. Restricted Entity"
                    value={blackLabel}
                    onChange={(e) => setBlackLabel(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-white/30 focus:outline-none focus:border-rose-500"
                  />
                  <input
                    type="text"
                    placeholder="Reason: e.g. Flagged address"
                    value={blackReason}
                    onChange={(e) => setBlackReason(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-white/30 focus:outline-none focus:border-rose-500"
                  />
                </div>
                {blackError && <span className="text-[11px] text-rose-400">{blackError}</span>}
                <button
                  type="button"
                  onClick={handleAddBlacklist}
                  className="self-start px-4 py-2 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white rounded-xl text-xs font-semibold border border-rose-500/30 transition-all cursor-pointer"
                >
                  + Add to Blacklist
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: Permitted Assets */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
              5
            </span>
            <h2 className="font-space text-base font-bold text-white">Permitted Assets</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { code: 'XLM', name: 'Stellar Lumens', native: true },
              { code: 'USDC', name: 'USD Coin (Circle)', native: false },
              { code: 'EURC', name: 'Euro Coin (Circle)', native: false },
            ].map((ast) => {
              const isChecked = allowedAssets.includes(ast.code);
              return (
                <div
                  key={ast.code}
                  onClick={() => toggleAsset(ast.code)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isChecked
                      ? 'bg-blue-500/15 border-blue-500/40 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-space font-bold text-sm text-white">{ast.code}</span>
                    <span className="text-[10px] text-white/50">{ast.name}</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      isChecked
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-white/20 bg-transparent'
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Actions Footer */}
        <div className="p-4 bg-[#0A0F19]/90 backdrop-blur-2xl border border-white/[0.1] rounded-2xl flex items-center justify-between gap-4 shadow-lg sticky bottom-4 z-20">
          <button
            type="button"
            onClick={() => navigate('/policies')}
            className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-semibold text-white/70 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#080C14] text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(48,209,88,0.35)] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Creating Policy...' : 'Create & Activate Policy'}
          </button>
        </div>
      </form>
    </div>
  );
};
