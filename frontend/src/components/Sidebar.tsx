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
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface SidebarProps {
  currentTab: TabView;
  onSelectTab: (tab: TabView) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  pendingCount?: number;
  onOpenSimulateModal: () => void;
  operatorWallet?: OperatorWalletState;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  pendingCount = 1,
  onOpenSimulateModal,
  operatorWallet,
}) => {
  const navItems = [
    {
      id: 'dashboard' as TabView,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'requests' as TabView,
      label: 'Requests',
      icon: FileText,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: 'policies' as TabView,
      label: 'Policies',
      icon: Shield,
    },
    {
      id: 'ai-agent' as TabView,
      label: 'AI Agent',
      icon: Bot,
    },
    {
      id: 'wallet-security' as TabView,
      label: 'Wallet Security',
      icon: Wallet,
    },
    {
      id: 'audit-log' as TabView,
      label: 'Audit Log',
      icon: ScrollText,
    },
    {
      id: 'settings' as TabView,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-60 bg-[#1D2430] border-r border-[#2B3340] flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-8">
          {/* Top Logo & Mobile Close button */}
          <div className="flex items-center justify-between pt-1 px-2">
            <button
              onClick={() => {
                onSelectTab('landing');
                onCloseMobile();
              }}
              className="text-left focus:outline-hidden hover:opacity-90 transition-opacity"
              title="Return to Landing Page"
            >
              <Logo size="md" />
            </button>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-[#9099A5] hover:text-white rounded-md hover:bg-[#202938]"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-[#202938] text-white shadow-xs'
                      : 'text-[#9099A5] hover:text-white hover:bg-[#202938]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-[#9099A5] group-hover:text-white'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span className="bg-[#F2B036]/20 text-[#F2B036] font-space text-xs px-1.5 py-0.5 rounded-full font-bold tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-3 pt-3 border-t border-[#2B3340]/60">
          {/* Operator Wallet Profile Card */}
          {operatorWallet?.connected ? (
            <div className="p-2.5 bg-[#141B26] border border-[#2B3340] rounded-lg flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#9099A5] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4AC777]" />
                  Operator Profile
                </span>
                <span className="font-space text-[10px] text-[#4AC777] font-bold">
                  {operatorWallet.balanceXlm || '100.00'} XLM
                </span>
              </div>
              <div className="font-mono text-xs text-white font-bold truncate">
                {operatorWallet.address}
              </div>
            </div>
          ) : (
            <div className="p-2 bg-[#141B26]/60 border border-[#2B3340]/40 rounded text-center">
              <span className="text-[11px] text-[#9099A5]">No Wallet Connected</span>
            </div>
          )}

          {/* Quick Simulation Trigger */}
          <button
            onClick={() => {
              onOpenSimulateModal();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#202938] hover:bg-[#232E3F] border border-[#2B3340] text-xs font-medium text-[#4AC777] rounded transition-colors group cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#4AC777] group-hover:scale-110 transition-transform" />
            <span>Simulate Agent Req</span>
          </button>

          {/* Landing Link & Network Badge */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => {
                onSelectTab('landing');
                onCloseMobile();
              }}
              className="text-[11px] text-[#9099A5] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Landing Page</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            {/* Stellar Testnet Pill */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#F2B036]/15 rounded border border-[#F2B036]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F2B036] shrink-0" />
              <span className="font-space text-[10px] font-medium text-[#F2B036] tracking-tight whitespace-nowrap">
                Stellar Testnet
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
