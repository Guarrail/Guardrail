import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TabView, OperatorWalletState } from '../types';
import { Logo } from './Logo';
import {
  LayoutDashboard,
  FileText,
  Shield,
  Bot,
  Wallet,
  ScrollText,
  Settings,
  X,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';

interface SidebarProps {
  currentTab?: TabView;
  onSelectTab?: (tab: TabView) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  pendingCount?: number;
  onOpenSimulateModal?: () => void;
  operatorWallet?: OperatorWalletState;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  pendingCount = 1,
  operatorWallet,
}) => {
  const location = useLocation();
  const [copiedAddr, setCopiedAddr] = useState(false);

  const handleCopyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const navItems = [
    {
      id: 'dashboard' as TabView,
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'requests' as TabView,
      path: '/requests',
      label: 'Requests',
      icon: FileText,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: 'policies' as TabView,
      path: '/policies',
      label: 'Policies',
      icon: Shield,
    },
    {
      id: 'ai-agent' as TabView,
      path: '/ai-agents',
      label: 'AI Agent',
      icon: Bot,
    },
    {
      id: 'wallet-security' as TabView,
      path: '/wallet-security',
      label: 'Wallet Security',
      icon: Wallet,
    },
    {
      id: 'audit-log' as TabView,
      path: '/audit-log',
      label: 'Audit Log',
      icon: ScrollText,
    },
    {
      id: 'settings' as TabView,
      path: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/75 z-40 lg:hidden backdrop-blur-md transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-60 bg-[#0A0E18]/90 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-7">
          {/* Top Logo & Mobile Close button */}
          <div className="flex items-center justify-between pt-1 px-2">
            <Link
              to="/"
              onClick={onCloseMobile}
              className="text-left focus:outline-hidden hover:opacity-90 transition-opacity"
              title="Return to Landing Page"
            >
              <Logo size="md" />
            </Link>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-white/60 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === '/dashboard' && (location.pathname === '/' || location.pathname === '')) ||
                (item.path === '/ai-agents' && location.pathname === '/ai-agent');
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => {
                    if (onSelectTab) onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-white/[0.09] text-white border border-white/[0.1] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_10px_rgba(0,0,0,0.2)] font-semibold'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-emerald-400' : 'text-white/50 group-hover:text-white'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span className="bg-amber-400/15 text-amber-300 border border-amber-400/25 font-space text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.08]">
          {/* Operator Wallet Profile Card */}
          {operatorWallet?.connected ? (
            <div className="p-3 bg-white/[0.035] border border-white/[0.08] rounded-2xl backdrop-blur-md flex flex-col gap-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500/30 to-emerald-400/10 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-space font-bold text-[10px]">
                      {operatorWallet.username ? operatorWallet.username.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-[#0A0E18]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-white font-space font-bold text-xs truncate">
                      {operatorWallet.username ? `@${operatorWallet.username}` : 'Operator'}
                    </span>
                    <span className="text-[10px] text-white/50 truncate">
                      {operatorWallet.role || 'Treasury Operator'}
                    </span>
                  </div>
                </div>
                <span className="font-space text-[10px] text-emerald-300 font-bold shrink-0 tabular-nums px-1.5 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  {operatorWallet.balanceXlm || '100.00'} XLM
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/[0.06]">
                <span className="font-mono">
                  {operatorWallet.address.slice(0, 5)}…{operatorWallet.address.slice(-4)}
                </span>
                <button
                  onClick={() => handleCopyAddr(operatorWallet.address)}
                  className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1"
                  title="Copy address"
                >
                  {copiedAddr ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{copiedAddr ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
              <span className="text-xs text-white/50">Wallet Not Connected</span>
            </div>
          )}

          {/* Landing Link & Network Badge */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => {
                if (onSelectTab) onSelectTab('landing');
                onCloseMobile();
              }}
              className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Landing Page</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            {/* Stellar Testnet Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-400/10 rounded-full border border-amber-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="font-space text-[10px] font-medium text-amber-300 tracking-tight whitespace-nowrap">
                Stellar Testnet
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
