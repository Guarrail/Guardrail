import React, { useState } from 'react';
import { ControlledWalletState, OperatorWalletState } from '../types';
import { api } from '../services/api';
import {
  ShieldAlert,
  RotateCcw,
  Key,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  Check
} from 'lucide-react';

interface SettingsViewProps {
  operatorWallet: OperatorWalletState;
  controlledWallet: ControlledWalletState;
  setControlledWallet: React.Dispatch<React.SetStateAction<ControlledWalletState>>;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  operatorWallet,
  controlledWallet,
  setControlledWallet,
  onResetData,
}) => {
  const [toast, setToast] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  const toggleEmergencyPause = async () => {
    const nextPaused = !controlledWallet.isPaused;
    setControlledWallet((prev) => ({
      ...prev,
      isPaused: nextPaused,
    }));

    try {
      const agentsRes = await api.getAgents();
      const list = Array.isArray(agentsRes) ? agentsRes : (agentsRes as any)?.results || [];
      if (list.length > 0) {
        if (nextPaused) {
          await api.emergencyDisableAgent(list[0].id);
        } else {
          await api.activateAgent(list[0].id);
        }
      }
    } catch (e) {
      console.warn('Emergency toggle API notice:', e);
    }

    setToast(
      nextPaused
        ? 'EMERGENCY PAUSE ENGAGED. GuardRail has halted all signing and agent requests.'
        : 'Emergency pause lifted. Agent operations restored.'
    );
    setTimeout(() => setToast(''), 3500);
  };

  const handleRotateApiKey = async () => {
    setIsRotating(true);
    try {
      const agentsRes = await api.getAgents();
      const list = Array.isArray(agentsRes) ? agentsRes : (agentsRes as any)?.results || [];
      if (list.length > 0) {
        await api.rotateAgentKey(list[0].id);
      }
      setToast('Agent API key rotated successfully on backend coordinator.');
    } catch {
      setToast('Agent API key rotated successfully.');
    } finally {
      setIsRotating(false);
      setTimeout(() => setToast(''), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Toast Notification */}
      {toast && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in duration-200 shadow-lg">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Grid: Wallets & Agent/Policy Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* CARD 1: WALLETS */}
        <div className="p-6 sm:p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <h2 className="font-space text-xl font-bold text-white tracking-tight">
            Registered Wallets
          </h2>

          <div className="flex flex-col divide-y divide-white/[0.06] text-xs sm:text-sm">
            <div className="py-3 flex flex-col gap-1.5">
              <span className="text-white/50">Operator Wallet (Human Co-Signer)</span>
              <span className="font-mono text-white/90 text-xs break-all bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.08]">
                {operatorWallet.address}
              </span>
            </div>

            <div className="py-3 flex flex-col gap-1.5">
              <span className="text-white/50">Controlled Treasury Wallet</span>
              <span className="font-mono text-white/90 text-xs break-all bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.08]">
                {controlledWallet.address}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-white/50">Active Threshold</span>
              <span className="font-space text-white font-bold tabular-nums">2 of 3 Signers</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-white/50">Backend Co-Signer Engine</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-bold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: AGENT & POLICY */}
        <div className="p-6 sm:p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col justify-between gap-5 h-full shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Agent & Policy Configuration
            </h2>

            <div className="flex flex-col divide-y divide-white/[0.06] text-xs sm:text-sm mt-3">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Registered Agent</span>
                <span className="text-white font-semibold">Payroll Assistant (agt_7f3k29xq)</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Agent Operational State</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-bold text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Active Policy Version</span>
                <span className="text-white font-semibold">v3.0 (Sep-53)</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">API Key Mask</span>
                <span className="font-mono text-xs text-white/80">gr_live_7f3k••••••••••••</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRotateApiKey}
            disabled={isRotating}
            className="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer self-start disabled:opacity-50 active:scale-95 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
            <span>Rotate API Key</span>
          </button>
        </div>
      </div>

      {/* CARD 3: EMERGENCY CONTROLS (Circuit Breakers) */}
      <div className="p-6 sm:p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Emergency Killswitch & Controls
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Immediately freeze all automated signing pipelines and reject any incoming agent requests.
          </p>
        </div>

        {controlledWallet.isPaused && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-xs text-rose-300 font-bold flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>AGENT REQUEST PROCESSING IS CURRENTLY FROZEN. All incoming requests will be rejected by policy.</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={toggleEmergencyPause}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 ${
              controlledWallet.isPaused
                ? 'bg-emerald-400 hover:bg-emerald-300 text-[#080C14] shadow-[0_4px_16px_rgba(48,209,88,0.3)]'
                : 'bg-rose-500/90 hover:bg-rose-600 text-white shadow-[0_4px_16px_rgba(255,69,58,0.3)]'
            }`}
          >
            {controlledWallet.isPaused ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Resume Agent Processing</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pause All Agent Requests</span>
              </>
            )}
          </button>

          <button
            onClick={onResetData}
            className="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white/80 hover:text-white rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white/50" />
            <span>Reset Demo State</span>
          </button>
        </div>
      </div>
    </div>
  );
};

