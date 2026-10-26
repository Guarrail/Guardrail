import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PolicyConfig } from '../types';
import { api, ApiPolicy } from '../services/api';
import {
  Shield,
  Plus,
  Sliders,
  Search,
  ChevronRight,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Coins,
} from 'lucide-react';

interface PolicyConfigViewProps {
  policyConfig: PolicyConfig;
  setPolicyConfig: React.Dispatch<React.SetStateAction<PolicyConfig>>;
}

export const PolicyConfigView: React.FC<PolicyConfigViewProps> = ({
  policyConfig,
  setPolicyConfig,
}) => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<ApiPolicy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'AUTONOMOUS' | 'MANDATORY_REVIEW'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await api.getPolicies();
      const list = Array.isArray(data) ? data : (data as { results?: ApiPolicy[] })?.results || [];
      setPolicies(list);
    } catch (e) {
      console.warn('Error fetching policies:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const filteredPolicies = policies.filter((p) => {
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesQuery) return false;

    if (filter === 'ACTIVE') return p.is_active;
    if (filter === 'AUTONOMOUS') return !p.require_human_approval_always;
    if (filter === 'MANDATORY_REVIEW') return p.require_human_approval_always;
    return true;
  });

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in duration-200 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner - Matching AIAgentView Styling with Create Policy Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center shadow-inner shrink-0">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-space text-2xl font-bold text-white tracking-tight">Spending Policies</h1>
            <p className="text-xs sm:text-sm text-white/50">
              Define and enforce autonomous financial limits, approval gates, and allowlists for AI agents.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/policies/create')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-[0_4px_16px_rgba(37,99,235,0.35)] transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Create Policy</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'ACTIVE', 'AUTONOMOUS', 'MANDATORY_REVIEW'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filter === tab
                  ? 'bg-white/[0.1] text-white border border-white/[0.15] shadow-sm'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              {tab === 'ALL'
                ? 'All Policies'
                : tab === 'ACTIVE'
                ? 'Active'
                : tab === 'AUTONOMOUS'
                ? 'Autonomous'
                : 'Mandatory Review'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <span className="text-xs text-white/40 font-mono shrink-0">
            {filteredPolicies.length} {filteredPolicies.length === 1 ? 'Policy' : 'Policies'}
          </span>
        </div>
      </div>

      {/* Policies Cards Grid - Uncluttered List View */}
      {loading ? (
        <div className="p-12 text-center text-white/40 font-manrope">Loading configured policies...</div>
      ) : filteredPolicies.length === 0 ? (
        <div className="p-12 text-center bg-white/[0.02] border border-white/[0.06] rounded-3xl flex flex-col items-center justify-center gap-3">
          <Shield className="w-10 h-10 text-white/20" />
          <p className="text-sm font-semibold text-white/70">No policies found matching your search</p>
          <p className="text-xs text-white/40 max-w-sm">
            Create your first spending policy to establish financial guardrails for autonomous agents.
          </p>
          <button
            onClick={() => navigate('/policies/create')}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Policy</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPolicies.map((p) => {
            const allowedRecipientsCount = p.allowed_recipients ? p.allowed_recipients.length : 0;
            const allowedAssetsCount = p.allowed_assets ? p.allowed_assets.length : 0;

            return (
              <div
                key={p.id}
                className="p-5.5 rounded-2xl border border-white/[0.08] hover:border-white/[0.18] bg-white/[0.03] hover:bg-white/[0.05] transition-all flex flex-col justify-between gap-5 group backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/70 flex items-center justify-center shrink-0 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-space text-base font-bold text-white truncate">{p.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.2 bg-white/[0.06] rounded font-mono text-white/60">
                            v{p.version || 1}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.2 rounded-full font-semibold ${
                              p.is_active
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30'
                            }`}
                          >
                            {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-white/50 line-clamp-2 min-h-[32px]">
                    {p.description || 'Autonomous spending rule enforcing limits on single transactions and daily budgets.'}
                  </p>
                </div>

                {/* 4-Metric Grid */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-black/25 rounded-xl border border-white/[0.04] text-[11px]">
                  <div className="flex flex-col">
                    <span className="text-white/40 text-[10px]">Max / Tx</span>
                    <span className="font-space font-bold text-white tabular-nums">
                      {p.max_amount_per_tx} XLM
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/40 text-[10px]">Daily Cap</span>
                    <span className="font-space font-bold text-white tabular-nums">
                      {p.daily_spending_limit} XLM
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/40 text-[10px]">Weekly Cap</span>
                    <span className="font-space font-bold text-white tabular-nums">
                      {p.weekly_spending_limit} XLM
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/40 text-[10px]">Approval Gate</span>
                    <span className="font-space font-bold text-amber-300 tabular-nums">
                      &gt; {p.human_approval_threshold} XLM
                    </span>
                  </div>
                </div>

                {/* Tags & Action Button */}
                <div className="flex flex-col gap-3 pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>{allowedRecipientsCount} Recipients • {allowedAssetsCount} Assets</span>
                    <span className={p.require_human_approval_always ? 'text-amber-400/80 font-medium' : 'text-emerald-400/80 font-medium'}>
                      {p.require_human_approval_always ? 'Review Always' : 'Autonomous'}
                    </span>
                  </div>

                  <button
                    onClick={() => navigate(`/policies/edit?id=${p.id}`)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-white/[0.05] hover:bg-white/[0.1] active:bg-white/[0.14] border border-white/[0.08] hover:border-white/[0.15] text-white/90 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer group/btn"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>Configure Rules & Allowlists</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/40 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
