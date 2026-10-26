import React, { useState } from 'react';
import { AgentRequest, PolicyConfig, ControlledWalletState } from '../types';
import {
  X,
  Sparkles,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';

interface SimulateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyConfig: PolicyConfig;
  controlledWallet: ControlledWalletState;
  onAddRequest: (newReq: AgentRequest) => void;
}

export const SimulateRequestModal: React.FC<SimulateRequestModalProps> = ({
  isOpen,
  onClose,
  policyConfig,
  controlledWallet,
  onAddRequest,
}) => {
  if (!isOpen) return null;

  const [recipientAddress, setRecipientAddress] = useState(
    'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE'
  );
  const [recipientName, setRecipientName] = useState('Ada Studio (contractor)');
  const [amount, setAmount] = useState<number>(10);
  const [asset, setAsset] = useState<string>('XLM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluatedResult, setEvaluatedResult] = useState<null | {
    passed: boolean;
    needsApproval: boolean;
    status: AgentRequest['status'];
    reasons: string[];
    backendRequest?: any;
  }>(null);

  // Preset scenarios with valid Stellar addresses
  const presets = [
    {
      label: 'Standard Payment (10 XLM)',
      name: 'Approved Vendor A',
      address: 'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE',
      amount: 10,
      asset: 'XLM',
      note: 'Within limits, auto-approved under 15 XLM threshold',
    },
    {
      label: 'High-Value Invoice (20 XLM)',
      name: 'Approved Vendor A',
      address: 'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE',
      amount: 20,
      asset: 'XLM',
      note: 'Within limits, triggers operator review (> 15 XLM)',
    },
    {
      label: 'Exceeds Per-Tx Limit (30 XLM)',
      name: 'Approved Vendor A',
      address: 'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE',
      amount: 30,
      asset: 'XLM',
      note: 'Violates 25 XLM max per transaction limit',
    },
    {
      label: 'Unapproved Stellar Recipient',
      name: 'Unknown External Address',
      address: 'GD22E23DFN5JI53B4FKHA3DZVUYUNCON35MDOD7IMWDOJERDP2ZIU5EH',
      amount: 5,
      asset: 'XLM',
      note: 'Blocked by policy recipient allowlist',
    },
  ];

  const applyPreset = (p: (typeof presets)[0]) => {
    setRecipientName(p.name);
    setRecipientAddress(p.address);
    setAmount(p.amount);
    setAsset(p.asset);
    setEvaluatedResult(null);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const reqId = `REQ-${Date.now().toString().slice(-4)}`;
      const res = await api.submitAgentRequest({
        request_id: reqId,
        recipient: recipientAddress,
        amount: amount.toString(),
        asset: asset,
        wallet_id: controlledWallet.id,
      });

      const isPassed = res.status !== 'BLOCKED';
      const needsApproval = res.requires_human_approval;
      let feStatus: AgentRequest['status'] = 'Blocked';
      if (res.status === 'APPROVED') feStatus = 'Approved';
      else if (res.status === 'PENDING_APPROVAL') feStatus = 'Pending';
      else if (res.status === 'EXECUTED') feStatus = 'Executed';

      const reasons = res.policy_evaluation_results?.failure_reasons || [];

      setEvaluatedResult({
        passed: isPassed,
        needsApproval,
        status: feStatus,
        reasons,
        backendRequest: res,
      });
    } catch (err) {
      console.warn('Simulation fallback:', err);
      // Fallback evaluation if offline
      const isUnderMaxPerTx = amount <= (policyConfig.maxPerTransaction || 25);
      const isRecipientApproved = policyConfig.approvedRecipients?.some(
        (r) => r.address.toLowerCase() === recipientAddress.toLowerCase()
      );
      const reasons: string[] = [];
      if (!isUnderMaxPerTx) reasons.push(`Amount exceeds max limit (${policyConfig.maxPerTransaction || 25} XLM)`);
      if (!isRecipientApproved) reasons.push('Recipient address not on allowlist');

      const passed = isUnderMaxPerTx && isRecipientApproved;
      setEvaluatedResult({
        passed,
        needsApproval: passed && amount > (policyConfig.approvalThreshold || 15),
        status: !passed ? 'Blocked' : amount > (policyConfig.approvalThreshold || 15) ? 'Pending' : 'Approved',
        reasons,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommitRequest = () => {
    if (!evaluatedResult) return;

    const bReq = evaluatedResult.backendRequest;
    const reqId = bReq ? bReq.request_id : `REQ-${Date.now().toString().slice(-4)}`;

    const newRequest: AgentRequest = {
      id: reqId,
      backendId: bReq ? bReq.id : undefined,
      agentId: 'agent_001',
      agentName: 'Autonomous Agent',
      recipientName,
      recipientAddress,
      amount,
      asset,
      time: 'Just now',
      timestamp: new Date().toISOString(),
      policyResult: evaluatedResult.passed ? 'Passed' : 'Failed',
      policyDecisionText: evaluatedResult.passed ? 'Allowed' : 'Denied',
      approvalRequired: evaluatedResult.needsApproval,
      approvalStatus: evaluatedResult.needsApproval
        ? 'Pending'
        : evaluatedResult.passed
        ? 'Approved'
        : 'Not Required',
      status: evaluatedResult.status,
      networkFee: '0.00001 XLM',
      expiresInMinutes: 30,
      policyVersion: 'v1',
      payloadHash: bReq?.permit?.payload_hash || 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      permitId: bReq?.permit?.id || `prm_${reqId.toLowerCase()}`,
      stellarTxHash: bReq?.stellar_tx_hash,
      checks: [
        {
          id: 'chk_1',
          title: 'Transaction amount within limit',
          detail: `${amount} ≤ ${policyConfig.maxPerTransaction || 25} XLM`,
          passed: amount <= (policyConfig.maxPerTransaction || 25),
        },
        {
          id: 'chk_2',
          title: 'Recipient approved',
          detail: 'Recipient allowlist verification',
          passed: !evaluatedResult.reasons.some((r) => r.includes('allowlist') || r.includes('recipient')),
        },
        {
          id: 'chk_3',
          title: 'Asset permitted',
          detail: `${asset} permitted`,
          passed: true,
        },
        {
          id: 'chk_4',
          title: 'Daily spending limit available',
          detail: 'Within daily budget',
          passed: !evaluatedResult.reasons.some((r) => r.includes('daily')),
        },
        {
          id: 'chk_5',
          title: 'Weekly spending limit available',
          detail: 'Within weekly budget',
          passed: true,
        },
        {
          id: 'chk_6',
          title: 'Human approval requirement satisfied',
          detail: evaluatedResult.needsApproval ? 'Pending operator approval' : 'Auto-approved',
          passed: !evaluatedResult.needsApproval,
        },
      ],
    };

    onAddRequest(newRequest);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto font-manrope">
      <div className="relative w-full max-w-2xl bg-[#09101A] border border-[#2B3340] rounded-xl shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#1D2430] border-b border-[#2B3340] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#4AC777]" />
            <h2 className="font-space text-lg font-bold text-white tracking-tight">
              Simulate AI Agent Payment Request
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#9099A5] hover:text-white rounded-md hover:bg-[#202938] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
          {/* Preset Buttons */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#9099A5]">Quick Presets</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="p-2.5 bg-[#1B2330] hover:bg-[#232E3F] border border-[#2B3340] rounded-lg text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">{p.label}</div>
                  <div className="text-[10px] text-[#9099A5] mt-0.5 truncate">{p.note}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSimulate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-white">Recipient Address</label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => {
                  setRecipientAddress(e.target.value);
                  setEvaluatedResult(null);
                }}
                className="px-3 py-2 bg-[#1B2330] border border-[#2B3340] rounded-lg text-xs font-mono text-white focus:outline-hidden focus:border-[#4AC777]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-white">Amount</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={amount}
                  onChange={(e) => {
                    setAmount(parseFloat(e.target.value) || 0);
                    setEvaluatedResult(null);
                  }}
                  className="px-3 py-2 bg-[#1B2330] border border-[#2B3340] rounded-lg text-xs font-bold text-white focus:outline-hidden focus:border-[#4AC777]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-white">Asset</label>
                <select
                  value={asset}
                  onChange={(e) => {
                    setAsset(e.target.value);
                    setEvaluatedResult(null);
                  }}
                  className="px-3 py-2 bg-[#1B2330] border border-[#2B3340] rounded-lg text-xs font-bold text-white focus:outline-hidden focus:border-[#4AC777]"
                >
                  <option value="XLM">XLM (Native)</option>
                  <option value="USDC">USDC (Centre)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full py-2.5 bg-white hover:bg-slate-100 text-[#09101A] font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#09101A]" />
                  <span>Evaluating through Policy Engine...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-[#09101A]" />
                  <span>Evaluate with Backend Policy Engine</span>
                </>
              )}
            </button>
          </form>

          {/* Results Display */}
          {evaluatedResult && (
            <div className="p-4 bg-[#1B2330] border border-[#2B3340] rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9099A5] font-semibold">Evaluation Outcome</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    evaluatedResult.passed
                      ? 'bg-[#4AC777]/20 text-[#4AC777]'
                      : 'bg-[#ED4A49]/20 text-[#ED4A49]'
                  }`}
                >
                  {evaluatedResult.passed ? 'Allowed by Policy' : 'Blocked by Policy'}
                </span>
              </div>

              {evaluatedResult.reasons.length > 0 && (
                <div className="flex flex-col gap-1 text-xs text-[#ED4A49]">
                  {evaluatedResult.reasons.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {evaluatedResult.passed && evaluatedResult.needsApproval && (
                <div className="flex items-center gap-1.5 text-xs text-[#F2B036]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Exceeds human threshold — requires operator approval before co-signing.</span>
                </div>
              )}

              {evaluatedResult.passed && !evaluatedResult.needsApproval && (
                <div className="flex items-center gap-1.5 text-xs text-[#4AC777]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Fully compliant with active policy — eligible for co-signing.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCommitRequest}
                className="mt-2 w-full py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09121F] font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Commit to Live Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#09121F]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
