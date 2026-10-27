import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  BookOpen,
  Compass,
  Shield,
  ShieldCheck,
  Bot,
  Wallet,
  FileText,
  ScrollText,
  Settings,
  Coins,
  Terminal,
  Zap,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Search,
  Code,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Users,
  Sliders,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
} from 'lucide-react';

interface HelpViewProps {
  onOpenSimulateModal?: () => void;
}

export const HelpView: React.FC<HelpViewProps> = ({ onOpenSimulateModal }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'console' | 'agents' | 'multisig' | 'api' | 'faq'>('console');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [codeLanguage, setCodeLanguage] = useState<'curl' | 'python' | 'javascript'>('curl');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const faqItems = [
    {
      q: 'Why was my transaction request BLOCKED by policy?',
      a: 'Transactions are marked as BLOCKED when they violate any constraint configured in your active policy. Common reasons include: (1) The amount exceeds the maximum per-transaction ceiling, (2) The transaction would exceed the rolling 24-hour daily or 7-day weekly spending budget, (3) The recipient address is on the Blacklist, (4) The recipient address is not in the Whitelist (if whitelist enforcement is active), or (5) The AI Agent has been disabled via the emergency killswitch.',
    },
    {
      q: 'Why is my request PENDING_APPROVAL when Autonomous mode is ON?',
      a: 'Even with Autonomous mode ON, a transaction requires human operator co-signing if: (1) The requested amount is greater than or equal to the "Human Approval Threshold" defined in the policy, or (2) The agent was configured with a Signer Weight of 2 or higher (which requires dual-control multisig authorization). Once an operator approves and signs via Freighter or their key, the transaction broadcasts immediately.',
    },
    {
      q: 'How does autonomous transaction broadcasting work on Stellar?',
      a: 'When an agent submits a payment request that passes all policy rules and falls below the approval threshold, GuardRail automatically: (1) Verifies the canonical payload hash, (2) Generates a single-use cryptographic permit, (3) Signs the transaction with the automated GuardRail co-signer key, and (4) Directly submits the signed envelope to the Stellar Testnet Horizon server without requiring any human clicks.',
    },
    {
      q: 'What is an Agent PDA and how do I manage its assets?',
      a: 'A PDA (Program-Derived Account) is an independent cryptographic Stellar keypair generated for each AI Agent. It isolates agent operations from your Master Treasury wallet. In AI Agents under "Manage ▾ -> Assets", you can inspect real-time on-chain balances (XLM, USDC, EURC), top up funds via Friendbot (+10,000 XLM) or wallet deposit, and transfer funds to yourself (refund to master wallet) or any external Stellar address.',
    },
    {
      q: 'Why is there a 2.0 XLM reserve held when refunding a PDA?',
      a: 'The Stellar network enforces a minimum base reserve (1 XLM for account activation plus additional reserves for subentries and trustlines). GuardRail automatically holds a 2.00 XLM buffer during PDA refunds or transfers to prevent the account from being deactivated or stranded on-chain.',
    },
    {
      q: 'How do I add co-signers and share invitation signup links?',
      a: 'Navigate to "Wallet Security". Under "Operator Signers", enter the assisting operator\'s Stellar wallet address and an optional alias, then click "Add Signer". You can then click "Copy Invitation Link" to share a personalized link (`/login?invite=...&role=OPERATOR`) that allows them to connect their wallet and assume their co-signing role.',
    },
    {
      q: 'How do rolling daily and weekly spending windows work?',
      a: 'Spending limits in GuardRail use dynamic rolling time windows, not rigid calendar days. The daily limit evaluates spending over the trailing 24 hours from the current UTC timestamp, while the weekly limit evaluates the trailing 7 days. When requests are rejected or expire, reserved budget is immediately released back to the wallet ledger.',
    },
  ];

  const codeSnippets = {
    curl: `curl -X POST https://api.guardrail.network/api/v1/coordinator/requests/ \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Key: agy_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -d '{
    "amount": "15.00",
    "asset": "XLM",
    "destination": "GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE",
    "memo": "Payment for API compute",
    "mock_stellar": false
  }'`,
    python: `import requests

url = "https://api.guardrail.network/api/v1/coordinator/requests/"
headers = {
    "Content-Type": "application/json",
    "X-Agent-Key": "agy_live_xxxxxxxxxxxxxxxxxxxxxxxx"
}
payload = {
    "amount": "15.00",
    "asset": "XLM",
    "destination": "GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE",
    "memo": "Payment for API compute",
    "mock_stellar": False
}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Data:", response.json())`,
    javascript: `const response = await fetch("https://api.guardrail.network/api/v1/coordinator/requests/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Agent-Key": "agy_live_xxxxxxxxxxxxxxxxxxxxxxxx"
  },
  body: JSON.stringify({
    amount: "15.00",
    asset: "XLM",
    destination: "GB54HQQPWRACHYXERO2JN7RBTMNREQMQ7B3XLRCVWPKZS3NXO7PN2BTE",
    memo: "Payment for API compute",
    mock_stellar: false
  })
});

const result = await response.json();
console.log(result);`,
  };

  const filteredFaqs = faqItems.filter(
    (item) =>
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 max-w-7xl mx-auto w-full font-manrope">
      {/* Hero / Header Section */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold font-space bg-emerald-400/10 text-emerald-300 border border-emerald-400/25 flex items-center gap-1.5 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                GuardRail User Guide & Documentation
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold font-mono bg-white/[0.04] text-white/50 border border-white/[0.08]">
                v3.2 (Stellar Sep-53)
              </span>
            </div>
            <h1 className="font-space text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              Console Help & Knowledge Base
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Complete guide to operating the GuardRail treasury console, supervising autonomous AI agents, enforcing cryptographic policies, and managing multi-signature Stellar transactions.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenSimulateModal && (
              <button
                onClick={onOpenSimulateModal}
                className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/35 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>Open Simulator</span>
              </button>
            )}
            <button
              onClick={() => navigate('/policies/create')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#09101A] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Create Policy</span>
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative mt-6">
          <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search guides, topics (e.g. multisig, autonomy, pda, api keys, limits, blacklists)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'console'
              ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.12]'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dashboard & Console</span>
        </button>

        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'agents'
              ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.12]'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-blue-400" />
          <span>AI Agents & PDAs</span>
        </button>

        <button
          onClick={() => setActiveTab('multisig')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'multisig'
              ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.12]'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-purple-400" />
          <span>Security & Multisig</span>
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'api'
              ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.12]'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Code className="w-3.5 h-3.5 text-amber-400" />
          <span>API & Integration</span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'faq'
              ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.12]'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>FAQs & Troubleshooting</span>
        </button>
      </div>

      {/* Tab 1: Dashboard Console Guide */}
      {activeTab === 'console' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          {/* Quick Flowchart Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-space font-bold text-xs">
                1
              </div>
              <h3 className="font-space font-bold text-white text-sm">Define Policy</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Configure daily/weekly spending budgets, per-tx ceiling, destination whitelists, and approved assets.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-space font-bold text-xs">
                2
              </div>
              <h3 className="font-space font-bold text-white text-sm">Deploy AI Agent</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Generate an agent with a dedicated PDA keypair, assign policy rules, and choose Autonomy Mode.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-space font-bold text-xs">
                3
              </div>
              <h3 className="font-space font-bold text-white text-sm">Policy Evaluation</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Agent submits payment requests via REST API. Engine validates budget, recipient whitelist, and limits.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-space font-bold text-xs">
                4
              </div>
              <h3 className="font-space font-bold text-white text-sm">Execution & Broadcast</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Autonomous transactions auto-broadcast on Stellar Testnet. High-value requests await operator co-signing.
              </p>
            </div>
          </div>

          {/* Detailed Console Page Guides */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Dashboard View */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-space font-bold text-white text-base">Main Dashboard</h4>
                  <span className="text-[11px] text-white/40">Real-time health & telemetry</span>
                </div>
              </div>
              <ul className="text-xs text-white/60 flex flex-col gap-2 list-disc list-inside">
                <li><strong className="text-white">Treasury Asset Selector:</strong> Switch between XLM, USDC, and EURC to view live balances and USD valuations.</li>
                <li><strong className="text-white">Active AI Agents:</strong> Real-time counter of registered agents governed by the coordinator.</li>
                <li><strong className="text-white">Pending Approvals:</strong> Instant alerts when a payment requires human co-signature.</li>
                <li><strong className="text-white">Spending This Week:</strong> Visual day-by-day progress tracker against your weekly budget ceiling.</li>
                <li><strong className="text-white">Quick Review:</strong> Directly approve or reject recent agent requests from the table.</li>
              </ul>
            </div>

            {/* Requests View */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-space font-bold text-white text-base">Requests Console</h4>
                  <span className="text-[11px] text-white/40">Transaction verification pipeline</span>
                </div>
              </div>
              <ul className="text-xs text-white/60 flex flex-col gap-2 list-disc list-inside">
                <li><strong className="text-white">State Badges:</strong> Easily filter by Pending, Approved, Executed, Blocked, or Rejected.</li>
                <li><strong className="text-white">Cryptographic Permits:</strong> Inspect single-use permit IDs and payload hashes.</li>
                <li><strong className="text-white">Policy Checklist:</strong> Detailed audit trail verifying limits, balances, and recipient status.</li>
                <li><strong className="text-white">Operator Co-Signing:</strong> Connect Freighter wallet to cryptographically sign pending transactions on-chain.</li>
              </ul>
            </div>

            {/* Policies View */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-space font-bold text-white text-base">Policy Configuration</h4>
                  <span className="text-[11px] text-white/40">Guardrail boundaries & limits</span>
                </div>
              </div>
              <ul className="text-xs text-white/60 flex flex-col gap-2 list-disc list-inside">
                <li><strong className="text-white">Budget Limits:</strong> Set maximum amount per tx, 24-hour daily budget, and 7-day weekly budget.</li>
                <li><strong className="text-white">Approval Threshold:</strong> Payments below threshold execute automatically; above threshold require approval.</li>
                <li><strong className="text-white">Whitelists & Blacklists:</strong> Explicitly restrict recipients to trusted addresses or block dangerous targets.</li>
                <li><strong className="text-white">Smart Contract Sync:</strong> Policies are written directly to Soroban smart contracts.</li>
              </ul>
            </div>

            {/* Wallet Security View */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-space font-bold text-white text-base">Wallet Security & Multisig</h4>
                  <span className="text-[11px] text-white/40">Cryptographic dual-control</span>
                </div>
              </div>
              <ul className="text-xs text-white/60 flex flex-col gap-2 list-disc list-inside">
                <li><strong className="text-white">Threshold Weights:</strong> Configure Low (1), Medium (2), and High (3) operation weights.</li>
                <li><strong className="text-white">Assisting Operators:</strong> Add co-signers and generate shareable onboarding invitation links.</li>
                <li><strong className="text-white">Dual-Control Audit:</strong> Protect treasury funds from being drained by any single compromised key.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: AI Agents & PDAs */}
      {activeTab === 'agents' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-4">
            <h3 className="font-space font-bold text-white text-lg">Understanding AI Agent Autonomy Modes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-space font-bold text-emerald-300 text-sm">AUTONOMOUS</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-bold">
                    Zero-Human Clicks
                  </span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Best for micro-payments, recurring compute costs, and high-frequency tasks. When a request complies with the active policy rules and is below the <span className="text-emerald-300 font-semibold">Human Approval Threshold</span>, it is automatically signed by GuardRail and broadcast directly to the Stellar network!
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-space font-bold text-amber-300 text-sm">HUMAN_APPROVAL_ALWAYS</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold">
                    Mandatory Co-Signature
                  </span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Best for high-value agents, experimental models, or sensitive payouts. Regardless of transaction size, every payment request is held in <span className="text-amber-300 font-semibold">PENDING_APPROVAL</span> until a human operator reviews and cryptographically co-signs it with Freighter.
                </p>
              </div>
            </div>
          </div>

          {/* PDA Asset Management Guide */}
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-space font-bold text-white text-lg">Agent Program-Derived Accounts (PDAs) & Assets</h3>
                <span className="text-xs text-white/50">Isolated cryptographic sub-accounts on Stellar Testnet</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1.5">
                <span className="font-semibold text-white">1. Live Holdings Breakdown</span>
                <p className="text-white/50 leading-relaxed">
                  Under <strong className="text-white">Manage ▾ &rarr; Assets</strong>, view live balances for XLM, USDC, EURC, and custom trustlines queried from Horizon.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1.5">
                <span className="font-semibold text-white">2. Instant Top-Up</span>
                <p className="text-white/50 leading-relaxed">
                  Top up with 1-click Friendbot (+10,000 XLM) for instant testnet gas, or deposit custom assets from your connected master wallet.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1.5">
                <span className="font-semibold text-white">3. Send to Self / Other</span>
                <p className="text-white/50 leading-relaxed">
                  Safely refund funds back to your master signup wallet, or transfer tokens to external recipients with automatic 2.0 XLM reserve protection.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Multisig */}
      {activeTab === 'multisig' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-4">
            <h3 className="font-space font-bold text-white text-lg">Multi-Signature Security Architecture</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              GuardRail implements native Stellar Ed25519 threshold multi-signature cryptography combined with Soroban smart contract verification.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-space font-bold text-white text-xs uppercase">Low Threshold</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">Weight: 1</span>
                </div>
                <p className="text-[11px] text-white/50">
                  Used for routine autonomous operations, bump sequence, and micro-payments below approval thresholds.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-space font-bold text-white text-xs uppercase">Medium Threshold</span>
                  <span className="font-mono text-amber-400 font-bold text-sm">Weight: 2</span>
                </div>
                <p className="text-[11px] text-white/50">
                  Required for payment execution, asset transfers, and high-value transactions. Enforces dual-control.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-space font-bold text-white text-xs uppercase">High Threshold</span>
                  <span className="font-mono text-purple-400 font-bold text-sm">Weight: 3</span>
                </div>
                <p className="text-[11px] text-white/50">
                  Required for altering account signers, modifying thresholds, or performing contract upgrades.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: API & Integration */}
      {activeTab === 'api' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-space font-bold text-white text-lg">Agent REST API Integration</h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Connect autonomous scripts, LangChain agents, or automated systems using HTTP headers.
                </p>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.08]">
                {(['curl', 'python', 'javascript'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setCodeLanguage(lang)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono uppercase font-semibold transition-all cursor-pointer ${
                      codeLanguage === lang ? 'bg-blue-600 text-white shadow-xs' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Block Container */}
            <div className="relative rounded-2xl bg-[#070B12] border border-white/[0.1] p-4 font-mono text-xs text-white/90 overflow-x-auto">
              <button
                onClick={() => copyToClipboard(codeSnippets[codeLanguage], 'code_block')}
                className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border border-white/[0.08] flex items-center gap-1.5 transition-all cursor-pointer text-[11px]"
              >
                {copiedSnippet === 'code_block' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <pre className="pr-16 leading-relaxed whitespace-pre overflow-x-auto">{codeSnippets[codeLanguage]}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: FAQs & Troubleshooting */}
      {activeTab === 'faq' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1">
            <h3 className="font-space font-bold text-white text-lg">Frequently Asked Questions</h3>
            <span className="text-xs text-white/40">{filteredFaqs.length} answers available</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all ${
                    isOpen
                      ? 'bg-white/[0.04] border-white/[0.14] shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.035]'
                  }`}
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full p-4.5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="font-space font-semibold text-sm text-white">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-white/50 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-emerald-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4.5 pb-4.5 text-xs text-white/60 leading-relaxed border-t border-white/[0.04] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
