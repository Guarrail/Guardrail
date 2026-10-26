import React from 'react';
import { AgentRequest, PolicyConfig, ControlledWalletState, TabView } from '../types';
import {
  ArrowRight,
  Shield,
  Bot,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sliders
} from 'lucide-react';

interface DashboardViewProps {
  requests: AgentRequest[];
  policyConfig: PolicyConfig;
  controlledWallet: ControlledWalletState;
  onSelectTab: (tab: TabView) => void;
  onSelectRequest: (req: AgentRequest) => void;
  onApproveQuick: (req: AgentRequest) => void;
  onRejectQuick: (req: AgentRequest) => void;
  onOpenSimulateModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  requests,
  policyConfig,
  controlledWallet,
  onSelectTab,
  onSelectRequest,
  onApproveQuick,
  onRejectQuick,
  onOpenSimulateModal,
}) => {
  // Dynamic stats calculated from real state
  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const executedCount = requests.filter((r) => r.status === 'Executed' || r.status === 'Approved').length;
  const blockedCount = requests.filter((r) => r.status === 'Blocked').length;
  const weeklyUsagePercent = Math.round((policyConfig.weeklySpent / policyConfig.weeklyLimit) * 100);

  // Take the 4 most recent requests
  const recentRequests = requests.slice(0, 4);
  const lastExecuted = requests.find((r) => r.status === 'Executed');

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full">
      {/* 6 Top Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Balance */}
        <div className="p-4 bg-[#202938] border border-[#2B3340] rounded-lg flex flex-col justify-between">
          <span className="text-xs font-light text-white font-manrope">Wallet balance</span>
          <div className="font-space text-lg sm:text-xl font-bold text-white tracking-tight mt-3">
            {controlledWallet.balanceUsdc.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-normal text-[#9099A5]">USDC</span>
          </div>
        </div>

        {/* Card 2: Active Agents */}
        <div className="p-4 bg-[#202938] border border-[#2B3340] rounded-lg flex flex-col justify-between">
          <span className="text-xs font-light text-white font-manrope">Active AI agents</span>
          <div className="font-space text-lg sm:text-2xl font-bold text-white tracking-tight mt-3">
            1
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="p-4 bg-[#202938] border border-[#2B3340] rounded-lg flex flex-col justify-between">
          <span className="text-xs font-light text-white font-manrope">Pending approvals</span>
          <div className="font-space text-lg sm:text-2xl font-bold text-[#F2B036] tracking-tight mt-3 flex items-center justify-between">
            <span>{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#F2B036] animate-pulse" />
            )}
          </div>
        </div>

        {/* Card 4: Approved / executed */}
        <div className="p-4 bg-[#202938] border border-[#2B3340] rounded-lg flex flex-col justify-between">
          <span className="text-xs font-light text-white font-manrope">Approved / executed</span>
          <div className="font-space text-lg sm:text-2xl font-bold text-[#4AC777] tracking-tight mt-3">
            {executedCount}
          </div>
        </div>

        {/* Card 5: Blocked */}
        <div className="p-4 bg-[#202938] border border-[#2B3340] rounded-lg flex flex-col justify-between">
          <span className="text-xs font-light text-white font-manrope">Blocked</span>
          <div className="font-space text-lg sm:text-2xl font-bold text-[#ED4A49] tracking-tight mt-3">
            {blockedCount}
          </div>
        </div>

        {/* Card 6: Spending used */}
        <div className="p-4 bg-[#202938] border border-[#2B3340] rounded-lg flex flex-col justify-between">
          <span className="text-xs font-light text-white font-manrope">Spending used (week)</span>
          <div className="font-space text-lg sm:text-2xl font-bold text-white tracking-tight mt-3">
            {weeklyUsagePercent}%
          </div>
        </div>
      </div>

      {/* Main Grid: Left Recent Requests + Right Spending & Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Recent agent requests */}
        <div className="lg:col-span-8 bg-[#202938] border border-[#2B3340] rounded-xl p-5 sm:p-7 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-space text-xl sm:text-2xl font-bold text-white tracking-tight">
              Recent agent requests
            </h2>
            <button
              onClick={() => onSelectTab('requests')}
              className="text-xs font-semibold text-[#4AC777] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all ({requests.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of Requests */}
          <div className="flex flex-col divide-y divide-[#2B3340]">
            {recentRequests.map((req) => {
              const isPending = req.status === 'Pending';
              const isBlocked = req.status === 'Blocked';
              const isApproved = req.status === 'Approved' || req.status === 'Executed';
              const isRejected = req.status === 'Rejected';

              return (
                <div
                  key={req.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div
                    onClick={() => onSelectRequest(req)}
                    className="cursor-pointer flex-1 min-w-0"
                  >
                    <div className="font-space text-sm sm:text-base font-bold text-white group-hover:text-[#4AC777] transition-colors truncate">
                      {req.amount.toLocaleString()} {req.asset} → {req.recipientName}
                    </div>
                    <div className="text-xs text-[#9099A5] mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{req.id}</span>
                      <span>·</span>
                      <span>{req.time}</span>
                    </div>
                  </div>

                  {/* Badges and action buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {/* Status Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isPending
                          ? 'bg-[#F2B036]/15 text-[#F2B036]'
                          : isBlocked
                          ? 'bg-[#ED4A49]/15 text-[#ED4A49]'
                          : isApproved
                          ? 'bg-[#4AC777]/15 text-[#4AC777]'
                          : 'bg-[#ED4A49]/15 text-[#ED4A49]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPending
                            ? 'bg-[#F2B036]'
                            : isBlocked || isRejected
                            ? 'bg-[#ED4A49]'
                            : 'bg-[#4AC777]'
                        }`}
                      />
                      <span>{req.status}</span>
                    </div>

                    {/* Inline Quick Action Buttons for Pending */}
                    {isPending ? (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onApproveQuick(req);
                          }}
                          className="px-2.5 py-1 bg-[#4AC777] hover:bg-[#3fb86b] text-[#0F1724] text-xs font-bold rounded transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRejectQuick(req);
                          }}
                          className="px-2 py-1 bg-[#09101A] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-white rounded transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectRequest(req)}
                        className="px-2.5 py-1 text-xs text-[#9099A5] hover:text-white bg-[#09101A] border border-[#2B3340] rounded transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (4 cols): Budget & Policy Cards */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Card: Spending this week */}
          <div className="bg-[#202938] border border-[#2B3340] rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-5">
            <div>
              <h3 className="font-space text-lg font-bold text-white tracking-tight">
                Spending this week
              </h3>
              <div className="text-sm font-manrope text-[#9099A5] mt-1">
                <span className="text-white font-space font-bold">
                  {policyConfig.weeklySpent.toLocaleString()}
                </span>{' '}
                of {policyConfig.weeklyLimit.toLocaleString()} USDC
              </div>
            </div>

            {/* Weekdays bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] text-[#9099A5] px-1 font-space">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
              {/* Progress track */}
              <div className="w-full h-2.5 bg-[#131C2A] rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-[#F2B036] rounded-full transition-all duration-500"
                  style={{ width: `${weeklyUsagePercent}%` }}
                />
              </div>
              <div className="text-xs text-[#9099A5] mt-1">
                Today: <span className="text-white font-medium">{policyConfig.dailySpent.toLocaleString()}</span> / {policyConfig.dailyLimit.toLocaleString()} USDC
              </div>
            </div>
          </div>

          {/* Card: Policy status */}
          <div className="bg-[#202938] border border-[#2B3340] rounded-xl p-5 sm:p-6 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-space text-lg font-bold text-white tracking-tight">
                Policy status
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#4AC777]/15 text-[#4AC777] font-bold">
                Active
              </span>
            </div>

            <div className="flex flex-col divide-y divide-[#2B3340] text-xs sm:text-sm">
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#9099A5]">Version</span>
                <span className="font-space text-white font-semibold">v3</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#9099A5]">Per transaction</span>
                <span className="font-space text-white font-semibold">
                  {policyConfig.maxPerTransaction.toLocaleString()} USDC
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#9099A5]">Approval above</span>
                <span className="font-space text-white font-semibold">
                  {policyConfig.approvalThreshold.toLocaleString()} USDC
                </span>
              </div>
            </div>

            <button
              onClick={() => onSelectTab('policies')}
              className="mt-1 text-xs font-semibold text-[#4AC777] hover:underline self-start cursor-pointer flex items-center gap-1"
            >
              <span>Edit policy</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Card: Wallet security */}
          <div className="bg-[#202938] border border-[#2B3340] rounded-xl p-5 sm:p-6 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-space text-lg font-bold text-white tracking-tight">
                Wallet security
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#4AC777]/15 text-[#4AC777] font-bold">
                Protected
              </span>
            </div>

            <div className="flex flex-col divide-y divide-[#2B3340] text-xs sm:text-sm">
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#9099A5]">Threshold</span>
                <span className="font-space text-white font-semibold">2 of 3</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#9099A5]">Co-signer</span>
                <span className="text-[#4AC777] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4AC777]" />
                  Active
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#9099A5]">Master key</span>
                <span className="font-space text-white font-semibold">Removed</span>
              </div>
            </div>
          </div>

          {/* Card: Recently executed */}
          {lastExecuted && (
            <div className="bg-[#202938] border border-[#2B3340] rounded-xl p-5 sm:p-6 flex flex-col gap-2">
              <h3 className="font-space text-base font-bold text-white tracking-tight">
                Recently executed
              </h3>
              <div className="flex items-center justify-between text-xs sm:text-sm py-1">
                <span className="text-[#9099A5] truncate">{lastExecuted.recipientName}</span>
                <span className="font-space text-white font-bold shrink-0">
                  {lastExecuted.amount.toLocaleString()} {lastExecuted.asset}
                </span>
              </div>
              <button
                onClick={() => onSelectTab('audit-log')}
                className="mt-1 text-xs font-semibold text-[#4AC777] hover:underline flex items-center gap-1 cursor-pointer self-start"
              >
                <span>Open audit log</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
