import React, { useState } from 'react';
import { AgentRequest } from '../types';
import {
  Search,
  ExternalLink,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  FileSpreadsheet
} from 'lucide-react';

interface AuditLogViewProps {
  requests: AgentRequest[];
  onSelectRequest: (req: AgentRequest) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ requests, onSelectRequest }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Executed' | 'Blocked' | 'Rejected' | 'Pending'>('all');

  const filtered = requests.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.recipientName.toLowerCase().includes(q) ||
        r.recipientAddress.toLowerCase().includes(q) ||
        (r.stellarTxHash && r.stellarTxHash.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(requests, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `guardrail_audit_log_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Search & Export Actions - Apple Segmented Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Apple Search Input */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by ID, recipient, or tx hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-white/20 backdrop-blur-xl transition-all"
            />
          </div>

          {/* Apple Segmented Status Filter */}
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/[0.08] text-xs backdrop-blur-xl">
            {(['all', 'Executed', 'Blocked', 'Pending', 'Rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#080C14] shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {st === 'all' ? 'All Records' : st}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white rounded-full transition-all cursor-pointer self-end sm:self-auto shrink-0 shadow-xs active:scale-95"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export JSON</span>
        </button>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] font-space font-semibold text-white/50 tracking-wider uppercase bg-white/[0.02]">
                <th className="py-3 px-4 sm:px-6">REQUEST</th>
                <th className="py-3 px-4">AGENT</th>
                <th className="py-3 px-4">RECIPIENT</th>
                <th className="py-3 px-4 text-right">AMOUNT</th>
                <th className="py-3 px-4">POLICY DECISION</th>
                <th className="py-3 px-4">APPROVAL</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">TIMESTAMP</th>
                <th className="py-3 px-4">STELLAR TX</th>
                <th className="py-3 px-4 sm:px-6 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-xs sm:text-sm">
              {filtered.map((req) => {
                const isExecuted = req.status === 'Executed' || req.status === 'Approved';
                const isBlocked = req.status === 'Blocked';
                const isPending = req.status === 'Pending';
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
                      <span className="font-space font-semibold text-white text-xs">
                        {req.recipientAddress.slice(0, 5)}…{req.recipientAddress.slice(-4)}
                      </span>
                    </td>

                    {/* AMOUNT */}
                    <td className="py-4 px-4 font-space font-bold text-white text-right whitespace-nowrap tabular-nums">
                      {req.amount.toLocaleString()} {req.asset}
                    </td>

                    {/* POLICY DECISION */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          req.policyDecisionText === 'Allowed'
                            ? 'text-white'
                            : 'text-rose-400'
                        }`}
                      >
                        {req.policyDecisionText}
                      </span>
                    </td>

                    {/* APPROVAL */}
                    <td className="py-4 px-4 text-white/50 whitespace-nowrap text-xs">
                      {req.approvalStatus}
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

                    {/* TIMESTAMP */}
                    <td className="py-4 px-4 text-white/50 whitespace-nowrap text-xs">
                      {req.time}
                    </td>

                    {/* STELLAR TX */}
                    <td className="py-4 px-4 font-mono text-xs whitespace-nowrap">
                      {req.stellarTxHash ? (
                        <span className="text-white/80 font-mono" title={req.stellarTxHash}>
                          {req.stellarTxHash.slice(0, 8)}…{req.stellarTxHash.slice(-4)}
                        </span>
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </td>

                    {/* ACTION */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                      {req.stellarTxHash ? (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${req.stellarTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                        >
                          <span>Explorer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRequest(req);
                          }}
                          className="px-2.5 py-1 text-xs text-white/50 hover:text-white bg-white/[0.04] border border-white/[0.08] rounded-lg transition-colors"
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

