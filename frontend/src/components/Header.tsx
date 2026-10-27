import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Shield,
  Wallet,
  CheckCircle2,
  ChevronDown,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  User,
  Settings
} from 'lucide-react';
import { TabView, ControlledWalletState, OperatorWalletState } from '../types';
import { connectOfficialStellarWallet, openWalletProfileModal, disconnectOfficialStellarWallet } from '../services/stellarWallet';

interface HeaderProps {
  currentTab?: TabView;
  onOpenMobileSidebar: () => void;
  onOpenSimulateModal?: () => void;
  onOpenAuthModal?: () => void;
  controlledWallet: ControlledWalletState;
  operatorWallet?: OperatorWalletState;
  setOperatorWallet?: React.Dispatch<React.SetStateAction<OperatorWalletState>>;
  onSelectTab?: (tab: TabView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onOpenSimulateModal,
  onOpenAuthModal,
  controlledWallet,
  operatorWallet,
  setOperatorWallet,
  onSelectTab,
}) => {
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = (): TabView => {
    const p = location.pathname;
    if (p.includes('/requests')) return 'requests';
    if (p.includes('/policies')) return 'policies';
    if (p.includes('/ai-agent')) return 'ai-agent';
    if (p.includes('/wallet-security')) return 'wallet-security';
    if (p.includes('/audit-log')) return 'audit-log';
    if (p.includes('/settings')) return 'settings';
    return currentTab || 'dashboard';
  };

  const activeTab = getActiveTab();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getUsernameDisplay = () => {
    if (operatorWallet?.username) {
      return operatorWallet.username.startsWith('@')
        ? operatorWallet.username
        : `@${operatorWallet.username}`;
    }
    if (operatorWallet?.displayName) {
      return operatorWallet.displayName;
    }
    if (operatorWallet?.address) {
      return `@${operatorWallet.address.slice(0, 4)}…${operatorWallet.address.slice(-4)}`;
    }
    return '@guardrail';
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return `${getGreeting()}, ${getUsernameDisplay()}`;
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
    switch (activeTab) {
      case 'dashboard':
        return 'Stellar Multisig Security Boundary · 2-of-3 Threshold Active';
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

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (operatorWallet?.address) {
      navigator.clipboard.writeText(operatorWallet.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleConnectWalletHeader = async () => {
    if (onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }
    try {
      const info = await connectOfficialStellarWallet();
      if (setOperatorWallet) {
        setOperatorWallet({
          connected: true,
          address: info.address,
          ownershipVerified: false,
          balanceXlm: info.balanceXlm,
          walletName: info.walletName,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = async () => {
    await disconnectOfficialStellarWallet();
    localStorage.removeItem('guardrail_operator_profile');
    localStorage.removeItem('guardrail_operator_wallet');
    if (setOperatorWallet) {
      setOperatorWallet({
        connected: false,
        address: '',
        ownershipVerified: false,
        balanceXlm: '0.00',
        username: '',
        displayName: '',
        role: '',
        avatar: 'shield',
      });
    }
    setIsWalletMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#080C14]/85 backdrop-blur-2xl border-b border-white/[0.08] px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-white/70 hover:text-white rounded-xl bg-white/[0.05] border border-white/[0.08] backdrop-blur-md transition-all active:scale-95"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-space text-xl sm:text-2xl font-bold text-white tracking-tight">
              {getTabTitle()}
            </h1>
            {/* Apple-style Testnet pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-400/10 rounded-full border border-amber-400/20 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-space text-[11px] font-semibold text-amber-300 tracking-tight whitespace-nowrap">
                Stellar Testnet
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-white/50 mt-0.5 font-manrope font-normal tracking-wide">
            {getTabSubtitle()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 self-end md:self-auto flex-wrap">
        {/* Uniform Apple-Style Wallet Profile Badge */}
        {operatorWallet?.connected ? (
          <div className="relative">
            <button
              onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
              className="group flex items-center gap-2.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] hover:border-white/[0.16] rounded-full transition-all duration-200 cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_2px_12px_rgba(0,0,0,0.25)]"
              aria-label="Wallet profile menu"
            >
              {/* Profile Avatar Icon with status pip */}
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500/30 to-emerald-400/10 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-space font-bold text-xs shadow-inner">
                  {operatorWallet.username ? operatorWallet.username.charAt(0).toUpperCase() : 'G'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#080C14]" />
              </div>

              {/* ONLY XLM balance showing */}
              <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                {operatorWallet.balanceXlm || '100.00'} XLM
              </span>

              <ChevronDown
                className={`w-3.5 h-3.5 text-white/40 group-hover:text-white/80 transition-transform duration-200 ${
                  isWalletMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Apple-style Floating Dropdown */}
            {isWalletMenuOpen && (
              <div className="absolute right-0 mt-2.5 w-84 bg-[#0B101B]/95 border border-white/[0.12] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-2xl p-4.5 z-50 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150">
                {/* Header item */}
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500/30 to-emerald-400/10 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-space font-bold text-sm shadow-inner">
                      {operatorWallet.username ? operatorWallet.username.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <div>
                      <div className="font-space font-bold text-sm text-white">
                        {operatorWallet.displayName || 'Treasury Operator'}
                      </div>
                      <div className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                        @{operatorWallet.username || 'guardrail'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-space font-semibold px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-full flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    Verified Signer
                  </span>
                </div>

                {/* Connected Public Key Box */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-white/50 mb-1.5">
                    <span>Operator Public Key</span>
                    <button
                      onClick={handleCopyAddress}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                    >
                      {copiedAddress ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.08] font-mono text-[11px] text-white/80 break-all select-all leading-relaxed">
                    {operatorWallet.address}
                  </div>
                </div>

                {/* Mini stats grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl flex flex-col">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Testnet Balance</span>
                    <span className="font-space text-sm font-bold text-emerald-300 mt-1 tabular-nums">
                      {operatorWallet.balanceXlm || '100.00'} XLM
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl flex flex-col">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Multisig Role</span>
                    <span className="font-space text-sm font-bold text-white mt-1">
                      {operatorWallet.role || 'Operator (1/2)'}
                    </span>
                  </div>
                </div>

                {/* External Explorer Link */}
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${operatorWallet.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs text-white/70 hover:text-white transition-all cursor-pointer group"
                >
                  <span className="text-xs">Inspect on Stellar Expert</span>
                  <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-emerald-400 transition-colors" />
                </a>

                {/* Edit Profile & Username shortcut */}
                <button
                  onClick={() => {
                    setIsWalletMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs text-white/80 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit Profile & Username</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-white/30 -rotate-90 group-hover:text-white transition-transform" />
                </button>

                {/* Action buttons */}
                <div className="pt-2 flex flex-col gap-2 border-t border-white/[0.08]">
                  <button
                    onClick={() => {
                      setIsWalletMenuOpen(false);
                      openWalletProfileModal();
                    }}
                    className="w-full py-2 px-3 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] border border-white/[0.08] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Official Stellar Wallets Kit Modal</span>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal || handleConnectWalletHeader}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-[#080C14] text-xs font-bold rounded-full transition-all duration-200 cursor-pointer shadow-[0_4px_16px_rgba(48,209,88,0.3)] active:scale-95"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Connect Wallet</span>
          </button>
        )}
      </div>
    </header>
  );
};

