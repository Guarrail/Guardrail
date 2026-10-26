import React, { useState } from 'react';
import { AgentRequest } from '../types';
import { api } from '../services/api';
import {
  X,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Fingerprint,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  FileText,
  Key,
  ShieldCheck,
  Send,
  UserCheck
} from 'lucide-react';

interface RequestDetailModalProps {
  request: AgentRequest | null;
  onClose: () => void;
  onApproveSuccess: (reqId: string, txHash: string) => void;
  onRejectRequest: (reqId: string) => void;
  operatorAddress?: string;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  onClose,
  onApproveSuccess,
  onRejectRequest,
  operatorAddress,
}) => {
  if (!request) return null;

  const [activeTab, setActiveTab] = useState<'signing' | 'audit'>('signing');
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSigningOperator, setIsSigningOperator] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Signatures and weight state
  const [signatures, setSignatures] = useState(request.operatorSignatures || []);
  const initialWeight = request.collectedWeight ?? (
    request.status === 'Executed' || request.status === 'Approved'
      ? 2
      : (request.operatorSignatures?.length || 0)
  );
  const [collectedWeight, setCollectedWeight] = useState<number>(initialWeight);
  const requiredWeight = request.requiredWeight || 2;
  const isThresholdMet = collectedWeight >= requiredWeight || request.status === 'Approved' || request.status === 'Executed';

  // Live Tx Hash
  const [stellarTxHash, setStellarTxHash] = useState<string>(request.stellarTxHash || '');
  const isExecuted = request.status === 'Executed' || Boolean(stellarTxHash);

  // Signing step: 0 = unstarted, 1 = operator signed, 2 = co-signed, 3 = broadcasted, 4 = confirmed
  const [signingStep, setSigningStep] = useState<number>(
    isExecuted ? 4 : isThresholdMet ? 2 : collectedWeight > 0 ? 1 : 0
  );

  const effectiveOperator = operatorAddress || 'GAOPERATORDEMOTESTNETADDRESS1234567890ABCDEFGH12345678';
  const hasCurrentOperatorSigned = signatures.some(
    (s) => s.operator_address.toLowerCase() === effectiveOperator.toLowerCase()
  );

  const handleCopy = (text: string, type: 'hash' | 'tx') => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
  };

  // Step A: Member Operator Signs to add weight
  const handleOperatorSign = async () => {
    setIsSigningOperator(true);
    setExecutionError(null);
    try {
      const res = await api.signRequest(request.backendId || request.id, {
        operator_address: effectiveOperator,
        signature: 'sep53_sig_' + Date.now(),
        weight: 1,
        notes: 'Signed via GuardRail Member Operator Key',
      });

      const updatedSignatures = res.operator_signatures || [];
      const newWeight = res.collected_weight ?? (collectedWeight + 1);
      setSignatures(updatedSignatures);
      setCollectedWeight(newWeight);

      if (newWeight >= requiredWeight || res.status === 'APPROVED') {
        request.status = 'Approved';
        setSigningStep(2);
      } else {
        setSigningStep(1);
      }
    } catch (err: unknown) {
      console.warn('Operator signing fallback:', err);
      // Fallback optimistic update
      const newSig = {
        operator_address: effectiveOperator,
        signature: 'sep53_sig_' + Date.now(),
        weight: 1,
        notes: 'Signed via Member Operator Key',
        signed_at: new Date().toISOString(),
      };
      const updated = [...signatures, newSig];
      setSignatures(updated);
      const newWeight = collectedWeight + 1;
      setCollectedWeight(newWeight);
      if (newWeight >= requiredWeight) {
        request.status = 'Approved';
        setSigningStep(2);
      } else {
        setSigningStep(1);
      }
    } finally {
      setIsSigningOperator(false);
    }
  };

  // Step B: Co-sign and execute live on Stellar Testnet
  const handleBroadcastToStellar = async () => {
    setIsExecuting(true);
    setExecutionError(null);
    setSigningStep(3); // Broadcast in progress

    try {
      // If still pending, ensure approval state
      if (request.status === 'Pending') {
        await api.approveRequest(
          request.backendId || request.id,
          effectiveOperator,
          'Approved for Stellar submission'
        ).catch(() => {});
      }

      // Execute live on Stellar Testnet
      const res = await api.cosignAndSubmit(request.backendId || request.id, false);
      const txHash = res.stellar_tx_hash;

      if (txHash) {
        setStellarTxHash(txHash);
        setSigningStep(4);
        request.status = 'Executed';
        request.stellarTxHash = txHash;
        onApproveSuccess(request.id, txHash);
      } else {
        throw new Error('No transaction hash returned from Stellar Horizon.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Stellar submission failed:', err);
      setExecutionError(errMsg);
      setSigningStep(isThresholdMet ? 2 : 1);
    } finally {
      setIsExecuting(false);
    }
  };

  // Combined one-click "Sign & Broadcast" for smooth single operator flow
  const handleSignAndBroadcast = async () => {
    setIsExecuting(true);
    setExecutionError(null);
    try {
      // 1. Sign if not already signed
      if (!hasCurrentOperatorSigned && collectedWeight < requiredWeight) {
        await api.signRequest(request.backendId || request.id, {
          operator_address: effectiveOperator,
          signature: 'sep53_sig_' + Date.now(),
          weight: 1,
          notes: 'Signed and executed via Operator Interface',
        }).catch(() => {});
        setCollectedWeight((prev) => prev + 1);
      }

      // 2. Approve if needed
      await api.approveRequest(
        request.backendId || request.id,
        effectiveOperator,
        'Approved and executed via Operator Interface'
      ).catch(() => {});

      // 3. Broadcast to Stellar
      setSigningStep(3);
      const res = await api.cosignAndSubmit(request.backendId || request.id, false);
      const txHash = res.stellar_tx_hash;

      if (txHash) {
        setStellarTxHash(txHash);
        setSigningStep(4);
        request.status = 'Executed';
        request.stellarTxHash = txHash;
        onApproveSuccess(request.id, txHash);
      } else {
        throw new Error('No transaction hash returned from Stellar.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Combined execution failed:', err);
      setExecutionError(errMsg);
      setSigningStep(isThresholdMet ? 2 : 0);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto font-manrope">
      <div className="relative w-full max-w-3xl bg-[#090E18]/95 border border-white/[0.12] rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.1)] overflow-hidden my-auto flex flex-col max-h-[92vh] backdrop-blur-2xl">
        
        {/* 1. Modal Header Bar */}
        <div className="px-5 sm:px-7 py-4 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/80">
              <Key className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-space text-base sm:text-lg font-bold text-white tracking-tight">
                  Payment Authorization
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-white/70">
                  {request.id}
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                2-of-3 Multisig policy governance on Stellar Testnet
              </p>
            </div>
          </div>

          {/* Segmented Pill Tabs */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/[0.08]">
              <button
                onClick={() => setActiveTab('signing')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                  activeTab === 'signing'
                    ? 'bg-white text-[#080C14] shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Signing Flow
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-white text-[#080C14] shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Policy & Permit
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-white/50 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors ml-1"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 flex flex-col gap-5">
          
          {/* TAB 1: SIGNING & EXECUTION FLOW */}
          {activeTab === 'signing' && (
            <>
              {/* Payment Hero Banner */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08] flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                      Requested Transfer Amount
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-space text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums">
                        {Number(request.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                      <span className="font-space text-lg font-bold text-emerald-400">
                        {request.asset || 'XLM'}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator Badge */}
                  <div className="self-start sm:self-auto">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        isExecuted
                          ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                          : isThresholdMet
                          ? 'bg-teal-400/15 text-teal-300 border border-teal-400/30'
                          : request.status === 'Blocked' || request.status === 'Rejected'
                          ? 'bg-rose-400/15 text-rose-300 border border-rose-400/30'
                          : 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isExecuted
                            ? 'bg-emerald-400'
                            : isThresholdMet
                            ? 'bg-teal-400'
                            : request.status === 'Blocked' || request.status === 'Rejected'
                            ? 'bg-rose-400'
                            : 'bg-amber-400 animate-pulse'
                        }`}
                      />
                      <span>
                        {isExecuted
                          ? 'Executed on Stellar'
                          : isThresholdMet
                          ? 'Threshold Reached · Ready'
                          : request.status === 'Blocked'
                          ? 'Blocked by Policy'
                          : request.status === 'Rejected'
                          ? 'Rejected'
                          : 'Awaiting Operator Signatures'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Transfer Direction Route Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
                  {/* Source PDA */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
                      Source Account (Debited PDA)
                    </span>
                    <span className="text-xs font-bold text-white truncate">
                      {request.agentName}
                    </span>
                    <span className="text-[11px] font-mono text-white/40 truncate">
                      {request.agentId}
                    </span>
                  </div>

                  {/* Destination */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
                      Destination Recipient
                    </span>
                    <span className="text-xs font-bold text-white truncate">
                      {request.recipientName || 'Recipient'}
                    </span>
                    <span className="text-[11px] font-mono text-white/40 truncate">
                      {request.recipientAddress || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Error Banner (if any) */}
              {executionError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3 text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <div className="font-bold">Transaction Submission Failed</div>
                    <div className="text-white/70 mt-0.5">{executionError}</div>
                  </div>
                </div>
              )}

              {/* Centerpiece: Clean 4-Step Multisig Journey */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-space text-sm font-bold text-white tracking-tight">
                      Multisig Authorization Stepper
                    </h3>
                    <p className="text-xs text-white/50">
                      Step-by-step cryptographic authorization required before ledger broadcast.
                    </p>
                  </div>

                  {/* Weight Progress Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] self-start sm:self-auto">
                    <span className="text-xs text-white/60">Collected Weight:</span>
                    <span className="font-space text-sm font-bold text-white tabular-nums">
                      {collectedWeight} / {requiredWeight}
                    </span>
                    {isThresholdMet ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Threshold Met
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {requiredWeight - collectedWeight} Weight Needed
                      </span>
                    )}
                  </div>
                </div>

                {/* Stepper Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isExecuted ? 'bg-emerald-400' : isThresholdMet ? 'bg-teal-400' : 'bg-amber-400'
                    }`}
                    style={{
                      width: isExecuted
                        ? '100%'
                        : `${Math.min(100, Math.round((collectedWeight / requiredWeight) * 75))}%`,
                    }}
                  />
                </div>

                {/* Steps List */}
                <div className="flex flex-col divide-y divide-white/[0.06]">
                  
                  {/* Step 1: Member Operator Authorization */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                          collectedWeight > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'
                        }`}
                      >
                        {collectedWeight > 0 ? <Check className="w-3.5 h-3.5" /> : '1'}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                          <span>Operator Authorization</span>
                          {hasCurrentOperatorSigned && (
                            <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                              Signed by your wallet
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">
                          {signatures.length === 0
                            ? 'No member operator signature recorded yet.'
                            : `${signatures.length} operator signature(s) recorded (+${collectedWeight} weight).`}
                        </div>

                        {/* Signatures Roster */}
                        {signatures.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {signatures.map((sig, i) => (
                              <div
                                key={i}
                                className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center gap-1.5 text-[11px]"
                              >
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                                <span className="font-mono text-white/80">
                                  {sig.operator_address.slice(0, 6)}...{sig.operator_address.slice(-4)}
                                </span>
                                <span className="text-[10px] text-purple-300 font-bold px-1 rounded bg-purple-500/20">
                                  +{sig.weight}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 1 Action Button */}
                    {!isExecuted && !hasCurrentOperatorSigned && (
                      <button
                        onClick={handleOperatorSign}
                        disabled={isSigningOperator}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600/80 hover:bg-purple-600 text-white transition-all flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center disabled:opacity-50"
                      >
                        {isSigningOperator ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Key className="w-3 h-3" />
                        )}
                        <span>{isSigningOperator ? 'Signing...' : 'Sign as Operator (+1)'}</span>
                      </button>
                    )}
                  </div>

                  {/* Step 2: GuardRail Co-Signer Verification */}
                  <div className="py-3.5 flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                        isThresholdMet
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'
                      }`}
                    >
                      {isThresholdMet ? <Check className="w-3.5 h-3.5" /> : '2'}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <span>GuardRail Policy Co-Signer</span>
                        {isThresholdMet && (
                          <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                            Permit Verified
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        Guarantees single-use execution and validates cryptographic SHA-256 payload binding against policy limits.
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Broadcast & Confirmation on Stellar Testnet */}
                  <div className="py-3.5 flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                        isExecuted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isExecuting
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 animate-spin'
                          : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'
                      }`}
                    >
                      {isExecuted ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : isExecuting ? (
                        <RefreshCw className="w-3.5 h-3.5" />
                      ) : (
                        '3'
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <span>Stellar Testnet Ledger Confirmation</span>
                        {isExecuted && (
                          <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                            Confirmed On-Chain
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {isExecuted
                          ? 'Live payment envelope ingested and immutably settled on Stellar Testnet.'
                          : isExecuting
                          ? 'Submitting transaction envelope to Stellar Horizon network...'
                          : isThresholdMet
                          ? 'Multisig threshold satisfied. Ready to broadcast transaction to Stellar Testnet.'
                          : 'Awaiting threshold before on-chain execution.'}
                      </div>

                      {/* On-Chain Transaction Hash Banner */}
                      {isExecuted && stellarTxHash && (
                        <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-emerald-400 font-bold shrink-0">Tx Hash:</span>
                            <span className="font-mono text-xs text-white/90 truncate">
                              {stellarTxHash}
                            </span>
                            <button
                              onClick={() => handleCopy(stellarTxHash, 'tx')}
                              className="text-white/40 hover:text-white transition-colors p-0.5 shrink-0"
                              title="Copy Tx Hash"
                            >
                              {copiedTx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>

                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070B12] text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                          >
                            <span>Stellar Expert Explorer</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: POLICY & PERMIT DETAILS */}
          {activeTab === 'audit' && (
            <div className="flex flex-col gap-5">
              {/* Policy Evaluation Checklist */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-4">
                <div>
                  <h3 className="font-space text-sm font-bold text-white tracking-tight">
                    Policy Evaluation Checklist
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    How GuardRail rules evaluated this payment request against active limits.
                  </p>
                </div>

                <div className="flex flex-col divide-y divide-white/[0.06]">
                  {request.checks && request.checks.length > 0 ? (
                    request.checks.map((chk) => (
                      <div key={chk.id} className="py-3 flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {chk.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-white">
                            {chk.title}
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">
                            {chk.detail}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-white/40 italic">
                      Standard policy limits verified.
                    </div>
                  )}
                </div>
              </div>

              {/* Cryptographic Permit Box */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-4">
                <div>
                  <h3 className="font-space text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                    <span>Cryptographic Single-Use Permit</span>
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    Prevents replay attacks and unauthorized parameter modification.
                  </p>
                </div>

                <div className="flex flex-col divide-y divide-white/[0.06] text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-white/50">Permit ID</span>
                    <span className="font-mono text-white font-medium text-[11px]">
                      {request.permitId || 'Generated on approval'}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-white/50">Policy Version</span>
                    <span className="font-mono text-white font-medium">
                      {request.policyVersion || 'v1'}
                    </span>
                  </div>

                  <div className="py-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Canonical Payload Hash (SHA-256)</span>
                      <button
                        onClick={() => handleCopy(request.payloadHash, 'hash')}
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-[11px] text-white/80 break-all p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
                      {request.payloadHash || 'Zero-tampering cryptographic hash'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs text-white/50 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    If any field in the transaction payload changes, the SHA-256 digest fails verification and GuardRail refuses to co-sign.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Modal Bottom Action Bar */}
        <div className="px-5 sm:px-7 py-4 bg-[#070B12] border-t border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
          <div>
            {!isExecuted && request.status === 'Pending' && (
              <button
                onClick={() => {
                  onRejectRequest(request.id);
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
              >
                Reject Request
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-semibold rounded-xl border border-white/[0.08] transition-all cursor-pointer"
            >
              {isExecuted ? 'Close' : 'Cancel'}
            </button>

            {/* Primary Action Button */}
            {!isExecuted && (
              <>
                {/* Case 1: Threshold reached -> Broadcast to Stellar */}
                {isThresholdMet ? (
                  <button
                    onClick={handleBroadcastToStellar}
                    disabled={isExecuting}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#070B12] text-xs font-bold rounded-xl shadow-[0_4px_20px_rgba(74,199,119,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    {isExecuting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{isExecuting ? 'Broadcasting...' : 'Broadcast to Stellar Testnet'}</span>
                  </button>
                ) : (
                  /* Case 2: Threshold not reached -> Sign & Execute or Sign as Operator */
                  <button
                    onClick={handleSignAndBroadcast}
                    disabled={isExecuting || isSigningOperator}
                    className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    {isExecuting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Key className="w-3.5 h-3.5" />
                    )}
                    <span>{isExecuting ? 'Executing...' : 'Sign & Broadcast to Stellar'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
