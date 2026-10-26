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
      {/* Search & Export Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[#9099A5] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search request ID, address or tx hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#202938] border border-[#2B3340] rounded-lg text-xs text-white placeholder-[#9099A5] focus:outline-hidden focus:border-[#4AC777]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#202938] p-1 rounded-lg border border-[#2B3340] text-xs">
            {(['all', 'Executed', 'Blocked', 'Pending', 'Rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#09101A] font-bold'
                    : 'text-[#9099A5] hover:text-white'
                }`}
              >
                {st === 'all' ? 'All Records' : st}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-white rounded-md transition-colors cursor-pointer self-end sm:self-auto shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#4AC777]" />
          <span>Export JSON</span>
        </button>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-[#202938] border border-[#2B3340] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2B3340] text-[11px] font-space font-semibold text-[#9099A5] tracking-wider uppercase bg-[#1A222F]/60">
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
            <tbody className="divide-y divide-[#2B3340] text-xs sm:text-sm">
              {filtered.map((req) => {
                const isExecuted = req.status === 'Executed' || req.status === 'Approved';
                const isBlocked = req.status === 'Blocked';
                const isPending = req.status === 'Pending';
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
                      <span className="font-space font-bold text-white text-xs">
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
                        className={`font-medium ${
                          req.policyDecisionText === 'Allowed'
                            ? 'text-white'
                            : 'text-[#ED4A49]'
                        }`}
                      >
                        {req.policyDecisionText}
                      </span>
                    </td>

                    {/* APPROVAL */}
                    <td className="py-4 px-4 text-[#9099A5] whitespace-nowrap text-xs">
                      {req.approvalStatus}
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

                    {/* TIMESTAMP */}
                    <td className="py-4 px-4 text-[#9099A5] whitespace-nowrap text-xs">
                      {req.time}
                    </td>

                    {/* STELLAR TX */}
                    <td className="py-4 px-4 font-mono text-xs whitespace-nowrap">
                      {req.stellarTxHash ? (
                        <span className="text-white" title={req.stellarTxHash}>
                          {req.stellarTxHash.slice(0, 10)}...{req.stellarTxHash.slice(-4)}
                        </span>
                      ) : (
                        <span className="text-[#9099A5]">-</span>
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
                          className="inline-flex items-center gap-1 text-xs text-[#4AC777] hover:underline font-semibold"
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
                          className="text-xs text-[#9099A5] hover:text-white"
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
