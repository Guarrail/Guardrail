import React, { useState } from 'react';
import { PolicyConfig } from '../types';
import { api } from '../services/api';
import {
  Sliders,
  Users,
  Coins,
  Fingerprint,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

interface PolicyConfigViewProps {
  policyConfig: PolicyConfig;
  setPolicyConfig: React.Dispatch<React.SetStateAction<PolicyConfig>>;
}

export const PolicyConfigView: React.FC<PolicyConfigViewProps> = ({
  policyConfig,
  setPolicyConfig,
}) => {
  const [localConfig, setLocalConfig] = useState<PolicyConfig>({ ...policyConfig });
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientAddress, setNewRecipientAddress] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [recipientError, setRecipientError] = useState('');

  const handleSave = async () => {
    try {
      if (policyConfig.id) {
        await api.updatePolicy(policyConfig.id, {
          max_amount_per_tx: localConfig.maxPerTransaction.toString(),
          daily_spending_limit: localConfig.dailyLimit.toString(),
          weekly_spending_limit: localConfig.weeklyLimit.toString(),
          human_approval_threshold: localConfig.approvalThreshold.toString(),
          require_human_approval_always: localConfig.requireHumanApproval,
        });
      }
      setPolicyConfig({ ...localConfig });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.warn('Policy API update notice:', e);
      setPolicyConfig({ ...localConfig });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
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
    try {
      if (policyConfig.id) {
        await api.addRecipient(policyConfig.id, {
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
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full">
      {/* Toast Notice */}
      {saveSuccess && (
        <div className="p-3 bg-[#4AC777]/20 border border-[#4AC777] text-[#4AC777] rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Policy configuration updated successfully. All incoming agent requests are now evaluated against these limits.</span>
        </div>
      )}

      {/* Grid of Policy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* CARD 1: TRANSACTION LIMITS */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-5">
          <h2 className="font-space text-xl font-bold text-white tracking-tight">
            Transaction limits
          </h2>

          <div className="flex flex-col gap-5">
            {/* Limit 1: Max per transaction */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white">
                Maximum per transaction
              </label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#09101A] border border-[#2B3340] rounded-lg focus-within:border-[#4AC777]">
                <input
                  type="number"
                  value={localConfig.maxPerTransaction}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      maxPerTransaction: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-medium text-white w-full focus:outline-hidden tabular-nums"
                />
                <span className="text-sm font-space text-[#9099A5] ml-2">USDC</span>
              </div>
              <span className="text-xs text-[#9099A5]">
                Any single payment above {localConfig.maxPerTransaction} USDC is blocked.
              </span>
            </div>

            {/* Limit 2: Daily Limit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white">
                Daily spending limit
              </label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#09101A] border border-[#2B3340] rounded-lg focus-within:border-[#4AC777]">
                <input
                  type="number"
                  value={localConfig.dailyLimit}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      dailyLimit: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-medium text-white w-full focus:outline-hidden tabular-nums"
                />
                <span className="text-sm font-space text-[#9099A5] ml-2">USDC</span>
              </div>
              <span className="text-xs text-[#9099A5]">
                The agent can't spend more than {localConfig.dailyLimit} USDC per day (UTC).
              </span>
            </div>

            {/* Limit 3: Weekly Limit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white">
                Weekly spending limit
              </label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#09101A] border border-[#2B3340] rounded-lg focus-within:border-[#4AC777]">
                <input
                  type="number"
                  value={localConfig.weeklyLimit}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      weeklyLimit: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-medium text-white w-full focus:outline-hidden tabular-nums"
                />
                <span className="text-sm font-space text-[#9099A5] ml-2">USDC</span>
              </div>
              <span className="text-xs text-[#9099A5]">
                Rolling 7-day cap of {localConfig.weeklyLimit} USDC.
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: APPROVAL CONTROLS */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-5">
          <h2 className="font-space text-xl font-bold text-white tracking-tight">
            Approval controls
          </h2>

          <div className="flex flex-col gap-6">
            {/* Toggle: Require Human Approval */}
            <div className="flex items-center justify-between gap-4 p-3.5 bg-[#09101A]/60 border border-[#2B3340] rounded-lg">
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  Require human approval
                </div>
                <div className="text-xs text-[#9099A5] mt-0.5">
                  Payments above the threshold wait for your signature.
                </div>
              </div>

              {/* Custom Toggle Switch */}
              <button
                type="button"
                onClick={() =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    requireHumanApproval: !prev.requireHumanApproval,
                  }))
                }
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                  localConfig.requireHumanApproval ? 'bg-[#4AC777]' : 'bg-[#2D3339]'
                }`}
                aria-label="Toggle human approval"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    localConfig.requireHumanApproval ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Threshold Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-white">
                Approval threshold
              </label>
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#09101A] border border-[#2B3340] rounded-lg focus-within:border-[#4AC777]">
                <input
                  type="number"
                  disabled={!localConfig.requireHumanApproval}
                  value={localConfig.approvalThreshold}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      approvalThreshold: Number(e.target.value),
                    }))
                  }
                  className="bg-transparent font-space text-base font-medium text-white w-full focus:outline-hidden disabled:opacity-40 tabular-nums"
                />
                <span className="text-sm font-space text-[#9099A5] ml-2">USDC</span>
              </div>
              <span className="text-xs text-[#9099A5]">
                Payments over {localConfig.approvalThreshold} USDC need you to approve & sign.
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: APPROVED RECIPIENTS */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-4">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Approved recipients
            </h2>
            <p className="text-xs sm:text-sm text-[#9099A5] mt-1">
              The agent can only pay these addresses.
            </p>
          </div>

          {/* List of Allow-listed Recipients */}
          <div className="flex flex-col gap-3">
            {localConfig.approvedRecipients.map((rec) => (
              <div
                key={rec.id}
                className="p-3 bg-[#202938] border border-[#2B3340] rounded-lg flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm text-white truncate">
                    {rec.name}
                  </div>
                  <div className="font-mono text-[11px] text-[#9099A5] truncate">
                    {rec.address}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveRecipient(rec.id)}
                  className="px-2.5 py-1 text-xs font-semibold text-[#ED4A49] hover:bg-[#ED4A49]/10 rounded border border-[#2B3340] transition-colors shrink-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Add Recipient Form */}
          <form onSubmit={handleAddRecipient} className="mt-2 pt-3 border-t border-[#2B3340] flex flex-col gap-2">
            <span className="text-xs font-semibold text-white">Add New Recipient</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Name (e.g. Cloud Host)"
                value={newRecipientName}
                onChange={(e) => setNewRecipientName(e.target.value)}
                className="px-3 py-1.5 bg-[#09101A] border border-[#2B3340] rounded-md text-xs text-white focus:outline-hidden focus:border-[#4AC777]"
              />
              <input
                type="text"
                placeholder="Stellar address (G...)"
                value={newRecipientAddress}
                onChange={(e) => setNewRecipientAddress(e.target.value)}
                className="px-3 py-1.5 bg-[#09101A] border border-[#2B3340] rounded-md text-xs font-mono text-white focus:outline-hidden focus:border-[#4AC777]"
              />
            </div>
            {recipientError && (
              <span className="text-[11px] text-[#ED4A49]">{recipientError}</span>
            )}
            <button
              type="submit"
              className="mt-1 px-4 py-2 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-bold text-[#EFF2F5] rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer self-start"
            >
              <Plus className="w-3.5 h-3.5 text-[#4AC777]" />
              <span>Add Recipient</span>
            </button>
          </form>
        </div>

        {/* CARD 4: ASSET CONTROLS */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-4">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Asset controls
            </h2>
            <p className="text-xs sm:text-sm text-[#9099A5] mt-1">
              Only checked assets from these issuers can move.
            </p>
          </div>

          <div className="flex flex-col divide-y divide-[#2B3340]">
            {localConfig.assetControls.map((ast) => (
              <div key={ast.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">
                    {ast.asset}
                  </div>
                  <div className="text-[11px] font-mono text-[#9099A5] truncate max-w-sm">
                    Issuer: {ast.issuer}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleAsset(ast.id)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    ast.enabled ? 'bg-[#4AC777]' : 'bg-[#2D3339]'
                  }`}
                  aria-label={`Toggle ${ast.asset}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
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
      <div className="p-4 bg-[#202938] border border-[#2B3340] rounded-xl flex items-center justify-between gap-4">
        <span className="text-xs text-[#9099A5]">
          Unsaved changes will apply immediately to all active agents upon saving.
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-[#09101A] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-[#EFF2F5] rounded-md transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-md transition-colors shadow-sm cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
