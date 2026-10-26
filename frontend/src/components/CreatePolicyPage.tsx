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

  // Optional initial recipient
  const [initialRecipientName, setInitialRecipientName] = useState('');
  const [initialRecipientAddress, setInitialRecipientAddress] = useState('');

  // Allowed assets selection
  const [allowedAssets, setAllowedAssets] = useState<string[]>(['XLM', 'USDC']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const created = await api.createPolicy({
        name: name.trim(),
        description: description.trim(),
        max_amount_per_tx: maxAmountPerTx,
        daily_spending_limit: dailyLimit,
        weekly_spending_limit: weeklyLimit,
        human_approval_threshold: approvalThreshold,
        require_human_approval_always: requireHumanApproval,
      });

      // If initial recipient was supplied, add to policy
      if (initialRecipientAddress.trim() && initialRecipientAddress.startsWith('G')) {
        try {
          await api.addRecipient(created.id, {
            address: initialRecipientAddress.trim(),
            label: initialRecipientName.trim() || 'Primary Destination',
          });
        } catch (recErr) {
          console.warn('Initial recipient could not be added:', recErr);
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

        {/* SECTION 4: Initial Destination Allowlist (Optional) */}
        <div className="p-6 sm:p-7 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">
              4
            </span>
            <h2 className="font-space text-base font-bold text-white">Initial Allowlist Destination (Optional)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Destination Label</label>
              <input
                type="text"
                placeholder="e.g. AWS Infrastructure Treasury"
                value={initialRecipientName}
                onChange={(e) => setInitialRecipientName(e.target.value)}
                className="px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/80">Stellar Public Address (G...)</label>
              <input
                type="text"
                placeholder="GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE"
                value={initialRecipientAddress}
                onChange={(e) => setInitialRecipientAddress(e.target.value)}
                className="px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
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
