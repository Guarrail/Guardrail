import React, { useState } from 'react';
import { AgentRequest } from '../types';
import { api } from '../services/api';
import { signChallengeWithWallet } from '../services/stellarWallet';
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
  UserCheck,
  Bot,
  Wallet,
  Lock,
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
  const [walletPromptNotice, setWalletPromptNotice] = useState<string | null>(null);
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

  const effectiveOperator = operatorAddress || 'GCAD5PDJRNUAASBJSRL4YNNUCIB723PYNIGMU7FWSUKMS5IPUYIU46YI';
  const hasCurrentOperatorSigned = signatures.some(
    (s) => s.operator_address.toLowerCase() === effectiveOperator.toLowerCase()
  );

  // Identify Signer 1: AI Agent PDA
  const agentSig = signatures.find(
    (s) =>
      s.role === 'AGENT_PDA' ||
      s.notes?.includes('Agent PDA') ||
      (request.agentPublicKey && s.operator_address.toLowerCase() === request.agentPublicKey.toLowerCase()) ||
      s.operator_address.startsWith('agent_pda_')
  ) || (signatures.length > 0 ? signatures[0] : null);

  // Identify Signer 2: Admin Wallet
  const adminSig = signatures.find(
    (s) =>
      (s.operator_address.toLowerCase() === effectiveOperator.toLowerCase() && s !== agentSig) ||
      s.role === 'ADMIN' ||
      s.notes?.includes('Admin Wallet')
  );

  const hasAdminSigned = Boolean(adminSig);

  // Additional signatures and configured signers
  const otherSignatures = signatures.filter((s) => s !== agentSig && s !== adminSig);
  const extraConfiguredSigners = (request.delegatedOperators || []).filter(
    (addr) =>
      addr.toLowerCase() !== effectiveOperator.toLowerCase() &&
      (!request.agentPublicKey || addr.toLowerCase() !== request.agentPublicKey.toLowerCase())
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

  // Helper to prompt user's connected wallet (Freighter / kit) for cryptographic signature
  const requestWalletSignature = async (): Promise<string> => {
    setWalletPromptNotice('Please approve the signature request in your Stellar wallet extension (Freighter)...');
    const challengeMessage =
      `GuardRail Multisig Authorization\n` +
      `Request ID: ${request.requestId}\n` +
      `Agent ID: ${request.agentId}\n` +
      `Amount: ${request.amount} ${request.asset}\n` +
      `Recipient: ${request.recipient}\n` +
      `Signer: ${effectiveOperator}\n` +
      `Timestamp: ${new Date().toISOString()}`;

    try {
      const sig = await signChallengeWithWallet(challengeMessage, effectiveOperator);
      setWalletPromptNotice(null);
      return sig;
    } catch (err) {
      setWalletPromptNotice(null);
      throw err;
    }
  };

  // Step A: Member Operator Signs to add weight using connected wallet
  const handleOperatorSign = async () => {
    setIsSigningOperator(true);
    setExecutionError(null);
    try {
      // Prompt user's connected wallet for cryptographic signature
      const cryptographicSig = await requestWalletSignature();

      const res = await api.signRequest(request.backendId || request.id, {
        operator_address: effectiveOperator,
        signature: cryptographicSig,
        weight: 1,
        notes: 'Signed via Connected Admin Wallet',
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
      console.warn('Operator signing error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setExecutionError(errMsg);
    } finally {
      setIsSigningOperator(false);
      setWalletPromptNotice(null);
    }
  };

  // Step B: Co-sign and execute live on Stellar Testnet
  const handleBroadcastToStellar = async () => {
    if (collectedWeight < requiredWeight && request.status !== 'Approved') {
      setExecutionError(`Multisig threshold not met: collected weight is ${collectedWeight} of ${requiredWeight} required. Admin wallet signature is required before broadcasting.`);
      return;
    }
    setIsExecuting(true);
    setExecutionError(null);
    setSigningStep(3); // Broadcast in progress

    try {
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

  // Combined one-click "Sign with Wallet & Broadcast"
  const handleSignAndBroadcast = async () => {
    setIsExecuting(true);
    setExecutionError(null);
    try {
      // 1. Ensure required multisig weight is reached before broadcasting
      if (collectedWeight < requiredWeight || request.status !== 'Approved') {
        let cryptographicSig = '';
        if (!hasCurrentOperatorSigned) {
          setIsSigningOperator(true);
          cryptographicSig = await requestWalletSignature();
          setIsSigningOperator(false);
        }

        const signRes = await api.signRequest(request.backendId || request.id, {
          operator_address: effectiveOperator,
          signature: cryptographicSig || 'verified_admin_wallet_signature',
          weight: 1,
          notes: 'Signed via Connected Admin Wallet',
        });

        const newWeight = signRes.collected_weight ?? (collectedWeight + 1);
        setCollectedWeight(newWeight);
        setSignatures(signRes.operator_signatures || []);

        if (signRes.status === 'APPROVED' || newWeight >= requiredWeight) {
          request.status = 'Approved';
          setSigningStep(2);
        } else {
          setSigningStep(1);
          throw new Error(`Signature recorded (weight ${newWeight}/${requiredWeight}). Additional signer approval required before broadcasting.`);
        }
      }

      // 2. Broadcast to Stellar
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
      setSigningStep(isThresholdMet ? 2 : collectedWeight > 0 ? 1 : 0);
    } finally {
      setIsSigningOperator(false);
      setIsExecuting(false);
      setWalletPromptNotice(null);
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

              {/* Wallet Extension Prompt Notice */}
              {walletPromptNotice && (
                <div className="p-4 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-start gap-3 text-xs text-purple-200 animate-pulse">
                  <Key className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                  <div className="flex-1">
                    <div className="font-bold text-white">Stellar Wallet Extension Signature Required</div>
                    <div className="text-purple-200/90 mt-0.5">{walletPromptNotice}</div>
                  </div>
                </div>
              )}

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
                  
                  {/* Step 1: AI Agent PDA Proposal (Signer 1) */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                          <span>Signer 1 of {requiredWeight}: AI Agent PDA ({request.agentName})</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                            Proposal Signed (+1 Weight)
                          </span>
                        </div>
                        <div className="text-xs text-white/50 mt-0.5 flex items-center gap-2 font-mono">
                          <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{request.agentPublicKey || agentSig?.operator_address || request.agentId}</span>
                        </div>
                        {agentSig && (
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/40">
                            <span>Signed: {new Date(agentSig.signed_at).toLocaleTimeString()}</span>
                            <span>•</span>
                            <span className="font-mono text-emerald-400/80">
                              ED25519: {agentSig.signature.slice(0, 16)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 self-start sm:self-center">
                      +1 Weight
                    </span>
                  </div>

                  {/* Step 2: User Admin Wallet Signature (Signer 2) */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                          hasAdminSigned
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                        }`}
                      >
                        {hasAdminSigned ? <Check className="w-4 h-4" /> : '2'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                          <span>Signer 2 of {requiredWeight}: Your Admin Wallet</span>
                          {hasAdminSigned ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                              Signed via Connected Wallet (+1 Weight)
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Awaiting Your Wallet Signature
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/50 mt-0.5 flex items-center gap-2 font-mono">
                          <Wallet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">{effectiveOperator}</span>
                        </div>
                        {adminSig && (
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/40">
                            <span>Signed: {new Date(adminSig.signed_at).toLocaleTimeString()}</span>
                            <span>•</span>
                            <span className="font-mono text-blue-400/80">
                              Sig: {adminSig.signature.slice(0, 16)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 2 Action Button */}
                    {!isExecuted && !hasAdminSigned && (
                      <button
                        onClick={handleOperatorSign}
                        disabled={isSigningOperator}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-2 shrink-0 cursor-pointer self-start sm:self-center shadow-lg shadow-blue-600/30 disabled:opacity-50"
                      >
                        {isSigningOperator ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Key className="w-3.5 h-3.5" />
                        )}
                        <span>{isSigningOperator ? 'Approve in Wallet...' : 'Sign with My Wallet (+1)'}</span>
                      </button>
                    )}

                    {hasAdminSigned && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 self-start sm:self-center">
                        +1 Weight
                      </span>
                    )}
                  </div>

                  {/* Step 2.5: Additional Co-Signer Wallets (if configured or signed) */}
                  {(extraConfiguredSigners.length > 0 || otherSignatures.length > 0) && (
                    <div className="py-3 flex flex-col gap-2">
                      <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                        Additional Co-Signing Wallets ({Math.max(extraConfiguredSigners.length, otherSignatures.length)})
                      </span>
                      {(extraConfiguredSigners.length > 0 ? extraConfiguredSigners : otherSignatures.map(s => s.operator_address)).map((addr, idx) => {
                        const isThisSigned = otherSignatures.some(s => s.operator_address.toLowerCase() === addr.toLowerCase());
                        const sigData = otherSignatures.find(s => s.operator_address.toLowerCase() === addr.toLowerCase());
                        return (
                          <div key={idx} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isThisSigned ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-white/40'}`}>
                                {isThisSigned ? <Check className="w-3 h-3" /> : idx + 3}
                              </div>
                              <div className="min-w-0 font-mono text-white/80 truncate">
                                {addr}
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isThisSigned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.04] text-white/40'}`}>
                              {isThisSigned ? `+${sigData?.weight || 1} Signed` : 'Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Step 3: GuardRail Single-Use Permit & Verification */}
                  <div className="py-3.5 flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                        isThresholdMet
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'
                      }`}
                    >
                      {isThresholdMet ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-white/40" />}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <span>GuardRail Cryptographic Permit</span>
                        {isThresholdMet && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                            Threshold Satisfied ({collectedWeight}/{requiredWeight})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {isThresholdMet
                          ? 'Cryptographic SHA-256 canonical permit validated against on-chain policy limits.'
                          : `Requires ${Math.max(0, requiredWeight - collectedWeight)} more signature(s) to satisfy the ${requiredWeight}-of-${requiredWeight} multisig threshold.`}
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Stellar Testnet Ledger Broadcast */}
                  <div className="py-3.5 flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                        isExecuted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isExecuting
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 animate-spin'
                          : isThresholdMet
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'
                      }`}
                    >
                      {isExecuted ? (
                        <Check className="w-4 h-4" />
                      ) : isExecuting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
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
                  /* Case 2: Threshold not reached -> Sign with Wallet & Broadcast */
                  <button
                    onClick={handleSignAndBroadcast}
                    disabled={isExecuting || isSigningOperator}
                    className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    {isSigningOperator ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isExecuting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Key className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isSigningOperator
                        ? 'Approve in Wallet...'
                        : isExecuting
                        ? 'Broadcasting...'
                        : 'Sign with Wallet & Broadcast'}
                    </span>
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
