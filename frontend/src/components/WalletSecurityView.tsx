import React, { useState } from 'react';
import { ControlledWalletState, WalletSigner } from '../types';
import {
  Shield,
  Key,
  Bot,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Check
} from 'lucide-react';

interface WalletSecurityViewProps {
  controlledWallet: ControlledWalletState;
  signers: WalletSigner[];
  onApplyConfig: () => void;
}

export const WalletSecurityView: React.FC<WalletSecurityViewProps> = ({
  controlledWallet,
  signers,
  onApplyConfig,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(controlledWallet.currentThreshold === 2);

  const handleApply = () => {
    setIsApplying(true);
    setTimeout(() => {
      setIsApplying(false);
      setApplied(true);
      onApplyConfig();
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Top Grid: Controlled Wallet Status & Proposed Signers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Controlled Wallet */}
        <div className="lg:col-span-5 p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-5">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Controlled wallet
            </h2>
            <div className="font-mono text-xs sm:text-sm text-white font-semibold break-all bg-[#09101A] p-2.5 rounded-lg border border-[#2B3340] mt-2">
              {controlledWallet.address}
            </div>
          </div>

          <div className="flex flex-col divide-y divide-[#2B3340] text-xs sm:text-sm">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9099A5]">Ownership</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#4AC777]/15 text-[#4AC777] font-bold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4AC777]" />
                Verified
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9099A5]">Network</span>
              <span className="text-white font-medium">{controlledWallet.network}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9099A5]">Current signers</span>
              <span className="text-white font-medium text-right">
                {applied ? '3 active signers' : '1 (master key)'}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#9099A5]">Current threshold</span>
              <span className="font-space text-white font-bold text-right">
                {applied ? '2 of 3' : '1'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Proposed Signer Configuration */}
        <div className="lg:col-span-7 p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-5">
          <div>
            <h2 className="font-space text-xl font-bold text-white tracking-tight">
              Proposed signer configuration
            </h2>
            <p className="text-xs sm:text-sm text-[#9099A5] mt-1">
              Each signer has weight 1. Medium & high thresholds set to 2.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {signers.map((signer, idx) => (
              <div
                key={signer.role}
                className="p-3.5 bg-[#202938] border border-[#2B3340] rounded-lg flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{signer.role}</span>
                    {applied && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#4AC777]/20 text-[#4AC777] rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-[#9099A5] truncate my-0.5">
                    {signer.address}
                  </div>
                  <div className="text-xs text-[#9099A5]">
                    {signer.description}
                  </div>
                </div>

                <span className="font-space text-xs font-semibold text-[#9099A5] shrink-0">
                  weight {signer.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Card: Security Preview (Plain Language) */}
      <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-5">
        <div>
          <h2 className="font-space text-xl font-bold text-white tracking-tight">
            Security preview
          </h2>
          <p className="text-xs sm:text-sm text-[#9099A5] mt-0.5">
            What this configuration means in plain language.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-white">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#4AC777] shrink-0" />
            <span>Signature threshold: 2 of 3</span>
          </div>

          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#4AC777] shrink-0" />
            <span>The agent alone can never move funds.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#4AC777] shrink-0" />
            <span>GuardRail + agent execute permitted payments without waiting.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#4AC777] shrink-0" />
            <span>You + agent (or you + GuardRail) authorize payments needing human approval.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#4AC777] shrink-0" />
            <span>The master key will be removed to prevent bypass.</span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="p-4 bg-[#ED4A49]/10 border border-[#ED4A49]/40 rounded-lg flex items-start gap-3 text-xs text-[#ED4A49]">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#ED4A49] mt-0.5" />
          <span>
            Changing signers and thresholds is irreversible without the new signers. If misconfigured, you may lose access to the wallet. Use a dedicated Testnet wallet.
          </span>
        </div>

        {/* Acknowledgment & Action */}
        {!applied ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="w-4 h-4 rounded border-[#2B3340] text-[#4AC777] focus:ring-0"
              />
              <span className="text-xs sm:text-sm text-white">
                I understand and have reviewed the signer configuration.
              </span>
            </label>

            <button
              onClick={handleApply}
              disabled={!acknowledged || isApplying}
              className="px-6 py-3 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-bold text-xs sm:text-sm rounded-md transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 shrink-0"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Configuring On-Chain Signers...</span>
                </>
              ) : (
                <span>Approve & Set 2-of-3 Multisig</span>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-[#4AC777]/15 border border-[#4AC777]/30 rounded-lg text-xs sm:text-sm text-[#4AC777]">
            <div className="flex items-center gap-2 font-bold">
              <Check className="w-4 h-4" />
              <span>Multisig 2-of-3 threshold is active and enforced on-chain.</span>
            </div>
            <span className="font-mono text-xs text-white">
              Weights: [1, 1, 1] · Threshold: 2
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
