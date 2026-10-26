import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';

interface RequestsViewProps {
  requests: AgentRequest[];
  onSelectRequest: (req: AgentRequest) => void;
  onOpenSimulateModal?: () => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  onSelectRequest,
  onOpenSimulateModal,
}) => {
  const [activeFilter, setActiveFilter] = useState<RequestFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filterTabs: Array<{ id: RequestFilter; label: string; count?: number }> = [
    { id: 'all', label: 'All', count: requests.length },
    { id: 'pending', label: 'Pending', count: requests.filter((r) => r.status === 'Pending').length },
    { id: 'eligible', label: 'Eligible', count: requests.filter((r) => r.status === 'Eligible').length },
    { id: 'blocked', label: 'Blocked', count: requests.filter((r) => r.status === 'Blocked').length },
    { id: 'approved', label: 'Approved', count: requests.filter((r) => r.status === 'Approved').length },
    { id: 'rejected', label: 'Rejected', count: requests.filter((r) => r.status === 'Rejected').length },
    { id: 'executed', label: 'Executed', count: requests.filter((r) => r.status === 'Executed').length },
  ];

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
      const matchRecipient = req.recipientName.toLowerCase().includes(q) || req.recipientAddress.toLowerCase().includes(q);
      const matchAgent = req.agentName.toLowerCase().includes(q);
      const matchAmount = req.amount.toString().includes(q);
      return matchId || matchRecipient || matchAgent || matchAmount;
    }

    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Search and Filters Bar - Apple Segmented Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Apple Segmented Controls Container */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none p-1 bg-white/[0.04] border border-white/[0.08] rounded-full backdrop-blur-xl">
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
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, agent, recipient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-white/[0.25] backdrop-blur-xl transition-all"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        {filteredRequests.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-space text-lg font-bold text-white">
                No requests found
              </h3>
              <p className="text-xs text-white/50 mt-1 max-w-sm">
                There are no {activeFilter !== 'all' ? activeFilter : ''} requests matching your current filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] font-space font-semibold text-white/50 tracking-wider uppercase bg-white/[0.02]">
                  <th className="py-3 px-4 sm:px-6">REQUEST</th>
                  <th className="py-3 px-4">AGENT</th>
                  <th className="py-3 px-4">RECIPIENT</th>
                  <th className="py-3 px-4 text-right">AMOUNT</th>
                  <th className="py-3 px-4">TIME</th>
                  <th className="py-3 px-4">POLICY</th>
                  <th className="py-3 px-4">APPROVAL</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 sm:px-6 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs sm:text-sm">
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'Pending';
                  const isBlocked = req.status === 'Blocked';
                  const isApproved = req.status === 'Approved' || req.status === 'Executed';
                  const isRejected = req.status === 'Rejected';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => onSelectRequest(req)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      {/* REQUEST ID */}
                      <td className="py-4 px-4 sm:px-6 font-space font-medium text-white group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                        {req.id}
                      </td>

                      {/* AGENT */}
                      <td className="py-4 px-4 font-space text-white/90 whitespace-nowrap">
                        {req.agentName}
                      </td>

                      {/* RECIPIENT */}
                      <td className="py-4 px-4">
                        <div className="text-white font-medium truncate max-w-[190px]">
                          {req.recipientName}
                        </div>
                        <div className="text-[11px] font-mono text-white/45 truncate max-w-[190px]">
                          {req.recipientAddress.slice(0, 6)}…{req.recipientAddress.slice(-4)}
                        </div>
                      </td>

                      {/* AMOUNT */}
                      <td className="py-4 px-4 font-space font-bold text-white text-right whitespace-nowrap tabular-nums">
                        {req.amount.toLocaleString()} {req.asset}
                      </td>

                      {/* TIME */}
                      <td className="py-4 px-4 text-white/50 whitespace-nowrap text-xs">
                        {req.time}
                      </td>

                      {/* POLICY */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            req.policyResult === 'Passed'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {req.policyResult}
                        </span>
                      </td>

                      {/* APPROVAL & MULTISIG WEIGHT */}
                      <td className="py-4 px-4 text-white/50 whitespace-nowrap text-xs">
                        {req.approvalRequired ? (
                          <div className="flex items-center gap-1.5">
                            <span className={isPending ? 'text-amber-300 font-semibold' : ''}>
                              Required
                            </span>
                            {req.collectedWeight !== undefined && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono">
                                {req.collectedWeight}/{req.requiredWeight || 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span>Auto-Approved</span>
                        )}
                      </td>


                      {/* STATUS BADGE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isPending
                              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/25'
                              : isBlocked || isRejected
                              ? 'bg-rose-400/10 text-rose-300 border border-rose-400/25'
                              : 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/25'
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
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRequest(req);
                          }}
                          className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white rounded-xl transition-all cursor-pointer"
                        >
                          View Details
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

