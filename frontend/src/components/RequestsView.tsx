import React, { useState, useEffect } from 'react';
import { AgentRequest, RequestFilter } from '../types';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ExternalLink,
  Sliders,
  Sparkles,
  Key,
  ShieldCheck,
  ArrowUpRight,
  Copy,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';

interface RequestsViewProps {
  requests: AgentRequest[];
  onSelectRequest: (req: AgentRequest) => void;
  onOpenSimulateModal?: () => void;
  onRefreshRequests?: () => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  onSelectRequest,
  onOpenSimulateModal,
  onRefreshRequests,
}) => {
  const [activeFilter, setActiveFilter] = useState<RequestFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Automatic real-time polling every 3 seconds
  useEffect(() => {
    if (onRefreshRequests) {
      onRefreshRequests();
    }
    const interval = setInterval(() => {
      if (onRefreshRequests) {
        onRefreshRequests();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [onRefreshRequests]);

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const executedCount = requests.filter((r) => r.status === 'Executed').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const blockedCount = requests.filter((r) => r.status === 'Blocked' || r.status === 'Rejected').length;
  const totalVolume = requests.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  const filterTabs: Array<{ id: RequestFilter; label: string; count?: number }> = [
    { id: 'all', label: 'All Requests', count: requests.length },
    { id: 'pending', label: 'Pending Review', count: pendingCount },
    { id: 'approved', label: 'Approved', count: approvedCount },
    { id: 'executed', label: 'Executed', count: executedCount },
    { id: 'blocked', label: 'Blocked', count: requests.filter((r) => r.status === 'Blocked').length },
    { id: 'rejected', label: 'Rejected', count: requests.filter((r) => r.status === 'Rejected').length },
  ];

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredRequests = requests.filter((req) => {
    // Filter matching
    if (activeFilter === 'pending' && req.status !== 'Pending') return false;
    if (activeFilter === 'eligible' && req.status !== 'Eligible') return false;
    if (activeFilter === 'blocked' && req.status !== 'Blocked') return false;
    if (activeFilter === 'approved' && req.status !== 'Approved') return false;
    if (activeFilter === 'rejected' && req.status !== 'Rejected') return false;
    if (activeFilter === 'executed' && req.status !== 'Executed') return false;

    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = req.id.toLowerCase().includes(q);
      const matchRecipient = (req.recipientName || '').toLowerCase().includes(q) || (req.recipientAddress || '').toLowerCase().includes(q);
      const matchAgent = (req.agentName || '').toLowerCase().includes(q) || (req.agentId || '').toLowerCase().includes(q);
      const matchAmount = req.amount.toString().includes(q);
      return matchId || matchRecipient || matchAgent || matchAmount;
    }

    return true;
  });

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-space text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Transaction Requests
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-white/70">
              {requests.length} Total
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Auto-Sync (3s)</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-white/50 mt-1 max-w-2xl leading-relaxed">
            Monitor autonomous agent payments, evaluate rule compliance, and authorize multisig transactions for live Stellar execution.
          </p>
        </div>

        {onOpenSimulateModal && (
          <button
            onClick={onOpenSimulateModal}
            className="self-start sm:self-auto px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#070B12] font-bold text-xs rounded-xl shadow-[0_4px_20px_rgba(74,199,119,0.25)] transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Payment</span>
          </button>
        )}
      </div>

      {/* 2. Apple-Grade KPI Glance Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Pending Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl relative overflow-hidden group hover:border-amber-400/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">Needs Review</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-space text-2xl sm:text-3xl font-bold text-white tabular-nums">
              {pendingCount}
            </span>
            <span className="text-[11px] text-amber-300 font-medium">
              {pendingCount === 1 ? '1 awaiting sign' : `${pendingCount} awaiting sign`}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-white/40">Requires operator approval</div>
        </div>

        {/* Executed Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl relative overflow-hidden group hover:border-emerald-400/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">Executed on Stellar</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-space text-2xl sm:text-3xl font-bold text-white tabular-nums">
              {executedCount}
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">On-chain confirmed</span>
          </div>
          <div className="mt-1 text-[11px] text-white/40">Verified on Stellar Testnet</div>
        </div>

        {/* Blocked / Protected Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl relative overflow-hidden group hover:border-rose-400/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">Blocked by Policy</span>
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-space text-2xl sm:text-3xl font-bold text-white tabular-nums">
              {blockedCount}
            </span>
            <span className="text-[11px] text-rose-300 font-medium">Safeguarded</span>
          </div>
          <div className="mt-1 text-[11px] text-white/40">Budget or recipient violations prevented</div>
        </div>

        {/* Total Volume Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl relative overflow-hidden group hover:border-cyan-400/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">Cumulative Volume</span>
            <span className="text-[10px] font-space px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
              XLM
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-space text-2xl sm:text-3xl font-bold text-white tabular-nums">
              {totalVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
            <span className="text-[11px] text-cyan-300 font-medium">XLM Total</span>
          </div>
          <div className="mt-1 text-[11px] text-white/40">Across all autonomous agents</div>
        </div>
      </div>

      {/* 3. Search and Segmented Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        {/* Apple Segmented Controls Container */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none p-1 bg-white/[0.03] border border-white/[0.08] rounded-full backdrop-blur-xl">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#080C14] shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] font-space px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                      isActive ? 'bg-[#080C14] text-white' : 'bg-white/[0.08] text-white/70'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Apple Search Input */}
        <div className="relative min-w-[260px] md:max-w-xs">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ID, agent, recipient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-8 py-2 bg-white/[0.03] border border-white/[0.08] rounded-full text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-white/[0.25] backdrop-blur-xl transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Streamlined Requests Table */}
      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        {filteredRequests.length === 0 ? (
          <div className="py-20 px-4 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40">
              <Filter className="w-6 h-6" />
            </div>
            <div className="max-w-sm">
              <h3 className="font-space text-base font-bold text-white">
                No matching requests
              </h3>
              <p className="text-xs text-white/50 mt-1">
                {searchQuery
                  ? `No transactions match your search "${searchQuery}".`
                  : `There are currently no ${activeFilter !== 'all' ? activeFilter : ''} requests recorded.`}
              </p>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white transition-all cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] font-space font-semibold text-white/50 tracking-wider uppercase bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6">TRANSACTION & AGENT</th>
                  <th className="py-3.5 px-4">RECIPIENT</th>
                  <th className="py-3.5 px-4 text-right">AMOUNT</th>
                  <th className="py-3.5 px-4">POLICY & MULTISIG</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs sm:text-sm">
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'Pending';
                  const isBlocked = req.status === 'Blocked';
                  const isApproved = req.status === 'Approved';
                  const isExecuted = req.status === 'Executed';
                  const isRejected = req.status === 'Rejected';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => onSelectRequest(req)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* 1. TRANSACTION & AGENT */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-space font-bold text-white group-hover:text-emerald-400 transition-colors">
                              {req.agentName}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-white/60">
                              {req.id.length > 14 ? `${req.id.slice(0, 10)}...` : req.id}
                            </span>
                          </div>
                          <span className="text-[11px] text-white/40 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{req.time}</span>
                          </span>
                        </div>
                      </td>

                      {/* 2. RECIPIENT */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white font-medium truncate max-w-[170px]">
                            {req.recipientName || 'Recipient'}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-mono text-white/45">
                              {req.recipientAddress
                                ? `${req.recipientAddress.slice(0, 6)}...${req.recipientAddress.slice(-4)}`
                                : '—'}
                            </span>
                            {req.recipientAddress && (
                              <button
                                onClick={(e) => handleCopy(req.recipientAddress, req.id, e)}
                                className="text-white/30 hover:text-white transition-colors p-0.5"
                                title="Copy Stellar address"
                              >
                                {copiedId === req.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. AMOUNT */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="font-space font-bold text-white text-base tabular-nums">
                            {Number(req.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/[0.06] text-white/70">
                            {req.asset || 'XLM'}
                          </span>
                        </div>
                      </td>

                      {/* 4. POLICY & MULTISIG */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                req.policyResult === 'Passed'
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                              }`}
                            >
                              {req.policyResult === 'Passed' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <XCircle className="w-3 h-3 text-rose-400" />
                              )}
                              <span>{req.policyResult === 'Passed' ? 'Policy Passed' : 'Rule Failed'}</span>
                            </span>
                          </div>

                          <div className="text-[11px] text-white/50 flex items-center gap-1.5">
                            {req.approvalRequired ? (
                              <span className="flex items-center gap-1">
                                <Key className="w-3 h-3 text-purple-400" />
                                <span className="font-mono text-white/70">
                                  {req.collectedWeight ?? 0}/{req.requiredWeight ?? 2} Sigs
                                </span>
                              </span>
                            ) : (
                              <span className="text-white/40">Auto-Approved</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. STATUS BADGE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            isPending
                              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/25 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                              : isExecuted
                              ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                              : isApproved
                              ? 'bg-teal-400/10 text-teal-300 border border-teal-400/25'
                              : 'bg-rose-400/10 text-rose-300 border border-rose-400/25'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPending
                                ? 'bg-amber-400 animate-pulse'
                                : isExecuted
                                ? 'bg-emerald-400'
                                : isApproved
                                ? 'bg-teal-400'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span>
                            {isPending
                              ? 'Pending Approval'
                              : isExecuted
                              ? 'Executed on Stellar'
                              : isApproved
                              ? 'Approved'
                              : isBlocked
                              ? 'Blocked by Policy'
                              : req.status}
                          </span>
                        </span>
                      </td>

                      {/* 6. ACTION BUTTON */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRequest(req);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ml-auto ${
                            isPending
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-[#070B12] font-bold shadow-[0_2px_12px_rgba(74,199,119,0.3)]'
                              : 'bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08]'
                          }`}
                        >
                          <span>{isPending ? 'Review & Sign' : 'View Details'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
