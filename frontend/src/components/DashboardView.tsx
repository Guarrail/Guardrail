import React, { useState, useRef, useEffect } from 'react';
import { AgentRequest, PolicyConfig, ControlledWalletState, TabView, WalletAsset } from '../types';
import {
  ArrowRight,
  Shield,
  Bot,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sliders,
  Check,
  Lock,
  ChevronDown,
  Coins,
  Copy,
} from 'lucide-react';

interface DashboardViewProps {
  requests: AgentRequest[];
  policyConfig: PolicyConfig;
  controlledWallet: ControlledWalletState;
  onSelectTab: (tab: TabView) => void;
  onSelectRequest: (req: AgentRequest) => void;
  onApproveQuick: (req: AgentRequest) => void;
  onRejectQuick: (req: AgentRequest) => void;
  onOpenSimulateModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  requests,
  policyConfig,
  controlledWallet,
  onSelectTab,
  onSelectRequest,
  onApproveQuick,
  onRejectQuick,
}) => {
  // Available wallet assets breakdown
  const defaultAssets: WalletAsset[] = [
    {
      asset_code: 'USDC',
      asset_name: 'USD Coin (Circle)',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      balance: controlledWallet.balanceUsdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      is_native: false,
      usd_rate: 1.0,
    },
    {
      asset_code: 'XLM',
      asset_name: 'Stellar Lumens',
      issuer: null,
      balance: parseFloat(controlledWallet.balanceXlm || '100.00').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      is_native: true,
      usd_rate: 0.12,
    },
    {
      asset_code: 'EURC',
      asset_name: 'Euro Coin (Circle)',
      issuer: 'GDQOE23CFSUMSVQK4Y5JHPP0C4VNMSJ53O234LMNASDFG342',
      balance: '1,800.00',
      is_native: false,
      usd_rate: 1.08,
    },
  ];

  const assets: WalletAsset[] =
    controlledWallet.assetBalances && controlledWallet.assetBalances.length > 0
      ? controlledWallet.assetBalances
      : defaultAssets;

  const [selectedAssetCode, setSelectedAssetCode] = useState<string>('USDC');
  const [isAssetsDropdownOpen, setIsAssetsDropdownOpen] = useState<boolean>(false);
  const [copiedIssuer, setCopiedIssuer] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAssetsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentAsset = assets.find((a) => a.asset_code === selectedAssetCode) || assets[0];

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIssuer(text);
    setTimeout(() => setCopiedIssuer(null), 2000);
  };

  // Dynamic stats calculated from real state
  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const executedCount = requests.filter((r) => r.status === 'Executed' || r.status === 'Approved').length;
  const blockedCount = requests.filter((r) => r.status === 'Blocked').length;
  const weeklyUsagePercent = Math.min(
    100,
    Math.round((policyConfig.weeklySpent / (policyConfig.weeklyLimit || 1)) * 100)
  );

  // Take the 4 most recent requests
  const recentRequests = requests.slice(0, 5);
  const lastExecuted = requests.find((r) => r.status === 'Executed');

  const todayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const daysOfWeek = [
    { label: 'M', day: 1 },
    { label: 'T', day: 2 },
    { label: 'W', day: 3 },
    { label: 'T', day: 4 },
    { label: 'F', day: 5 },
    { label: 'S', day: 6 },
    { label: 'S', day: 0 },
  ];

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* 6 Top Metric KPI Cards - Apple Frosted Glass with Specular Borders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {/* Card 1: Balance with Assets Dropdown */}
        <div ref={dropdownRef} className="relative p-4.5 bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
              Wallet Balance
            </span>
            {/* Interactive Assets Dropdown Trigger */}
            <button
              onClick={() => setIsAssetsDropdownOpen(!isAssetsDropdownOpen)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[10px] font-medium text-white/80 transition-all cursor-pointer"
              title="Switch treasury asset"
            >
              <span>{currentAsset.asset_code}</span>
              <ChevronDown className={`w-3 h-3 text-white/60 transition-transform duration-200 ${isAssetsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="font-space text-lg sm:text-xl font-bold text-white tracking-tight mt-3 tabular-nums flex items-baseline gap-1.5">
            <span>{currentAsset.balance}</span>
            <span className="text-xs font-normal text-white/40">{currentAsset.asset_code}</span>
          </div>

          {/* Frosted Glass Assets Dropdown Popover */}
          {isAssetsDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 p-3 bg-[#0d1522]/95 backdrop-blur-2xl border border-white/[0.15] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.1)] z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] font-semibold text-white/80 tracking-wide uppercase">Treasury Assets</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 bg-white/[0.06] rounded-full text-white/50">{assets.length} assets</span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {assets.map((asset) => {
                  const isSelected = asset.asset_code === selectedAssetCode;
                  return (
                    <button
                      key={asset.asset_code}
                      onClick={() => {
                        setSelectedAssetCode(asset.asset_code);
                        setIsAssetsDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group/item cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/15 border-blue-500/30 text-white'
                          : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.1] text-white/90'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-space font-bold text-xs text-white">{asset.asset_code}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                            asset.is_native
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {asset.is_native ? 'Native' : 'Anchor'}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/50 truncate max-w-[140px]">{asset.asset_name}</span>
                        {asset.issuer && (
                          <div className="flex items-center gap-1 text-[9px] text-white/40 font-mono mt-0.5">
                            <span>{asset.issuer.slice(0, 6)}...{asset.issuer.slice(-4)}</span>
                            <button
                              onClick={(e) => copyToClipboard(asset.issuer!, e)}
                              className="hover:text-white transition-colors"
                              title="Copy issuer address"
                            >
                              {copiedIssuer === asset.issuer ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 text-white/40 hover:text-white/80" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-0.5 shrink-0 pl-2">
                        <span className="font-space text-xs font-semibold text-white tabular-nums">{asset.balance}</span>
                        <span className="text-[10px] text-white/40 tabular-nums">
                          ${(parseFloat(asset.balance.replace(/,/g, '')) * (asset.usd_rate || 1)).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ring-2 ring-blue-400/30 mt-0.5" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>


        {/* Card 2: Active Agents */}
        <div className="p-4.5 bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Active AI Agents
          </span>
          <div className="font-space text-xl sm:text-2xl font-bold text-white tracking-tight mt-3 flex items-center justify-between">
            <span>1</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="p-4.5 bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Pending Approvals
          </span>
          <div className="font-space text-xl sm:text-2xl font-bold text-amber-300 tracking-tight mt-3 flex items-center justify-between tabular-nums">
            <span>{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-2 ring-amber-400/30" />
            )}
          </div>
        </div>

        {/* Card 4: Approved / Executed */}
        <div className="p-4.5 bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Approved / Executed
          </span>
          <div className="font-space text-xl sm:text-2xl font-bold text-emerald-300 tracking-tight mt-3 tabular-nums">
            {executedCount}
          </div>
        </div>

        {/* Card 5: Blocked */}
        <div className="p-4.5 bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Blocked by Policy
          </span>
          <div className="font-space text-xl sm:text-2xl font-bold text-rose-300 tracking-tight mt-3 tabular-nums">
            {blockedCount}
          </div>
        </div>

        {/* Card 6: Spending Used */}
        <div className="p-4.5 bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Weekly Budget
          </span>
          <div className="font-space text-xl sm:text-2xl font-bold text-white tracking-tight mt-3 tabular-nums">
            {weeklyUsagePercent}%
          </div>
        </div>
      </div>

      {/* Main Grid: Left Recent Requests + Right Spending & Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Column (8 cols): Recent agent requests */}
        <div className="lg:col-span-8 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 sm:p-7 flex flex-col gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
            <div>
              <h2 className="font-space text-xl sm:text-2xl font-bold text-white tracking-tight">
                Recent Agent Requests
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Evaluated against autonomous spending rules and cryptographic thresholds.
              </p>
            </div>
            <button
              onClick={() => onSelectTab('requests')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer group"
            >
              <span>View all ({requests.length})</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* List of Requests */}
          {recentRequests.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <Shield className="w-8 h-8 text-white/20" />
              <p className="text-sm text-white/60 font-medium">No recent agent payment requests</p>
              <p className="text-xs text-white/40 max-w-sm">
                Autonomous agents bound to your controlled wallet will emit requests here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {recentRequests.map((req) => {
                const isPending = req.status === 'Pending';
                const isBlocked = req.status === 'Blocked';
                const isApproved = req.status === 'Approved' || req.status === 'Executed';
                const isRejected = req.status === 'Rejected';

                return (
                  <div
                    key={req.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group/item hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div
                      onClick={() => onSelectRequest(req)}
                      className="cursor-pointer flex-1 min-w-0"
                    >
                      <div className="font-space text-sm sm:text-base font-bold text-white group-hover/item:text-emerald-400 transition-colors truncate">
                        {req.amount.toLocaleString()} {req.asset} → {req.recipientName}
                      </div>
                      <div className="text-xs text-white/45 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-white/60">{req.id}</span>
                        <span>·</span>
                        <span>{req.time}</span>
                        <span>·</span>
                        <span className="text-white/60">{req.agentName}</span>
                      </div>
                    </div>

                    {/* Badges and action buttons */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {/* Apple HIG Status Capsule */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isPending
                            ? 'bg-amber-400/10 text-amber-300 border border-amber-400/25'
                            : isBlocked
                            ? 'bg-rose-400/10 text-rose-300 border border-rose-400/25'
                            : isApproved
                            ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/25'
                            : 'bg-rose-400/10 text-rose-300 border border-rose-400/25'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isPending
                              ? 'bg-amber-400'
                              : isBlocked || isRejected
                              ? 'bg-rose-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span>{req.status}</span>
                      </div>

                      {/* Inline Quick Action Buttons for Pending */}
                      {isPending ? (
                        <div className="flex items-center gap-1.5 ml-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onApproveQuick(req);
                            }}
                            className="px-3 py-1 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-[#080C14] text-xs font-bold rounded-lg transition-all shadow-[0_2px_8px_rgba(48,209,88,0.25)] cursor-pointer active:scale-95"
                          >
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRejectQuick(req);
                            }}
                            className="px-3 py-1 bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.14] border border-white/[0.1] text-xs font-semibold text-white rounded-lg transition-all cursor-pointer active:scale-95"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectRequest(req)}
                          className="px-3 py-1 text-xs text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-all cursor-pointer active:scale-95"
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Budget & Policy Cards */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Card: Spending this week */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-space text-lg font-bold text-white tracking-tight">
                  Spending this Week
                </h3>
                <span className="text-[11px] font-mono text-white/50">
                  Week {new Date().toLocaleDateString('en-US', { month: 'short' })}
                </span>
              </div>
              <div className="text-sm font-manrope text-white/60 mt-1">
                <span className="text-white font-space font-bold tabular-nums">
                  {policyConfig.weeklySpent.toLocaleString()}
                </span>{' '}
                of {policyConfig.weeklyLimit.toLocaleString()} USDC
              </div>
            </div>

            {/* Weekdays indicator bar */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[11px] font-space px-1">
                {daysOfWeek.map((d, idx) => {
                  const isCurrent = d.day === todayIndex;
                  return (
                    <span
                      key={idx}
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold transition-colors ${
                        isCurrent
                          ? 'bg-amber-400 text-[#080C14] shadow-[0_0_8px_rgba(255,159,10,0.4)]'
                          : 'text-white/40'
                      }`}
                    >
                      {d.label}
                    </span>
                  );
                })}
              </div>

              {/* Progress track */}
              <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,159,10,0.4)]"
                  style={{ width: `${weeklyUsagePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-white/50 mt-0.5">
                <span>Today: <span className="text-white font-medium">{policyConfig.dailySpent.toLocaleString()}</span> / {policyConfig.dailyLimit.toLocaleString()} USDC</span>
                <span className="text-amber-300 font-semibold">{weeklyUsagePercent}% used</span>
              </div>
            </div>
          </div>

          {/* Card: Policy status */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
              <h3 className="font-space text-lg font-bold text-white tracking-tight">
                Policy Enforcement
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/25 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            </div>

            <div className="flex flex-col divide-y divide-white/[0.06] text-xs sm:text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Policy Version</span>
                <span className="font-space text-white font-semibold">v3.0 (Sep-53)</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Per-Tx Ceiling</span>
                <span className="font-space text-white font-semibold tabular-nums">
                  {policyConfig.maxPerTransaction.toLocaleString()} USDC
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Approval Threshold</span>
                <span className="font-space text-white font-semibold tabular-nums">
                  Above {policyConfig.approvalThreshold.toLocaleString()} USDC
                </span>
              </div>
            </div>

            <button
              onClick={() => onSelectTab('policies')}
              className="mt-0.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 self-start cursor-pointer flex items-center gap-1 group transition-colors"
            >
              <span>Edit policy controls</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Card: Wallet security */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
              <h3 className="font-space text-lg font-bold text-white tracking-tight">
                Wallet Security
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/25 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Multisig 2/3
              </span>
            </div>

            <div className="flex flex-col divide-y divide-white/[0.06] text-xs sm:text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Active Threshold</span>
                <span className="font-space text-white font-semibold">2 of 3 Signatures</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">GuardRail Co-Signer</span>
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Online
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-white/50">Master Secret Key</span>
                <span className="font-space text-white/80 font-semibold">Removed (Weight 0)</span>
              </div>
            </div>

            <button
              onClick={() => onSelectTab('wallet-security')}
              className="mt-0.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 self-start cursor-pointer flex items-center gap-1 group transition-colors"
            >
              <span>Manage Multisig Setup</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Card: Recently executed */}
          {lastExecuted && (
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <h3 className="font-space text-base font-bold text-white tracking-tight">
                Recently Executed
              </h3>
              <div className="flex items-center justify-between text-xs sm:text-sm py-1">
                <span className="text-white/60 truncate">{lastExecuted.recipientName}</span>
                <span className="font-space text-emerald-300 font-bold shrink-0 tabular-nums">
                  {lastExecuted.amount.toLocaleString()} {lastExecuted.asset}
                </span>
              </div>
              <button
                onClick={() => onSelectTab('audit-log')}
                className="mt-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer self-start group transition-colors"
              >
                <span>Open immutable audit log</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

