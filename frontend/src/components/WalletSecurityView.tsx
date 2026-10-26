import React, { useState, useEffect } from 'react';
import { ControlledWalletState, WalletSigner, PrivilegeEscalationItem } from '../types';
import { api, ApiControlledWallet, ApiPrivilegeEscalation } from '../services/api';
import {
  Shield,
  Key,
  Bot,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Check,
  Lock,
  Copy,
  Sliders,
  Users,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  X,
  Plus,
  ShieldAlert,
} from 'lucide-react';

interface WalletSecurityViewProps {
  controlledWallet: ControlledWalletState;
  signers: WalletSigner[];
  onApplyConfig: () => void;
}

interface OperatorItem {
  id: string;
  address: string;
  alias: string;
  role: string;
  effective_role: string;
  is_verified: boolean;
  last_login: string | null;
}

export const WalletSecurityView: React.FC<WalletSecurityViewProps> = ({
  controlledWallet,
  signers,
  onApplyConfig,
}) => {
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Multisig weight configuration state
  const [isEditingWeights, setIsEditingWeights] = useState<boolean>(false);
  const [masterWeight, setMasterWeight] = useState<number>(controlledWallet.masterWeight ?? 1);
  const [agentWeight, setAgentWeight] = useState<number>(controlledWallet.agentSignerWeight ?? 1);
  const [cosignerWeight, setCosignerWeight] = useState<number>(controlledWallet.cosignerWeight ?? 1);
  const [thresholdMed, setThresholdMed] = useState<number>(controlledWallet.currentThreshold ?? 2);
  const [isSavingWeights, setIsSavingWeights] = useState<boolean>(false);

  // Shared Account & Privilege Escalation state
  const [operators, setOperators] = useState<OperatorItem[]>([]);
  const [escalations, setEscalations] = useState<ApiPrivilegeEscalation[]>([]);
  const [isEscalationModalOpen, setIsEscalationModalOpen] = useState<boolean>(false);
  const [requestedRole, setRequestedRole] = useState<string>('ADMIN');
  const [escalationReason, setEscalationReason] = useState<string>('');
  const [durationHours, setDurationHours] = useState<number>(4);
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState<boolean>(false);

  // Current viewer address (retrieved from localStorage or default)
  const [currentOperatorAddress, setCurrentOperatorAddress] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('guardrail_operator_profile');
      if (saved) return JSON.parse(saved).address || '';
    } catch {
      // ignore
    }
    return '';
  });

  const fetchSharedAccountData = async () => {
    try {
      const [opsData, escData] = await Promise.all([
        api.getOperators().catch(() => []),
        api.getEscalationRequests().catch(() => []),
      ]);

      const opList = Array.isArray(opsData) ? opsData : [];
      const escList = Array.isArray(escData) ? escData : (escData as { results?: ApiPrivilegeEscalation[] })?.results || [];

      setOperators(opList);
      setEscalations(escList);
    } catch (e) {
      console.warn('Error fetching shared account governance data:', e);
    }
  };

  useEffect(() => {
    fetchSharedAccountData();
  }, []);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleSaveWeights = async () => {
    const walletId = controlledWallet.id;
    if (!walletId) return;

    try {
      setIsSavingWeights(true);
      await api.updateWalletWeights(walletId, {
        master_weight: masterWeight,
        agent_signer_weight: agentWeight,
        cosigner_weight: cosignerWeight,
        threshold_med: thresholdMed,
      });

      setToastMessage('Multisig signing weights and threshold saved on backend.');
      setIsEditingWeights(false);
      onApplyConfig();
    } catch (err: unknown) {
      setToastMessage(`Failed to update weights: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingWeights(false);
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const handleRequestEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationReason.trim()) return;

    const opAddr = currentOperatorAddress || (operators[0]?.address ?? 'GBDEMOOPERATOR...');

    try {
      setIsSubmittingEscalation(true);
      await api.createEscalationRequest({
        operator_address: opAddr,
        requested_role: requestedRole,
        reason: escalationReason.trim(),
        duration_hours: durationHours,
      });

      setIsEscalationModalOpen(false);
      setEscalationReason('');
      setToastMessage('Privilege escalation request submitted. Dual-control approval pending.');
      fetchSharedAccountData();
    } catch (err: unknown) {
      setToastMessage(`Escalation request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingEscalation(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  const handleApproveEscalation = async (esc: ApiPrivilegeEscalation) => {
    const reviewer = currentOperatorAddress || 'GBREVIEWERADMINPUBKEYDEMO1234567890ABCDEFGH';

    // Check dual-control restriction
    if (esc.operator_address.trim() === reviewer.trim()) {
      setToastMessage('Dual-control policy error: You cannot approve your own escalation request.');
      setTimeout(() => setToastMessage(''), 3500);
      return;
    }

    try {
      await api.approveEscalationRequest(esc.id, reviewer, 'Dual-control authorization verified');
      setToastMessage(`Approved elevation to ${esc.requested_role} for ${esc.operator_alias || esc.operator_address.slice(0, 6)}.`);
      fetchSharedAccountData();
    } catch (err: unknown) {
      setToastMessage(`Approval failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const handleRejectEscalation = async (esc: ApiPrivilegeEscalation) => {
    const reviewer = currentOperatorAddress || 'GBREVIEWERADMINPUBKEYDEMO1234567890ABCDEFGH';

    try {
      await api.rejectEscalationRequest(esc.id, reviewer, 'Rejected by operator');
      setToastMessage(`Rejected escalation request for ${esc.requested_role}.`);
      fetchSharedAccountData();
    } catch (err: unknown) {
      setToastMessage(`Rejection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  const isCompliant = agentWeight < thresholdMed && (agentWeight + cosignerWeight) >= thresholdMed;

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in duration-200 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Grid: Controlled Treasury Wallet & Multisig Signer Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Column (5 cols): Controlled Treasury Wallet */}
        <div className="lg:col-span-5 p-6 sm:p-8 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-space text-xl font-bold text-white tracking-tight">
                Controlled Treasury Wallet
              </h2>
              <span className="text-[10px] font-space font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Verified
              </span>
            </div>

            <div className="font-mono text-xs text-white/90 break-all bg-white/[0.03] p-3 rounded-xl border border-white/[0.08] mt-3 flex items-center justify-between gap-2">
              <span className="truncate">{controlledWallet.address}</span>
              <button
                onClick={() => handleCopy(controlledWallet.address)}
                className="text-white/40 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                title="Copy address"
              >
                {copiedAddr === controlledWallet.address ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-white/[0.06] text-xs sm:text-sm">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-white/50">Ledger Network</span>
              <span className="font-space text-white font-medium">{controlledWallet.network}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-white/50">Medium Threshold</span>
              <span className="font-space text-white font-bold text-right tabular-nums">
                {thresholdMed} (Payments)
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-white/50">Agent Signer Weight</span>
              <span className="font-space font-bold text-right text-blue-400">
                {agentWeight}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-white/50">Co-Signer Weight</span>
              <span className="font-space font-bold text-right text-purple-400">
                {cosignerWeight}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-white/50">Master Key Weight</span>
              <span className="font-space font-bold text-right text-emerald-400">
                {masterWeight}
              </span>
            </div>
          </div>

          {/* Compliance Badge */}
          <div className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-semibold ${
            isCompliant
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}>
            {isCompliant ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>
              {isCompliant
                ? 'Security Compliant: Agent alone cannot move funds without co-signer.'
                : 'Warning: Current weights allow independent single-key execution!'}
            </span>
          </div>
        </div>

        {/* Right Column (7 cols): Multisig Weight Manager */}
        <div className="lg:col-span-7 p-6 sm:p-8 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-space text-xl font-bold text-white tracking-tight">
                Multisig Signer Weights
              </h2>
              <p className="text-xs text-white/50 mt-1">
                Configure Stellar threshold weights to enforce dual authorization.
              </p>
            </div>

            <button
              onClick={() => setIsEditingWeights(!isEditingWeights)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-white/80 hover:text-white transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isEditingWeights ? 'Cancel Edit' : 'Edit Weights'}</span>
            </button>
          </div>

          {isEditingWeights ? (
            <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/70">Master Key Weight</label>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={masterWeight}
                    onChange={(e) => setMasterWeight(parseInt(e.target.value) || 0)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-white/40">Set to 0 to neutralize single-key compromise</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/70">Medium Threshold (Payments)</label>
                  <input
                    type="number"
                    min={1}
                    max={255}
                    value={thresholdMed}
                    onChange={(e) => setThresholdMed(parseInt(e.target.value) || 2)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-white/40">Total weight required to move funds</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/70">Agent Signer Weight</label>
                  <input
                    type="number"
                    min={1}
                    max={255}
                    value={agentWeight}
                    onChange={(e) => setAgentWeight(parseInt(e.target.value) || 1)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/70">GuardRail Co-Signer Weight</label>
                  <input
                    type="number"
                    min={1}
                    max={255}
                    value={cosignerWeight}
                    onChange={(e) => setCosignerWeight(parseInt(e.target.value) || 1)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveWeights}
                disabled={isSavingWeights}
                className="mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSavingWeights ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Multisig Weight Configuration</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {signers.map((signer) => (
                <div
                  key={signer.role}
                  className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-start justify-between gap-3 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{signer.role}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-full font-medium">
                        Active
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-white/45 truncate my-0.5">
                      {signer.address}
                    </div>
                    <div className="text-xs text-white/50">{signer.description}</div>
                  </div>

                  <span className="font-space text-xs font-semibold text-white/70 shrink-0 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                    Weight: {signer.weight}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- SECTION 2: SHARED ACCOUNT GOVERNANCE & PRIVILEGE ESCALATION --- */}
      <div className="p-6 sm:p-8 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl flex flex-col gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-bold text-white tracking-tight">
                Shared Account & Privilege Escalation Flow
              </h2>
              <p className="text-xs text-white/50">
                Multi-operator dual-control authorization for shared Stellar treasury management.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEscalationModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Request Privilege Escalation</span>
          </button>
        </div>

        {/* Dual Control Notice Banner */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3 text-xs text-blue-300">
          <ShieldAlert className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
          <span>
            <strong className="text-white">Dual-Control Enforcement:</strong> Member operators can submit privilege elevation requests with an operational justification. To uphold segregation of duties, approval strictly requires authorization by a distinct administrator.
          </span>
        </div>

        {/* Operators Roster Table */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Active Operators</span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {operators.map((op) => (
              <div
                key={op.id}
                className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white">
                      {(op.alias || 'O')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-white">{op.alias || 'Operator'}</span>
                      <div className="font-mono text-[10px] text-white/40 truncate max-w-[120px]">{op.address}</div>
                    </div>
                  </div>

                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    op.effective_role === 'ADMIN'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : op.effective_role === 'SIGNER_ADMIN'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {op.effective_role || op.role}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/[0.04]">
                  <span>Status: {op.is_verified ? 'Verified (SEP-10)' : 'Unverified'}</span>
                  <span>{op.last_login ? new Date(op.last_login).toLocaleDateString() : 'Never'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalation Requests Queue */}
        <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
            Escalation Requests Queue ({escalations.length})
          </span>

          {escalations.length === 0 ? (
            <div className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-center text-xs text-white/40">
              No privilege escalation requests submitted yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {escalations.map((esc) => {
                const isPending = esc.status === 'PENDING';
                return (
                  <div
                    key={esc.id}
                    className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-white/[0.14] transition-all"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">{esc.operator_alias || 'Operator'}</span>
                        <span className="text-[10px] font-mono text-white/40">({esc.operator_address.slice(0, 6)}...{esc.operator_address.slice(-4)})</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {esc.requested_role} ({esc.duration_hours}h)
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          esc.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : esc.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {esc.status}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 italic">&quot;{esc.reason}&quot;</p>
                      {esc.expires_at && (
                        <span className="text-[10px] text-white/40">
                          Expires: {new Date(esc.expires_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRejectEscalation(esc)}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 border border-white/[0.08] hover:border-rose-500/30 text-xs font-semibold text-white/70 hover:text-rose-300 transition-all cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveEscalation(esc)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve (Dual Control)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL: REQUEST PRIVILEGE ESCALATION --- */}
      {isEscalationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md p-6 sm:p-8 bg-[#0d1522]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.7)] flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-purple-400" />
                <h3 className="font-space font-bold text-white text-base">Request Elevated Privileges</h3>
              </div>
              <button
                onClick={() => setIsEscalationModalOpen(false)}
                className="text-white/50 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestEscalation} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-white/70 font-semibold">Requested Role</label>
                <select
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#141b27] border border-white/[0.12] text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ADMIN">ADMIN (Full Treasury & Wallet Authority)</option>
                  <option value="SIGNER_ADMIN">SIGNER_ADMIN (Multisig Weight & Key Management)</option>
                  <option value="POLICY_ADMIN">POLICY_ADMIN (Financial Rules & Allowlist Editing)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-white/70 font-semibold">Duration (Hours)</label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(parseInt(e.target.value) || 4)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#141b27] border border-white/[0.12] text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value={1}>1 Hour (Emergency fix)</option>
                  <option value={4}>4 Hours (Standard maintenance window)</option>
                  <option value={8}>8 Hours (Full operational shift)</option>
                  <option value={24}>24 Hours (Daily deployment cycle)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-white/70 font-semibold">Operational Justification / Reason</label>
                <textarea
                  required
                  rows={3}
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="e.g. Need to rebalance multisig signer weights and register new contractor allowlist..."
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsEscalationModalOpen(false)}
                  className="px-4 py-2 text-white/60 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEscalation}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md transition-all cursor-pointer"
                >
                  {isSubmittingEscalation ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
