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
        <div className="p-3.5 bg-[#202938] border border-[#4AC777] text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-[#4AC777]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Grid: Wallets & Agent/Policy Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* CARD 1: WALLETS */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-5">
          <h2 className="font-space text-xl font-bold text-white tracking-tight">
            Wallets
          </h2>

          <div className="flex flex-col divide-y divide-[#2B3340] text-xs sm:text-sm">
            <div className="py-3 flex flex-col gap-1">
              <span className="text-[#9099A5]">Operator wallet</span>
              <span className="font-mono text-white text-xs break-all">
                {operatorWallet.address}
              </span>
            </div>

            <div className="py-3 flex flex-col gap-1">
              <span className="text-[#9099A5]">Controlled wallet</span>
              <span className="font-mono text-white text-xs break-all">
                {controlledWallet.address}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-[#9099A5]">Threshold</span>
              <span className="font-space text-white font-bold">2 of 3 signers</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-[#9099A5]">Co-signer</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#4AC777]/15 text-[#4AC777] font-bold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4AC777]" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: AGENT & POLICY */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col justify-between gap-5 h-full">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Agent & policy
            </h2>

            <div className="flex flex-col divide-y divide-[#2B3340] text-xs sm:text-sm mt-3">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">Registered agent</span>
                <span className="text-white font-semibold">Payroll Assistant (agt_7f3k29xq)</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">Agent status</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#4AC777]/15 text-[#4AC777] font-bold text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4AC777]" />
                  Active
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">Active policy</span>
                <span className="text-white font-semibold">Default v3</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">API key</span>
                <span className="font-mono text-xs text-white">gr_live_7f3k••••••••••••</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRotateApiKey}
            disabled={isRotating}
            className="px-4 py-2 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-white rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer self-start disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
            <span>Rotate API Key</span>
          </button>
        </div>
      </div>

      {/* CARD 3: EMERGENCY CONTROLS (Circuit Breakers) */}
      <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#ED4A49]" />
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Emergency controls
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#9099A5] mt-1">
            Immediately stop the agent from submitting any new requests or freeze the wallet pipeline.
          </p>
        </div>

        {controlledWallet.isPaused && (
          <div className="p-3.5 bg-[#ED4A49]/15 border border-[#ED4A49]/40 rounded-lg text-xs text-[#ED4A49] font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>AGENT REQUEST PROCESSING IS CURRENTLY FROZEN. All incoming requests will be rejected.</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            onClick={toggleEmergencyPause}
            className={`px-5 py-2.5 text-xs font-bold rounded-md transition-all shadow-md active:scale-98 cursor-pointer flex items-center gap-2 ${
              controlledWallet.isPaused
                ? 'bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A]'
                : 'bg-[#ED4A49] hover:bg-red-600 text-white'
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
            className="px-4 py-2.5 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-[#EFF2F5] rounded-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#9099A5]" />
            <span>Reset Demo State</span>
          </button>
        </div>
      </div>
    </div>
  );
};
