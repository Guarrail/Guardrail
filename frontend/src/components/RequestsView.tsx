import React, { useState } from 'react';
import { AgentRequest, RequestFilter } from '../types';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Sliders
} from 'lucide-react';

interface RequestsViewProps {
  requests: AgentRequest[];
  onSelectRequest: (req: AgentRequest) => void;
  onOpenSimulateModal: () => void;
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
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Horizontal Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#09101A] font-bold shadow-xs'
                    : 'bg-[#09101A] text-[#9099A5] hover:text-white border border-[#2B3340]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[11px] font-space px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-[#09101A] text-white' : 'bg-[#202938] text-[#9099A5]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-[#9099A5] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search request or recipient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#202938] border border-[#2B3340] rounded-lg text-xs text-white placeholder-[#9099A5] focus:outline-hidden focus:border-[#4AC777]"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#202938] border border-[#2B3340] rounded-xl overflow-hidden shadow-xs">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1D2430] border border-[#2B3340] flex items-center justify-center text-[#9099A5]">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-space text-lg font-bold text-white">
                No requests found
              </h3>
              <p className="text-xs text-[#9099A5] mt-1 max-w-sm">
                There are no {activeFilter !== 'all' ? activeFilter : ''} requests matching your filters.
              </p>
            </div>
            <button
              onClick={onOpenSimulateModal}
              className="mt-2 px-4 py-2 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate an Agent Request</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2B3340] text-[11px] font-space font-semibold text-[#9099A5] tracking-wider uppercase bg-[#1A222F]/60">
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
              <tbody className="divide-y divide-[#2B3340] text-xs sm:text-sm">
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'Pending';
                  const isBlocked = req.status === 'Blocked';
                  const isApproved = req.status === 'Approved' || req.status === 'Executed';
                  const isRejected = req.status === 'Rejected';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => onSelectRequest(req)}
                      className="hover:bg-[#273243]/60 transition-colors cursor-pointer group"
                    >
                      {/* REQUEST ID */}
                      <td className="py-4 px-4 sm:px-6 font-space font-medium text-white group-hover:text-[#4AC777] transition-colors whitespace-nowrap">
                        {req.id}
                      </td>

                      {/* AGENT */}
                      <td className="py-4 px-4 font-space text-white whitespace-nowrap">
                        {req.agentName}
                      </td>

                      {/* RECIPIENT */}
                      <td className="py-4 px-4">
                        <div className="text-white font-medium truncate max-w-[190px]">
                          {req.recipientName}
                        </div>
                        <div className="text-[11px] font-mono text-[#9099A5] truncate max-w-[190px]">
                          {req.recipientAddress.slice(0, 6)}…{req.recipientAddress.slice(-4)}
                        </div>
                      </td>

                      {/* AMOUNT */}
                      <td className="py-4 px-4 font-space font-bold text-white text-right whitespace-nowrap tabular-nums">
                        {req.amount.toLocaleString()} {req.asset}
                      </td>

                      {/* TIME */}
                      <td className="py-4 px-4 text-[#9099A5] whitespace-nowrap text-xs">
                        {req.time}
                      </td>

                      {/* POLICY */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            req.policyResult === 'Passed'
                              ? 'text-[#4AC777]'
                              : 'text-[#ED4A49]'
                          }`}
                        >
                          {req.policyResult}
                        </span>
                      </td>

                      {/* APPROVAL */}
                      <td className="py-4 px-4 text-[#9099A5] whitespace-nowrap text-xs">
                        {req.approvalRequired ? (
                          <span className={isPending ? 'text-[#F2B036] font-medium' : ''}>
                            Required
                          </span>
                        ) : (
                          <span>Not Required</span>
                        )}
                      </td>

                      {/* STATUS BADGE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isPending
                              ? 'bg-[#F2B036]/15 text-[#F2B036]'
                              : isBlocked || isRejected
                              ? 'bg-[#ED4A49]/15 text-[#ED4A49]'
                              : 'bg-[#4AC777]/15 text-[#4AC777]'
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
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRequest(req);
                          }}
                          className="px-3 py-1.5 bg-[#09101A] hover:bg-[#232E3F] border border-[#2B3340] text-xs font-semibold text-white rounded-md transition-colors cursor-pointer"
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
