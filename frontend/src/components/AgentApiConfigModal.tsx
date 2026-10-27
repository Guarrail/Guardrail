import React, { useState, useEffect } from 'react';
import { ApiAgent, ApiPolicy, ApiTransactionRequest, api, getPublicApiBaseUrl } from '../services/api';
import {
  Bot,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Code2,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  X,
  CheckCircle2,
  Lock,
  Sparkles,
  Terminal,
  Cpu,
  Coins,
} from 'lucide-react';

interface AgentApiConfigModalProps {
  agent: ApiAgent;
  initialApiKey?: string;
  initialStellarSecretKey?: string;
  policy?: ApiPolicy;
  walletAddress?: string;
  onClose: () => void;
  onRequestCreated?: () => void;
  onNavigateToRequests?: () => void;
}

export const AgentApiConfigModal: React.FC<AgentApiConfigModalProps> = ({
  agent,
  initialApiKey = '',
  initialStellarSecretKey = '',
  policy,
  walletAddress = '',
  onClose,
  onRequestCreated,
  onNavigateToRequests,
}) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'build_tx' | 'swap_tokens'>('credentials');
  const [codeLang, setCodeLang] = useState<'curl' | 'python' | 'node'>('curl');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Credentials state (defaults to full API key if present, then prefix)
  const [apiKey, setApiKey] = useState<string>(initialApiKey || agent.api_key || agent.api_key_prefix || '');
  const [stellarSecretKey, setStellarSecretKey] = useState<string>(
    initialStellarSecretKey || agent.stellar_secret_key || ''
  );
  const [showApiKey, setShowApiKey] = useState<boolean>(true);
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);

  // Sync credentials if agent or initial props update
  useEffect(() => {
    const key = initialApiKey || agent.api_key || agent.api_key_prefix || '';
    if (key) setApiKey(key);
    const sec = initialStellarSecretKey || agent.stellar_secret_key || '';
    if (sec) setStellarSecretKey(sec);
  }, [agent, initialApiKey, initialStellarSecretKey]);

  const effectiveApiKey = apiKey || agent.api_key || agent.api_key_prefix || '';
  const effectiveSecretKey = stellarSecretKey || agent.stellar_secret_key || '';

  // Build Transaction Form State
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [customRecipient, setCustomRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('5.0');
  const [assetCode, setAssetCode] = useState<string>('XLM');
  const [requestId, setRequestId] = useState<string>(() => `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  const [memo, setMemo] = useState<string>('Autonomous payout task');

  // Payment Submission State
  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<ApiTransactionRequest | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // DEX / AMM Token Swap State
  const [sendAsset, setSendAsset] = useState<string>('XLM');
  const [destAsset, setDestAsset] = useState<string>('USDC');
  const [swapAmount, setSwapAmount] = useState<string>('10.0');
  const [swapDestination, setSwapDestination] = useState<string>('');
  const [isSubmittingSwap, setIsSubmittingSwap] = useState<boolean>(false);
  const [swapResult, setSwapResult] = useState<ApiTransactionRequest | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapCodeLang, setSwapCodeLang] = useState<'curl' | 'python' | 'node'>('curl');

  // Initialize recipient from policy
  useEffect(() => {
    if (policy && policy.allowed_recipients && policy.allowed_recipients.length > 0) {
      setSelectedRecipient(policy.allowed_recipients[0].address);
    }
  }, [policy]);

  const copyText = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const regenerateRequestId = () => {
    setRequestId(`req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  };

  const targetRecipient = selectedRecipient === 'custom' ? customRecipient.trim() : selectedRecipient.trim();

  // Real-time policy pre-flight check for direct payments
  const numAmount = parseFloat(amount) || 0;
  const maxTx = policy ? parseFloat(policy.max_amount_per_tx) : 25;
  const approvalGate = policy ? parseFloat(policy.human_approval_threshold) : 15;
  const isAlwaysApprove = policy?.require_human_approval_always || agent.autonomy_mode === 'HUMAN_APPROVAL_ALWAYS';

  const cleanTargetRecipient = targetRecipient.toUpperCase();
  const matchedBlockedRecipient = policy?.blocked_recipients?.find(
    (b) => b.is_active !== false && b.address && b.address.trim().toUpperCase() === cleanTargetRecipient
  );
  const isRecipientBlocked = Boolean(cleanTargetRecipient && matchedBlockedRecipient);
  const isAmountBlocked = numAmount > maxTx;
  const willBeBlocked = isRecipientBlocked || isAmountBlocked;
  const willRequireApproval = !willBeBlocked && (isAlwaysApprove || numAmount > approvalGate);
  const willAutoApprove = !willBeBlocked && !willRequireApproval && numAmount > 0;

  // Real-time policy pre-flight check for DEX token swaps
  const numSwapAmount = parseFloat(swapAmount) || 0;
  const swapWillBeBlocked = numSwapAmount > maxTx;
  const swapWillRequireApproval = !swapWillBeBlocked && (isAlwaysApprove || numSwapAmount > approvalGate);
  const swapWillAutoExecute = !swapWillBeBlocked && !swapWillRequireApproval && numSwapAmount > 0;

  // Handle building & submitting transaction to GuardRail
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRecipient) {
      setSubmissionError('Please provide a valid recipient Stellar address.');
      return;
    }
    if (numAmount <= 0) {
      setSubmissionError('Amount must be strictly greater than zero.');
      return;
    }

    try {
      setIsSubmittingTx(true);
      setSubmissionError(null);

      // Simulate client-side PDA signing simulation envelope
      const simulatedEnvelope = `AAAAAGuardRailSimulatedPDAEnvelope_${agent.stellar_public_key.slice(0, 8)}_${numAmount}${assetCode}`;

      const res = await api.submitAgentRequest(
        {
          request_id: requestId,
          recipient: targetRecipient,
          amount: amount,
          asset: assetCode,
          wallet_id: agent.wallet,
          stellar_envelope_xdr: simulatedEnvelope,
        },
        apiKey || undefined
      );

      setSubmissionResult(res);

      // Notify parent to refresh request feed
      if (onRequestCreated) {
        onRequestCreated();
      }
    } catch (err: unknown) {
      setSubmissionError(err instanceof Error ? err.message : 'Transaction proposal failed.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // Handle executing DEX token swap
  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numSwapAmount <= 0) {
      setSwapError('Swap amount must be strictly greater than zero.');
      return;
    }
    if (sendAsset === destAsset) {
      setSwapError('Source asset and destination asset must be different.');
      return;
    }

    try {
      setIsSubmittingSwap(true);
      setSwapError(null);

      const res = await api.submitAgentSwap(
        {
          send_asset: sendAsset,
          dest_asset: destAsset,
          amount: swapAmount,
          destination: swapDestination.trim() || undefined,
          auto_execute: true,
        },
        apiKey || undefined
      );

      setSwapResult(res);
      if (onRequestCreated) {
        onRequestCreated();
      }
    } catch (err: unknown) {
      setSwapError(err instanceof Error ? err.message : 'Swap execution failed.');
    } finally {
      setIsSubmittingSwap(false);
    }
  };

  // Dynamically resolved public API Base URL (e.g. https://api.guardraill.xyz/api/v1)
  const apiBase = getPublicApiBaseUrl();

  // Direct Payment Code Snippets
  const curlSnippet = `# 1. Query active policy limits and remaining daily budget
curl -X GET "${apiBase}/agent/policy-summary/" \\
  -H "X-Agent-Key: ${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}"

# 2. Build & Submit Payment Request to GuardRail Coordinator
# Tip: "request_id" is optional; omit it to auto-generate a fresh ID per transaction
curl -X POST "${apiBase}/agent/requests/" \\
  -H "X-Agent-Key: ${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipient": "${targetRecipient || 'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE'}",
    "amount": "${amount}",
    "asset": "${assetCode}"
  }'`;

  const pythonSnippet = `import requests
from stellar_sdk import Keypair, TransactionBuilder, Network, Payment, Asset

API_BASE = "${apiBase}"
AGENT_KEY = "${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}"
PDA_SECRET = "${effectiveSecretKey || 'S_YOUR_PDA_SECRET_KEY'}"

# Step 1: Query spending policy constraints
headers = {"X-Agent-Key": AGENT_KEY, "Content-Type": "application/json"}
policy_res = requests.get(f"{API_BASE}/agent/policy-summary/", headers=headers).json()
print("Active Policy Limits:", policy_res.get("policy"))

# Step 2: Propose payment request to GuardRail Policy Coordinator (request_id is optional)
payload = {
    "recipient": "${targetRecipient || 'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE'}",
    "amount": "${amount}",
    "asset": "${assetCode}",
}

response = requests.post(f"{API_BASE}/agent/requests/", json=payload, headers=headers)
result = response.json()
print("GuardRail Decision:", result.get("status"))
if result.get("status") == "PENDING_APPROVAL":
    print("Action required: Operator approval requested.")
elif result.get("status") == "APPROVED":
    print("Permit issued! Auto-approved for dual-custody co-signing.")`;

  const nodeSnippet = `import fetch from 'node-fetch';

const API_BASE = '${apiBase}';
const AGENT_KEY = '${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}';

async function submitPayment() {
  // Step 1: Submit transaction request (request_id is optional and auto-generated)
  const res = await fetch(\`\${API_BASE}/agent/requests/\`, {
    method: 'POST',
    headers: {
      'X-Agent-Key': AGENT_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: '${targetRecipient || 'GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE'}',
      amount: '${amount}',
      asset: '${assetCode}',
    }),
  });

  const data = await res.json();
  console.log('GuardRail Response:', data.status, 'Permit:', data.permit?.id);
}

submitPayment();`;

  // DEX Token Swap Code Snippets
  const swapCurlSnippet = `# 1. Query active policy limits & allowed assets
curl -X GET "${apiBase}/agent/policy-summary/" \\
  -H "X-Agent-Key: ${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}"

# 2. Execute or propose DEX / AMM Token Swap via GuardRail Policy Engine
# Note: request_id is optional and auto-generated per trade
curl -X POST "${apiBase}/agent/swap/" \\
  -H "X-Agent-Key: ${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "send_asset": "${sendAsset}",
    "dest_asset": "${destAsset}",
    "amount": "${swapAmount}",
    "auto_execute": true
  }'`;

  const swapPythonSnippet = `import requests

API_BASE = "${apiBase}"
AGENT_KEY = "${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}"

headers = {
    "X-Agent-Key": AGENT_KEY,
    "Content-Type": "application/json",
}

# Step 1: Submit live AMM / DEX token swap to GuardRail Coordinator
payload = {
    "send_asset": "${sendAsset}",
    "dest_asset": "${destAsset}",
    "amount": "${swapAmount}",
    "auto_execute": True,
}

response = requests.post(f"{API_BASE}/agent/swap/", json=payload, headers=headers)
result = response.json()

print("Status:", result.get("status"))
if result.get("status") == "EXECUTED":
    print("Swap Confirmed on Stellar Testnet!")
    print("Tx Hash:", result.get("stellar_tx_hash"))
    print("Explorer:", result.get("stellar_explorer_url"))
elif result.get("status") == "PENDING_APPROVAL":
    print("Human operator approval required by policy threshold.")`;

  const swapNodeSnippet = `import fetch from 'node-fetch';

const API_BASE = '${apiBase}';
const AGENT_KEY = '${effectiveApiKey || 'gr_live_YOUR_AGENT_API_KEY'}';

async function executeTokenSwap() {
  const res = await fetch(\`\${API_BASE}/agent/swap/\`, {
    method: 'POST',
    headers: {
      'X-Agent-Key': AGENT_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      send_asset: '${sendAsset}',
      dest_asset: '${destAsset}',
      amount: '${swapAmount}',
      auto_execute: true,
    }),
  });

  const data = await res.json();
  console.log('Swap Result:', data.status);
  if (data.stellar_tx_hash) {
    console.log('Stellar Explorer:', data.stellar_explorer_url);
  }
}

executeTokenSwap();`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl bg-[#09101A] border border-white/[0.12] rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.08)] flex flex-col max-h-[92vh] overflow-hidden text-white font-manrope animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-space text-lg sm:text-xl font-bold tracking-tight truncate">
                  API Configuration & Integration
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/[0.06] text-white/70 border border-white/[0.08]">
                  {agent.agent_id}
                </span>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                    agent.autonomy_mode === 'HUMAN_APPROVAL_ALWAYS'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {agent.autonomy_mode === 'HUMAN_APPROVAL_ALWAYS' ? 'Review Required' : 'Autonomous Mode'}
                </span>
              </div>
              <p className="text-xs text-white/50 truncate">
                Agent: <span className="text-white/80 font-medium">{agent.name}</span> • Signer Weight:{' '}
                <span className="font-mono text-blue-300 font-semibold">{agent.signer_weight || 1}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 pt-3 border-b border-white/[0.06] bg-black/20 gap-3">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`flex items-center gap-2 pb-3 px-1 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
              activeTab === 'credentials' ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Key className="w-4 h-4 text-blue-400" />
            <span>Credentials & Code Snippets</span>
            {activeTab === 'credentials' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('build_tx')}
            className={`flex items-center gap-2 pb-3 px-1 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
              activeTab === 'build_tx' ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>Build, Sign & Send Transaction</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold border border-emerald-500/30">
              PAYMENTS
            </span>
            {activeTab === 'build_tx' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('swap_tokens')}
            className={`flex items-center gap-2 pb-3 px-1 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
              activeTab === 'swap_tokens' ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Coins className="w-4 h-4 text-purple-400" />
            <span>Buy / Swap Tokens (DEX)</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-purple-500/20 text-purple-300 rounded font-mono font-bold border border-purple-500/30">
              TRADING
            </span>
            {activeTab === 'swap_tokens' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {activeTab === 'credentials' && (
            <div className="flex flex-col gap-6">
              {/* Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: API Key */}
                <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-400" />
                      Agent API Key
                    </span>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[11px] text-white/60 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showApiKey ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-2.5 bg-black/30 rounded-xl border border-white/[0.04]">
                    <span className="font-mono text-xs text-emerald-300 break-all select-all">
                      {showApiKey ? effectiveApiKey || 'gr_live_••••••••••••••••' : '•'.repeat(32)}
                    </span>
                    <button
                      onClick={() => copyText(effectiveApiKey, 'api_key')}
                      className="p-1.5 bg-white/[0.06] hover:bg-white/[0.12] rounded-lg text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
                      title="Copy API Key"
                    >
                      {copiedKey === 'api_key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <span className="text-[11px] text-white/40">
                    Include in HTTP header: <code className="text-white/70 font-mono">X-Agent-Key: &lt;key&gt;</code>
                  </span>
                </div>

                {/* Card 2: Stellar PDA Address */}
                <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                      Stellar PDA Public Address
                    </span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${agent.stellar_public_key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explorer</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-2.5 bg-black/30 rounded-xl border border-white/[0.04]">
                    <span className="font-mono text-xs text-white break-all select-all">
                      {agent.stellar_public_key}
                    </span>
                    <button
                      onClick={() => copyText(agent.stellar_public_key, 'pda_pub')}
                      className="p-1.5 bg-white/[0.06] hover:bg-white/[0.12] rounded-lg text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
                      title="Copy PDA Address"
                    >
                      {copiedKey === 'pda_pub' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <span className="text-[11px] text-white/40">
                    Authorized Multisig Signer (Weight: {agent.signer_weight || 1})
                  </span>
                </div>

                {/* Card 3: Stellar PDA Secret Key (if available) */}
                {effectiveSecretKey && (
                  <div className="p-4 bg-rose-500/[0.06] border border-rose-500/20 rounded-2xl flex flex-col justify-between gap-3 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        Stellar PDA Secret Key (Private Signing Key)
                      </span>
                      <button
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="text-[11px] text-rose-300/80 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
                      >
                        {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showSecretKey ? 'Hide' : 'Reveal'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2.5 bg-black/30 rounded-xl border border-rose-500/10">
                      <span className="font-mono text-xs text-rose-200 break-all select-all">
                        {showSecretKey ? effectiveSecretKey : '•'.repeat(48)}
                      </span>
                      <button
                        onClick={() => copyText(effectiveSecretKey, 'pda_sec')}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-200 transition-all cursor-pointer shrink-0"
                        title="Copy Secret Key"
                      >
                        {copiedKey === 'pda_sec' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-rose-300/70">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>Used by agent runtime to sign Stellar transaction envelopes before proposing to GuardRail.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Policy Parameters Overview */}
              {policy && (
                <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      Assigned Policy: {policy.name} (v{policy.version})
                    </span>
                    <span className="text-[11px] text-white/40">
                      {policy.allowed_recipients?.length || 0} Allowed Destination(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04] flex flex-col">
                      <span className="text-white/40 text-[10px]">Max / Tx</span>
                      <span className="font-space font-bold text-white tabular-nums mt-0.5">
                        {policy.max_amount_per_tx} XLM
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04] flex flex-col">
                      <span className="text-white/40 text-[10px]">Daily Cap</span>
                      <span className="font-space font-bold text-white tabular-nums mt-0.5">
                        {policy.daily_spending_limit} XLM
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04] flex flex-col">
                      <span className="text-white/40 text-[10px]">Approval Gate</span>
                      <span className="font-space font-bold text-amber-300 tabular-nums mt-0.5">
                        &gt; {policy.human_approval_threshold} XLM
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/20 rounded-xl border border-white/[0.04] flex flex-col">
                      <span className="text-white/40 text-[10px]">Human Review</span>
                      <span className="font-space font-bold text-white tabular-nums mt-0.5">
                        {policy.require_human_approval_always ? 'Always' : 'Conditional'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Code Snippets Box */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-blue-400 text-[10px] uppercase shrink-0">Live API Endpoint:</span>
                    <span className="font-mono text-[11px] text-blue-200 select-all truncate">{apiBase}</span>
                  </div>
                  <button
                    onClick={() => copyText(apiBase, 'api_base_url')}
                    className="p-1.5 hover:bg-blue-500/20 rounded-lg text-blue-300 transition-colors cursor-pointer shrink-0 ml-2"
                    title="Copy API Endpoint"
                  >
                    {copiedKey === 'api_base_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/70 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-400" />
                    Integration Snippets
                  </span>

                  {/* Language Selector */}
                  <div className="flex items-center gap-1 p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs">
                    {(['curl', 'python', 'node'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setCodeLang(lang)}
                        className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          codeLang === lang
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-white/50 hover:text-white'
                        }`}
                      >
                        {lang === 'curl' ? 'cURL' : lang === 'python' ? 'Python' : 'Node.js'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative rounded-2xl bg-[#05080e] border border-white/[0.08] p-4 font-mono text-xs overflow-x-auto shadow-inner">
                  <button
                    onClick={() =>
                      copyText(
                        codeLang === 'curl' ? curlSnippet : codeLang === 'python' ? pythonSnippet : nodeSnippet,
                        'snippet'
                      )
                    }
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white transition-all text-[11px] cursor-pointer"
                  >
                    {copiedKey === 'snippet' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <pre className="text-white/80 whitespace-pre leading-relaxed pr-16">
                    {codeLang === 'curl' ? curlSnippet : codeLang === 'python' ? pythonSnippet : nodeSnippet}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'build_tx' && (
            <div className="flex flex-col gap-6">
              {/* Header Description */}
              <div className="p-4 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-white/70">
                  <p className="font-semibold text-white">Interactive Transaction Builder & API Dispatcher</p>
                  <p className="mt-0.5">
                    Build a real payment transaction using this agent's PDA signer key and configured policy limits.
                    The GuardRail policy coordinator will evaluate the request atomically and submit it into the{' '}
                    <span className="text-blue-300 font-semibold">Request Queue</span> for approval or immediate co-signing.
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitTransaction} className="flex flex-col gap-5">
                {/* 1. Recipient Selection */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white/70">Destination Recipient Address</label>
                  {policy && policy.allowed_recipients && policy.allowed_recipients.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <select
                        value={selectedRecipient}
                        onChange={(e) => setSelectedRecipient(e.target.value)}
                        className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {policy.allowed_recipients.map((r) => (
                          <option key={r.id} value={r.address} className="bg-[#09101A] text-white">
                            {r.label} ({r.address.slice(0, 8)}...{r.address.slice(-6)})
                          </option>
                        ))}
                        <option value="custom" className="bg-[#09101A] text-white">
                          + Custom Stellar Address...
                        </option>
                      </select>

                      {selectedRecipient === 'custom' && (
                        <input
                          type="text"
                          required
                          placeholder="G..."
                          value={customRecipient}
                          onChange={(e) => setCustomRecipient(e.target.value)}
                          className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE"
                      value={selectedRecipient}
                      onChange={(e) => setSelectedRecipient(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>

                {/* 2. Amount and Asset */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white/70">Amount ({assetCode})</label>
                      <div className="flex items-center gap-1">
                        {['5', '15', '25', '50'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAmount(preset)}
                            className="px-2 py-0.5 text-[10px] bg-white/[0.06] hover:bg-white/[0.12] rounded text-white/70 hover:text-white cursor-pointer font-mono"
                          >
                            +{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      required
                      min="0.1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-white/70">Asset Currency</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['XLM', 'USDC', 'EURC'] as const).map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setAssetCode(code)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            assetCode === code
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400'
                              : 'bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>{code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Idempotency Request ID & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white/70">Idempotency Request ID</label>
                      <button
                        type="button"
                        onClick={regenerateRequestId}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={requestId}
                      onChange={(e) => setRequestId(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-white/70">Transaction Memo / Purpose</label>
                    <input
                      type="text"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Live Pre-Flight Policy Evaluation Prediction Banner */}
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 text-xs transition-all ${
                    willBeBlocked
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : willRequireApproval
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  {willBeBlocked ? (
                    <>
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-rose-300">
                          {isRecipientBlocked ? 'Recipient Blacklisted by Policy' : 'Policy Breach Detected'}
                        </span>
                        <p className="text-rose-200/80 mt-0.5">
                          {isRecipientBlocked
                            ? `Destination address (${cleanTargetRecipient.slice(0, 8)}...${cleanTargetRecipient.slice(-6)}) is on the policy blacklist${
                                matchedBlockedRecipient?.reason ? `: "${matchedBlockedRecipient.reason}"` : ''
                              }. GuardRail coordinator will reject and block this transaction.`
                            : `Amount (${numAmount} ${assetCode}) exceeds single transaction limit of ${maxTx} ${assetCode}. GuardRail coordinator will evaluate and block this transaction.`}
                        </p>
                      </div>
                    </>
                  ) : willRequireApproval ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-300">Operator Approval Gate Triggered</span>
                        <p className="text-amber-200/80 mt-0.5">
                          {isAlwaysApprove
                            ? 'Agent is configured with "Human Approval Always".'
                            : `Amount (${numAmount} ${assetCode}) exceeds autonomous threshold of ${approvalGate} ${assetCode}.`}{' '}
                          This transaction will be placed into <span className="font-semibold text-amber-300">PENDING_APPROVAL</span> in the Request Page.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-emerald-300">Autonomous Execution Eligible</span>
                        <p className="text-emerald-200/80 mt-0.5">
                          Amount ({numAmount} {assetCode}) is within autonomous limits (&lt;= {approvalGate} {assetCode}) and recipient is verified. Will be automatically approved!
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {submissionError && (
                  <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{submissionError}</span>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmittingTx}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 text-white rounded-2xl text-sm font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingTx ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing with PDA & Evaluating Policy...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Build, Sign & Send Request to Coordinator</span>
                    </>
                  )}
                </button>
              </form>

              {/* Submission Result Display */}
              {submissionResult && (
                <div
                  className={`p-5 border rounded-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 ${
                    submissionResult.status === 'BLOCKED'
                      ? 'bg-rose-950/25 border-rose-500/40'
                      : 'bg-white/[0.035] border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      {submissionResult.status === 'BLOCKED' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        GuardRail Coordinator Result
                      </span>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
                        submissionResult.status === 'APPROVED' || submissionResult.status === 'EXECUTED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : submissionResult.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {submissionResult.status}
                    </span>
                  </div>

                  {submissionResult.status === 'BLOCKED' && (
                    <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Transaction Blocked by GuardRail Policy</span>
                      </div>
                      {submissionResult.policy_evaluation_results?.failure_reasons &&
                      submissionResult.policy_evaluation_results.failure_reasons.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-rose-200/90 text-[11px]">
                          {submissionResult.policy_evaluation_results.failure_reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-rose-200/80 text-[11px]">
                          Destination address or transaction parameters violated active policy rules.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Request ID</span>
                      <span className="font-mono text-white text-[11px] truncate mt-0.5">
                        {submissionResult.request_id}
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Amount</span>
                      <span className="font-space font-bold text-white tabular-nums mt-0.5">
                        {submissionResult.amount} {submissionResult.asset_code}
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Human Review</span>
                      <span className="font-semibold text-white mt-0.5">
                        {submissionResult.requires_human_approval ? 'Required' : 'Auto-Approved'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Permit ID</span>
                      <span className="font-mono text-emerald-300 text-[11px] truncate mt-0.5">
                        {submissionResult.permit?.id ? `${submissionResult.permit.id.slice(0, 8)}...` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {submissionResult.stellar_tx_hash && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-semibold text-emerald-300">Live Stellar Testnet Confirmed:</span>
                        <span className="font-mono text-white/80">{submissionResult.stellar_tx_hash.slice(0, 16)}...</span>
                      </div>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${submissionResult.stellar_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 rounded-lg flex items-center gap-1 font-semibold transition-all ml-auto"
                      >
                        <span>View on Stellar Expert</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Navigation Button directly addressing requirement 2 */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-white/50">
                      Transaction is now recorded in the coordinator database.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onNavigateToRequests) onNavigateToRequests();
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2 group"
                    >
                      <span>View in Requests Page</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Swap / Buy Tokens (DEX / AMM) */}
          {activeTab === 'swap_tokens' && (
            <div className="flex flex-col gap-6">
              {/* Top Banner */}
              <div className="p-4 bg-purple-500/[0.08] border border-purple-500/20 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Stellar DEX / AMM Token Swap API
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Path Payment Strict Send
                      </span>
                    </h3>
                    <p className="text-xs text-white/60 mt-0.5">
                      Empower your AI Agent to execute autonomous decentralized trades on Stellar Testnet liquidity pools, strictly bounded by your policy limits.
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Two-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Interactive Swap Form */}
                <form
                  onSubmit={handleExecuteSwap}
                  className="lg:col-span-6 p-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl space-y-4 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-purple-400" />
                      <h4 className="text-sm font-bold text-white">Execute Token Swap</h4>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      POST /api/v1/agent/swap/
                    </span>
                  </div>

                  {/* Send & Receive Asset Selectors */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-white/60 mb-1.5 block">
                        You Pay (Send Asset)
                      </label>
                      <select
                        value={sendAsset}
                        onChange={(e) => setSendAsset(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="XLM" className="bg-[#09101A]">XLM (Native Lumens)</option>
                        <option value="USDC" className="bg-[#09101A]">USDC (Circle USD)</option>
                        <option value="EURC" className="bg-[#09101A]">EURC (Euro Coin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-white/60 mb-1.5 block">
                        You Receive (Dest Asset)
                      </label>
                      <select
                        value={destAsset}
                        onChange={(e) => setDestAsset(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="USDC" className="bg-[#09101A]">USDC (Circle USD)</option>
                        <option value="EURC" className="bg-[#09101A]">EURC (Euro Coin)</option>
                        <option value="XLM" className="bg-[#09101A]">XLM (Native Lumens)</option>
                      </select>
                    </div>
                  </div>

                  {/* Swap Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-medium text-white/60">
                        Amount to Swap ({sendAsset})
                      </label>
                      <span className="text-[10px] text-white/40">
                        Max per Tx: <span className="font-mono text-purple-300 font-semibold">{maxTx}</span>
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.0000001"
                        min="0.0000001"
                        value={swapAmount}
                        onChange={(e) => setSwapAmount(e.target.value)}
                        placeholder="10.0"
                        className="w-full pl-3.5 pr-16 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm font-space font-bold text-white focus:outline-none focus:border-purple-500 placeholder:text-white/20"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/50">
                        {sendAsset}
                      </span>
                    </div>
                  </div>

                  {/* Destination Address */}
                  <div>
                    <label className="text-[11px] font-medium text-white/60 mb-1.5 block">
                      Receiving Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={swapDestination}
                      onChange={(e) => setSwapDestination(e.target.value)}
                      placeholder={`Defaults to Agent PDA (${agent.stellar_public_key.slice(0, 12)}...)`}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-xs font-mono text-white/90 focus:outline-none focus:border-purple-500 placeholder:text-white/30"
                    />
                    <p className="text-[10px] text-white/40 mt-1">
                      Tokens are deposited directly into the Agent's PDA address on Stellar Testnet.
                    </p>
                  </div>

                  {/* Live Policy Pre-Flight Card */}
                  <div className="p-3 bg-black/30 border border-white/[0.06] rounded-xl space-y-2">
                    <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider block">
                      Policy Pre-Flight Check
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        {swapWillBeBlocked ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className={swapWillBeBlocked ? 'text-rose-300' : 'text-white/80'}>
                          {swapWillBeBlocked ? 'Exceeds Per-Tx Limit' : 'Within Per-Tx Limit'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-white/80">Asset Permitted</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs">
                      <span className="text-white/50 text-[11px]">Execution Path:</span>
                      <span
                        className={`font-semibold text-[11px] ${
                          swapWillBeBlocked
                            ? 'text-rose-400'
                            : swapWillRequireApproval
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {swapWillBeBlocked
                          ? 'Blocked by Policy'
                          : swapWillRequireApproval
                          ? 'Requires Operator Approval'
                          : 'Autonomous Instant Execution'}
                      </span>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {swapError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{swapError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingSwap || numSwapAmount <= 0}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmittingSwap ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing Live DEX Swap...</span>
                      </>
                    ) : (
                      <>
                        <Coins className="w-4 h-4" />
                        <span>Swap {swapAmount} {sendAsset} for {destAsset}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Right: Code Integration Snippets */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                  <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-purple-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          AI Agent Code Integration
                        </h4>
                      </div>

                      {/* Language Selector */}
                      <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/[0.06]">
                        {(['curl', 'python', 'node'] as const).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSwapCodeLang(lang)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                              swapCodeLang === lang
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-white/50 hover:text-white'
                            }`}
                          >
                            {lang.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <pre className="p-3.5 bg-black/50 border border-white/[0.06] rounded-xl text-[11px] font-mono text-purple-200/90 overflow-x-auto max-h-[300px] leading-relaxed select-all">
                        {swapCodeLang === 'curl' && swapCurlSnippet}
                        {swapCodeLang === 'python' && swapPythonSnippet}
                        {swapCodeLang === 'node' && swapNodeSnippet}
                      </pre>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            swapCodeLang === 'curl'
                              ? swapCurlSnippet
                              : swapCodeLang === 'python'
                              ? swapPythonSnippet
                              : swapNodeSnippet,
                            'swap_code_snippet'
                          )
                        }
                        className="absolute top-2.5 right-2.5 p-1.5 bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white rounded-lg transition-all cursor-pointer"
                        title="Copy code snippet"
                      >
                        {copiedKey === 'swap_code_snippet' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-white/40 leading-normal">
                      The AI agent calls this endpoint whenever it decides to rebalance or execute a trade. GuardRail evaluates policy limits, co-signs, and executes the swap atomically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Execution Result Banner */}
              {swapResult && (
                <div className="p-5 bg-purple-500/[0.08] border border-purple-500/30 rounded-2xl flex flex-col gap-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">DEX Swap Proposal Result</h4>
                        <span className="text-[11px] text-white/50 font-mono">
                          Request: {swapResult.request_id}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                        swapResult.status === 'EXECUTED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : swapResult.status === 'APPROVED'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : swapResult.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {swapResult.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Trade Pair</span>
                      <span className="font-mono font-bold text-purple-300 text-[11px] mt-0.5">
                        {swapResult.asset_code}
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Swap Amount</span>
                      <span className="font-space font-bold text-white tabular-nums mt-0.5">
                        {swapResult.amount}
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Human Review</span>
                      <span className="font-semibold text-white mt-0.5">
                        {swapResult.requires_human_approval ? 'Required' : 'Auto-Approved'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/30 rounded-xl flex flex-col">
                      <span className="text-white/40 text-[10px]">Destination</span>
                      <span className="font-mono text-white/80 text-[11px] truncate mt-0.5">
                        {swapResult.recipient.slice(0, 10)}...
                      </span>
                    </div>
                  </div>

                  {swapResult.stellar_tx_hash && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-semibold text-emerald-300">Live DEX Swap Confirmed:</span>
                        <span className="font-mono text-white/80">{swapResult.stellar_tx_hash.slice(0, 16)}...</span>
                      </div>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${swapResult.stellar_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 rounded-lg flex items-center gap-1 font-semibold transition-all ml-auto"
                      >
                        <span>View on Stellar Expert</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-white/50">
                      Swap recorded with atomic permit and ledger tracking.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onNavigateToRequests) onNavigateToRequests();
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2 group"
                    >
                      <span>View in Requests Page</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
