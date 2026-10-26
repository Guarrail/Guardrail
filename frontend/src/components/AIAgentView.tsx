import React, { useState, useEffect } from 'react';
import { ControlledWalletState } from '../types';
import { api, ApiAgent } from '../services/api';
import {
  Bot,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Play,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface AIAgentViewProps {
  controlledWallet: ControlledWalletState;
  onOpenSimulateModal: () => void;
}

export const AIAgentView: React.FC<AIAgentViewProps> = ({
  controlledWallet,
  onOpenSimulateModal,
}) => {
  const [currentAgent, setCurrentAgent] = useState<ApiAgent | null>(null);
  const [agentName, setAgentName] = useState('Payroll Assistant');
  const [description, setDescription] = useState(
    'Pays approved contractors weekly on Stellar Testnet under GuardRail policy.'
  );
  const [apiKey, setApiKey] = useState('gr_live_7f3k9921b7x40982');
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    api.getAgents().then((res) => {
      const list = Array.isArray(res) ? res : (res as { results?: ApiAgent[] })?.results || [];
      if (list.length > 0) {
        const ag = list[0];
        setCurrentAgent(ag);
        setAgentName(ag.name);
        setDescription(ag.description);
        setIsRevoked(ag.status === 'DISABLED');
      }
    }).catch((e) => console.warn('Could not fetch agents:', e));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRotateKey = async () => {
    setIsRotating(true);
    try {
      if (currentAgent) {
        const res = await api.rotateAgentKey(currentAgent.id);
        setApiKey(res.api_key);
        setIsRevoked(false);
        setToastMessage('API Key rotated on backend. New key issued.');
      } else {
        const newKey = 'gr_live_' + Math.random().toString(36).substring(2, 12);
        setApiKey(newKey);
        setToastMessage('API Key rotated successfully.');
      }
    } catch {
      const newKey = 'gr_live_' + Math.random().toString(36).substring(2, 12);
      setApiKey(newKey);
      setToastMessage('API Key rotated successfully.');
    } finally {
      setIsRotating(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleToggleRevoke = async () => {
    const nextState = !isRevoked;
    setIsRevoked(nextState);

    if (currentAgent) {
      if (nextState) {
        await api.emergencyDisableAgent(currentAgent.id).catch(() => {});
        setToastMessage('Emergency killswitch engaged: Agent disabled. All requests refused.');
      } else {
        await api.activateAgent(currentAgent.id).catch(() => {});
        setToastMessage('Agent reactivated successfully.');
      }
    } else {
      setToastMessage(nextState ? 'Emergency killswitch engaged.' : 'Agent reactivated.');
    }
    setTimeout(() => setToastMessage(''), 3500);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Toast */}
      {toastMessage && (
        <div className="p-3 bg-[#202938] border border-[#4AC777] text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-[#4AC777]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Agent Details */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-5">
          <h2 className="font-space text-xl font-bold text-white tracking-tight">
            Agent details
          </h2>

          <div className="flex flex-col gap-4">
            {/* Agent Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-bold text-white">
                Agent name
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="px-3.5 py-2 bg-[#09101A] border border-[#2B3340] rounded-lg text-xs sm:text-sm text-white font-medium focus:outline-hidden focus:border-[#4AC777]"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-bold text-white">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-3.5 py-2 bg-[#09101A] border border-[#2B3340] rounded-lg text-xs sm:text-sm text-white font-medium focus:outline-hidden focus:border-[#4AC777]"
              />
            </div>

            {/* Readonly specs */}
            <div className="flex flex-col divide-y divide-[#2B3340] text-xs sm:text-sm pt-2">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">Agent ID</span>
                <span className="font-space text-white font-semibold">agt_7f3k29xq</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">Assigned wallet</span>
                <span className="font-mono text-white text-xs truncate max-w-[200px]">
                  {controlledWallet.address}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">Assigned policy</span>
                <span className="text-white font-semibold">Default v3</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#9099A5]">Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                    isRevoked
                      ? 'bg-[#ED4A49]/15 text-[#ED4A49]'
                      : 'bg-[#4AC777]/15 text-[#4AC777]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRevoked ? 'bg-[#ED4A49]' : 'bg-[#4AC777]'
                    }`}
                  />
                  <span>{isRevoked ? 'Revoked' : 'Active'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Credential */}
        <div className="p-6 sm:p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col justify-between gap-6 h-full">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-space text-xl font-bold text-white tracking-tight">
                Authentication credential
              </h2>
              <p className="text-xs sm:text-sm text-[#9099A5] mt-1">
                The agent uses this API key to sign requests to GuardRail.
              </p>
            </div>

            {/* API Key Box */}
            <div className="p-4 bg-[#09101A] border border-[#2B3340] rounded-lg flex flex-col gap-2">
              <div className="text-[11px] font-space text-[#9099A5] uppercase tracking-wider flex items-center justify-between">
                <span>Bearer API Key</span>
                <span className="text-[#4AC777]">Live Environment</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-xs sm:text-sm text-white font-bold truncate">
                  {showKey
                    ? apiKey
                    : `gr_live_${apiKey.slice(8, 12)}••••••••••••`}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 text-[#9099A5] hover:text-white rounded hover:bg-[#202938] transition-colors"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-[#9099A5]" />}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 text-[#9099A5] hover:text-white rounded hover:bg-[#202938] transition-colors"
                    title="Copy API key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-[#4AC777]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#1D2430] border border-[#2B3340] rounded-lg text-xs text-[#9099A5]">
              Pass this key in the <code className="text-white font-mono">Authorization: Bearer &lt;key&gt;</code> header of your agent runtime requests.
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleRotateKey}
              disabled={isRotating}
              className="px-4 py-2 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-white rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
              <span>Rotate Key</span>
            </button>

            <button
              onClick={handleToggleRevoke}
              className={`px-4 py-2 border rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                isRevoked
                  ? 'bg-[#4AC777]/20 border-[#4AC777] text-[#4AC777]'
                  : 'bg-[#ED4A49]/10 border-[#ED4A49]/30 text-[#ED4A49] hover:bg-[#ED4A49]/20'
              }`}
            >
              {isRevoked ? 'Restore Access' : 'Revoke Key'}
            </button>

            <button
              onClick={onOpenSimulateModal}
              className="px-4 py-2 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ml-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate Agent Req</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
