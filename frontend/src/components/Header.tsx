import React, { useState } from 'react';
import { Menu, Sparkles, Shield, Wallet, CheckCircle2, ChevronDown, LogOut } from 'lucide-react';
import { TabView, ControlledWalletState, OperatorWalletState } from '../types';
import { connectOfficialStellarWallet, openWalletProfileModal } from '../services/stellarWallet';

interface HeaderProps {
  currentTab: TabView;
  onOpenMobileSidebar: () => void;
  onOpenSimulateModal: () => void;
  controlledWallet: ControlledWalletState;
  operatorWallet?: OperatorWalletState;
  setOperatorWallet?: React.Dispatch<React.SetStateAction<OperatorWalletState>>;
  onSelectTab: (tab: TabView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onOpenSimulateModal,
  controlledWallet,
  operatorWallet,
  setOperatorWallet,
  onSelectTab,
}) => {
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);

  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'requests':
        return 'Agent Transaction Requests';
      case 'policies':
        return 'Policy Configuration';
      case 'ai-agent':
        return 'AI Agent Registration';
      case 'wallet-security':
        return 'Wallet Security Setup';
      case 'audit-log':
        return 'Transaction History & Audit Log';
      case 'settings':
        return 'Settings & Security';
      default:
        return 'GuardRail Platform';
    }
  };

  const getTabSubtitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return `Controlled wallet ${controlledWallet.address ? `${controlledWallet.address.slice(0, 6)}…${controlledWallet.address.slice(-4)}` : 'GCTR4…BHRA'} · Live Policy Evaluation`;
      case 'requests':
        return 'Real-time agent requests with cryptographic permits and policy checklists.';
      case 'policies':
        return 'Enforce per-transaction limits, rolling budgets, and allowlists before permits are issued.';
      case 'ai-agent':
        return 'Registered autonomous agents bound to controlled wallets with hashed API keys.';
      case 'wallet-security':
        return 'Stellar Multisig boundary: Agent(1) + CoSigner(1) = Medium Threshold(2).';
      case 'audit-log':
        return 'Immutable event audit trail with Stellar Testnet Explorer links.';
      case 'settings':
        return 'System health, emergency circuit breakers, and key rotation.';
      default:
        return '';
    }
  };

  const handleConnectWalletHeader = async () => {
    try {
      const info = await connectOfficialStellarWallet();
      if (setOperatorWallet) {
        setOperatorWallet({
          connected: true,
          address: info.address,
          ownershipVerified: true,
          balanceXlm: info.balanceXlm,
          walletName: info.walletName,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = () => {
    if (setOperatorWallet) {
      setOperatorWallet({
        connected: false,
        address: '',
        ownershipVerified: false,
        balanceXlm: '0.00',
      });
    }
    setIsWalletMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#09101A]/95 backdrop-blur-md border-b border-[#2B3340] px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-[#9099A5] hover:text-white rounded-md bg-[#1D2430] border border-[#2B3340]"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-space text-xl sm:text-2xl font-bold text-white tracking-tight">
              {getTabTitle()}
            </h1>
            {/* Warning Testnet badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#F2B036]/15 rounded border border-[#F2B036]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F2B036]" />
              <span className="font-space text-[11px] font-medium text-[#F2B036] tracking-tight whitespace-nowrap">
                Stellar Testnet
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#9099A5] mt-0.5 font-manrope">
            {getTabSubtitle()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 self-end md:self-auto flex-wrap">
        {/* Wallet Profile Badge in Navbar */}
        {operatorWallet?.connected ? (
          <div className="relative">
            <button
              onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1B2330] hover:bg-[#232E3F] border border-[#2B3340] rounded-lg text-xs transition-all cursor-pointer shadow-xs"
            >
              <div className="w-2 h-2 rounded-full bg-[#4AC777] animate-pulse" />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-white font-bold">
                    {operatorWallet.address.slice(0, 5)}…{operatorWallet.address.slice(-4)}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[#9099A5]" />
                </div>
                <span className="text-[10px] text-[#4AC777] font-semibold">
                  {operatorWallet.balanceXlm || '100.00'} XLM
                </span>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isWalletMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#1A222E] border border-[#2B3340] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-2">
                <div className="text-[11px] text-[#9099A5]">Connected Wallet Profile</div>
                <div className="p-2 bg-[#0E1520] rounded border border-[#2B3340]/60 font-mono text-xs text-white break-all">
                  {operatorWallet.address}
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#9099A5]">Status:</span>
                  <span className="text-[#4AC777] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Operator
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9099A5]">Testnet Balance:</span>
                  <span className="text-white font-bold">{operatorWallet.balanceXlm || '100.00'} XLM</span>
                </div>
                <button
                  onClick={() => {
                    setIsWalletMenuOpen(false);
                    openWalletProfileModal();
                  }}
                  className="mt-1 w-full py-1.5 px-2 bg-[#2B3340] hover:bg-[#364052] text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#4AC777]" />
                  <span>Stellar Wallets Kit Modal</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="w-full py-1.5 px-2 bg-[#ED4A49]/15 hover:bg-[#ED4A49]/25 text-[#ED4A49] text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect Wallet</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleConnectWalletHeader}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09121F] text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Connect Wallet</span>
          </button>
        )}

        {/* Quick simulation button */}
        <button
          onClick={onOpenSimulateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-[#EFF2F5] rounded-md transition-colors cursor-pointer shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#4AC777]" />
          <span>Simulate Request</span>
        </button>

        {/* Onboarding Wizard shortcut */}
        <button
          onClick={() => onSelectTab('onboarding')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4AC777]/15 hover:bg-[#4AC777]/25 border border-[#4AC777]/30 text-xs font-semibold text-[#4AC777] rounded-md transition-colors cursor-pointer"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Setup Wizard</span>
          <span className="sm:hidden">Setup</span>
        </button>
      </div>
    </header>
  );
};
