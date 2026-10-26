import React, { useState } from 'react';
import { TabView } from '../types';
import { Logo } from './Logo';
import {
  ArrowRight,
  Shield,
  Bot,
  Key,
  Lock,
  Wallet,
  CheckCircle2,
  XCircle,
  FileCode,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Sliders,
  Users,
  Coins,
  Fingerprint,
  CheckCheck
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenOnboarding: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp, onOpenOnboarding }) => {
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [copiedApi, setCopiedApi] = useState<boolean>(false);

  const steps = [
    {
      num: '01',
      title: 'Agent request',
      desc: 'Proposes a payment',
      detail: 'The AI agent signs an HTTPS request with its API key specifying recipient address, asset code, issuer, and exact amount.',
    },
    {
      num: '02',
      title: 'Policy evaluation',
      desc: 'Checks every rule',
      detail: 'GuardRail validates the proposed transaction against limits, allow-lists, issuer registries, and rolling budgets.',
    },
    {
      num: '03',
      title: 'Permit generation',
      desc: 'Binds exact payload',
      detail: 'If checks pass, GuardRail generates an immutable permit containing the cryptographic SHA-256 hash of the exact payload.',
    },
    {
      num: '04',
      title: 'Operator approval',
      desc: 'When policy requires',
      detail: 'If amount exceeds the human threshold (e.g. 500 USDC), notification is dispatched for your cryptographic operator signature.',
    },
    {
      num: '05',
      title: 'Multisig co-sign',
      desc: 'Collects signatures',
      detail: 'Once requirements are satisfied, GuardRail automatically applies its co-signature (Key 2 of 3) to the transaction.',
    },
    {
      num: '06',
      title: 'Stellar transaction',
      desc: 'Submits to network',
      detail: 'The fully assembled transaction with 2 valid signatures is broadcast directly to Stellar Horizon nodes.',
    },
    {
      num: '07',
      title: 'Verification',
      desc: 'Records the outcome',
      detail: 'Ledger confirmation and transaction hash are permanently archived in the immutable audit log and verifiable on-chain.',
    },
  ];

  const handleCopyApi = () => {
    navigator.clipboard.writeText(`curl -X POST https://api.guardrail.stellar/v1/requests \\
  -H "Authorization: Bearer gr_live_7f3k9921b7x" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id":"agt_7f3k29xq","destination":"GDQP3X7KMN2WRZ8YL4HBVT5JCEF9SA6UQ2NLKO7MXPG4RYW9TBJE","asset":"USDC","amount":"750.00"}'`);
    setCopiedApi(true);
    setTimeout(() => setCopiedApi(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#09101A] text-white selection:bg-[#4AC777]/30 selection:text-white flex flex-col font-manrope">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-[#09101A]/90 backdrop-blur-md border-b border-[#2B3340]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Logo size="md" />

          {/* Navigation links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#9099A5]">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#controls" className="hover:text-white transition-colors">Controls</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#api" className="hover:text-white transition-colors">API</a>
          </div>

          {/* Right Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenOnboarding}
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-[#EFF2F5] hover:text-white bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] rounded-md transition-colors"
            >
              Setup Guide
            </button>
            <button
              onClick={onLaunchApp}
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-[#09101A] bg-white hover:bg-slate-100 rounded-md transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <span>Launch App</span>
              <ArrowRight className="w-4 h-4 text-[#09101A]" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(rgba(74, 199, 119, 0.15) 1px, transparent 1px), linear-gradient(to right, rgba(43, 51, 64, 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(43, 51, 64, 0.4) 1px, transparent 1px)`,
            backgroundSize: '40px 40px, 40px 40px, 40px 40px',
          }}
        />

        <div className="relative max-w-5xl mx-auto flex flex-col items-start gap-6 sm:gap-8">
          {/* Badge Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#202938] border border-[#2B3340] rounded-full text-xs text-[#9099A5]">
            <span className="w-2 h-2 rounded-full bg-[#4AC777] animate-pulse" />
            <span className="font-space tracking-tight">Stellar Testnet MVP · 2-of-3 Multisig</span>
          </div>

          {/* Big Headline */}
          <h1 className="font-space font-bold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white leading-[1.1] max-w-4xl">
            Give AI Agents Permission, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#EFF2F5] to-[#4AC777]">Not Unlimited Control.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-2xl text-[#9099A5] leading-relaxed max-w-3xl">
            GuardRail sits between your AI agent and its wallet. Every transaction is checked against your policies — and nothing moves without a valid permit and the right signatures.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onLaunchApp}
              className="flex items-center gap-2.5 px-6 py-3.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-bold text-sm sm:text-base rounded-lg transition-all shadow-lg shadow-[#4AC777]/20 active:scale-98 cursor-pointer"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-4 h-4 text-[#09101A]" />
            </button>

            <button
              onClick={onOpenOnboarding}
              className="flex items-center gap-2 px-5 py-3.5 bg-[#09101A] hover:bg-[#202938] border border-[#2B3340] text-[#EFF2F5] font-semibold text-sm sm:text-base rounded-lg transition-colors cursor-pointer"
            >
              <span>Setup Wizard (3 Steps)</span>
            </button>
          </div>

          {/* Live Preview Strip */}
          <div className="w-full mt-10 p-4 sm:p-6 bg-[#202938]/70 border border-[#2B3340] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#4AC777]" />
              <div className="text-xs sm:text-sm font-space">
                <span className="text-[#9099A5]">Controlled Wallet: </span>
                <span className="text-white font-mono">GCTR4L9WQ...MJ5BHRA</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-[#9099A5] font-space">
              <div>THRESHOLD: <span className="text-[#4AC777] font-bold">2 of 3</span></div>
              <div>AGENT KEYS: <span className="text-white font-bold">1 (Weight 1)</span></div>
              <div>POLICY VERSION: <span className="text-white font-bold">v3</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 01 / The Control Layer */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#2B3340]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span className="font-space text-sm font-semibold text-[#4AC777] tracking-wider uppercase">
                01 / The control layer
              </span>
              <h2 className="font-space text-3xl sm:text-4xl font-bold text-white mt-2">
                How GuardRail works
              </h2>
            </div>
            <p className="text-[#9099A5] max-w-xl text-base sm:text-lg">
              Between an agent’s intent and your capital, there’s a checkpoint. Permission is earned on every transaction — never assumed.
            </p>
          </div>

          {/* 3 Step Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-[#09101A] border border-[#2B3340] rounded-lg">
                  <Bot className="w-6 h-6 text-[#4AC777]" />
                </div>
                <span className="font-space text-2xl font-bold text-[#9099A5]/60">01</span>
              </div>
              <div>
                <h3 className="font-space text-xl font-bold text-white mb-2">
                  The agent proposes.
                </h3>
                <p className="text-[#9099A5] text-sm leading-relaxed">
                  A payment request names the recipient, asset, and amount. A request is strictly intent, never direct execution authority.
                </p>
              </div>
            </div>

            <div className="p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-[#09101A] border border-[#2B3340] rounded-lg">
                  <Shield className="w-6 h-6 text-[#4AC777]" />
                </div>
                <span className="font-space text-2xl font-bold text-[#9099A5]/60">02</span>
              </div>
              <div>
                <h3 className="font-space text-xl font-bold text-white mb-2">
                  GuardRail evaluates.
                </h3>
                <p className="text-[#9099A5] text-sm leading-relaxed">
                  Every policy must pass. An eligible request receives a cryptographic permit bound to the exact payload hash.
                </p>
              </div>
            </div>

            <div className="p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-[#09101A] border border-[#2B3340] rounded-lg">
                  <Key className="w-6 h-6 text-[#4AC777]" />
                </div>
                <span className="font-space text-2xl font-bold text-[#9099A5]/60">03</span>
              </div>
              <div>
                <h3 className="font-space text-xl font-bold text-white mb-2">
                  The right keys authorize.
                </h3>
                <p className="text-[#9099A5] text-sm leading-relaxed">
                  Required signers co-sign the permitted payload. Human approval adds a checkpoint whenever higher-value limits require it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 / Define the boundaries (Policy Controls) */}
      <section id="controls" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#1D2430]/40 border-t border-[#2B3340]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span className="font-space text-sm font-semibold text-[#4AC777] tracking-wider uppercase">
                02 / Define the boundaries
              </span>
              <h2 className="font-space text-3xl sm:text-4xl font-bold text-white mt-2">
                Supported policy controls
              </h2>
            </div>
            <button
              onClick={onLaunchApp}
              className="text-[#9099A5] hover:text-[#4AC777] text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Configure your policies</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Quadrants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-[#09101A] border border-[#2B3340] rounded-lg text-[#4AC777]">
                  <Sliders className="w-6 h-6" />
                </div>
                <span className="font-space text-xs font-semibold px-2.5 py-1 bg-[#4AC777]/10 text-[#4AC777] rounded">
                  Per transaction · Daily · Weekly
                </span>
              </div>
              <h3 className="font-space text-2xl font-bold text-white">
                Transaction limits
              </h3>
              <p className="text-[#9099A5] text-sm leading-relaxed">
                Define what your agent can spend. Cap individual payments (e.g. 1,000 USDC) and set hard daily (5,000 USDC) and rolling 7-day budgets.
              </p>
            </div>

            <div className="p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-[#09101A] border border-[#2B3340] rounded-lg text-[#4AC777]">
                  <Users className="w-6 h-6" />
                </div>
                <span className="font-space text-xs font-semibold px-2.5 py-1 bg-[#4AC777]/10 text-[#4AC777] rounded">
                  Explicit allow-list
                </span>
              </div>
              <h3 className="font-space text-2xl font-bold text-white">
                Approved recipients
              </h3>
              <p className="text-[#9099A5] text-sm leading-relaxed">
                Keep funds on a verified path. Only addresses registered on your explicit allow-list can receive funds. All unlisted destinations are immediately blocked.
              </p>
            </div>

            <div className="p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-[#09101A] border border-[#2B3340] rounded-lg text-[#4AC777]">
                  <Coins className="w-6 h-6" />
                </div>
                <span className="font-space text-xs font-semibold px-2.5 py-1 bg-[#4AC777]/10 text-[#4AC777] rounded">
                  Asset code · Verified issuer
                </span>
              </div>
              <h3 className="font-space text-2xl font-bold text-white">
                Asset controls
              </h3>
              <p className="text-[#9099A5] text-sm leading-relaxed">
                Choose the assets your agent can move, down to the specific Stellar asset code and trusted issuer address (e.g., official Centre USDC or native XLM).
              </p>
            </div>

            <div className="p-8 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-[#09101A] border border-[#2B3340] rounded-lg text-[#4AC777]">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <span className="font-space text-xs font-semibold px-2.5 py-1 bg-[#4AC777]/10 text-[#4AC777] rounded">
                  Approval threshold · Operator co-sign
                </span>
              </div>
              <h3 className="font-space text-2xl font-bold text-white">
                Human approval
              </h3>
              <p className="text-[#9099A5] text-sm leading-relaxed">
                Stay in control of higher-value decisions. Payments above your threshold (e.g. 500 USDC) pause automatically and await your cryptographic signature.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 03 / Security by construction (Multisig) */}
      <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#2B3340]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <span className="font-space text-sm font-semibold text-[#4AC777] tracking-wider uppercase">
              03 / Security by construction
            </span>
            <h2 className="font-space text-3xl sm:text-5xl font-bold text-white leading-tight">
              One key is never enough.
            </h2>
            <p className="text-[#9099A5] text-base leading-relaxed">
              The protected wallet requires 2 of 3 signatures. Your agent holds one key — so it cannot move funds alone.
            </p>
            <p className="text-[#9099A5] text-sm leading-relaxed">
              GuardRail co-signs only a transaction bound to a valid permit. You sign when the policy requires human approval, and retain an independent key for full fund recovery.
            </p>
            
            <div className="p-4 bg-[#202938] border border-[#4AC777]/30 rounded-lg flex items-center gap-3">
              <Shield className="w-6 h-6 text-[#4AC777] shrink-0" />
              <div className="text-xs sm:text-sm text-[#4AC777] font-semibold font-space">
                No valid permit. No GuardRail signature.
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#202938] border border-[#2B3340] rounded-xl p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#2B3340]">
              <span className="font-space text-xs font-semibold text-[#9099A5] uppercase tracking-wider">
                SIGNATURE THRESHOLD
              </span>
              <span className="font-space text-xl font-bold text-[#4AC777]">
                2 of 3
              </span>
            </div>

            {/* Signer 1 */}
            <div className="flex items-center justify-between p-3.5 bg-[#09101A] border border-[#2B3340] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-[#202938] flex items-center justify-center text-white border border-[#2B3340]">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-space text-sm font-bold text-white">Agent signer</div>
                  <div className="text-xs text-[#9099A5]">Proposes transactions. Cannot move funds alone.</div>
                </div>
              </div>
              <span className="font-space text-xs text-[#9099A5] font-semibold">weight 1</span>
            </div>

            {/* Signer 2 */}
            <div className="flex items-center justify-between p-3.5 bg-[#09101A] border border-[#2B3340] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-[#202938] flex items-center justify-center text-white border border-[#2B3340]">
                  <Shield className="w-4 h-4 text-[#4AC777]" />
                </div>
                <div>
                  <div className="font-space text-sm font-bold text-white">GuardRail co-signer</div>
                  <div className="text-xs text-[#9099A5]">Signs only payloads bound to a valid permit.</div>
                </div>
              </div>
              <span className="font-space text-xs text-[#9099A5] font-semibold">weight 1</span>
            </div>

            {/* Signer 3 */}
            <div className="flex items-center justify-between p-3.5 bg-[#09101A] border border-[#2B3340] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-[#202938] flex items-center justify-center text-white border border-[#2B3340]">
                  <Key className="w-4 h-4 text-[#F2B036]" />
                </div>
                <div>
                  <div className="font-space text-sm font-bold text-white">Operator signer</div>
                  <div className="text-xs text-[#9099A5]">Your key. Approves high-value payments & recovery.</div>
                </div>
              </div>
              <span className="font-space text-xs text-[#9099A5] font-semibold">weight 1</span>
            </div>
          </div>
        </div>
      </section>

      {/* 04 / From Intent to Settlement (Interactive Pipeline) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#1D2430]/30 border-t border-[#2B3340]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <span className="font-space text-sm font-semibold text-[#4AC777] tracking-wider uppercase">
              04 / From intent to settlement
            </span>
            <h2 className="font-space text-3xl sm:text-4xl font-bold text-white mt-2">
              Every step. Every checkpoint.
            </h2>
            <p className="text-[#9099A5] text-sm sm:text-base mt-2">
              The agent transaction flow — with a verifiable outcome, not just a promise.
            </p>
          </div>

          {/* Interactive Steps Horizontal Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {steps.map((st, idx) => (
              <button
                key={st.num}
                onClick={() => setSelectedStep(idx)}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedStep === idx
                    ? 'bg-[#202938] border-[#4AC777] shadow-sm'
                    : 'bg-[#09101A] border-[#2B3340] hover:border-[#9099A5]/50'
                }`}
              >
                <div className="font-space text-xs font-bold text-[#9099A5] mb-1">{st.num}</div>
                <div className={`font-space text-xs font-bold truncate ${selectedStep === idx ? 'text-[#4AC777]' : 'text-white'}`}>
                  {st.title}
                </div>
                <div className="text-[11px] text-[#9099A5] truncate mt-0.5">{st.desc}</div>
              </button>
            ))}
          </div>

          {/* Active Step Explainer Card */}
          <div className="p-6 bg-[#202938] border border-[#2B3340] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="font-space text-3xl font-bold text-[#4AC777]">
                {steps[selectedStep].num}
              </span>
              <div>
                <h4 className="font-space text-lg font-bold text-white">
                  {steps[selectedStep].title}
                </h4>
                <p className="text-sm text-[#9099A5] mt-1">
                  {steps[selectedStep].detail}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs text-[#9099A5]">Step {selectedStep + 1} of 7</span>
              <button
                onClick={() => setSelectedStep((prev) => (prev + 1) % steps.length)}
                className="px-3 py-1.5 bg-[#09101A] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-white rounded transition-colors"
              >
                Next Step
              </button>
            </div>
          </div>

          {/* Error Circuit Note */}
          <div className="mt-4 flex items-center gap-2 text-xs text-[#ED4A49]">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>A failed policy check stops the request before a permit is ever issued.</span>
          </div>
        </div>
      </section>

      {/* 05 / Built for agents (Developer API Preview) */}
      <section id="api" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#2B3340]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <span className="font-space text-sm font-semibold text-[#4AC777] tracking-wider uppercase">
              05 / Built for agents
            </span>
            <h2 className="font-space text-3xl sm:text-4xl font-bold text-white">
              Developer API preview
            </h2>
            <p className="text-[#9099A5] text-base leading-relaxed">
              One request. A clear decision. Your agent submits intent; GuardRail handles policy evaluation, cryptographic permit binding, and the approval path.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-[#EFF2F5]">
                <CheckCircle2 className="w-4 h-4 text-[#4AC777]" />
                <span>Explicit recipient, asset and amount</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#EFF2F5]">
                <CheckCircle2 className="w-4 h-4 text-[#4AC777]" />
                <span>A traceable request identifier (REQ-xxxx)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#EFF2F5]">
                <CheckCircle2 className="w-4 h-4 text-[#4AC777]" />
                <span>Policy-aware approval decisions with verifiable hash</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F2B036]/10 text-[#F2B036] rounded text-xs font-space font-medium border border-[#F2B036]/20 self-start">
              Illustrative API · Testnet MVP
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col rounded-xl border border-[#2B3340] overflow-hidden bg-[#202938]">
            {/* Header bar */}
            <div className="px-4 py-3 bg-[#131C2A] border-b border-[#2B3340] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#4AC777]" />
                <span className="font-mono text-xs text-[#4AC777] font-semibold">POST /v1/requests</span>
              </div>
              <button
                onClick={handleCopyApi}
                className="text-xs text-[#9099A5] hover:text-white flex items-center gap-1 font-space transition-colors"
              >
                <span>{copiedApi ? 'Copied curl' : 'Copy curl'}</span>
              </button>
            </div>

            {/* Code request payload */}
            <div className="p-4 sm:p-6 font-mono text-xs text-slate-200 leading-relaxed bg-[#09101A] overflow-x-auto">
              <div className="text-[#9099A5]">// Request Headers</div>
              <div className="text-emerald-400">Authorization: Bearer gr_live_7f3k••••••••••••</div>
              <div className="text-emerald-400">Content-Type: application/json</div>
              <div className="my-2 border-t border-[#2B3340]/60" />
              <div>{'{'}</div>
              <div className="pl-4"><span className="text-[#9099A5]">"agent_id":</span> <span className="text-amber-300">"agt_7f3k29xq"</span>,</div>
              <div className="pl-4"><span className="text-[#9099A5]">"destination":</span> <span className="text-amber-300">"GDQP3X7KMN2WRZ8YL4HBVT5JCEF9SA6UQ2NLKO7MXPG4RYW9TBJE"</span>,</div>
              <div className="pl-4"><span className="text-[#9099A5]">"asset":</span> <span className="text-amber-300">"USDC"</span>,</div>
              <div className="pl-4"><span className="text-[#9099A5]">"amount":</span> <span className="text-cyan-300">"750.00"</span></div>
              <div>{'}'}</div>
            </div>

            {/* Response preview */}
            <div className="p-4 sm:p-6 border-t border-[#2B3340] bg-[#4AC777]/10 font-mono text-xs text-white">
              <div className="flex items-center justify-between text-[#4AC777] font-bold mb-2">
                <span>202 ACCEPTED</span>
                <span className="text-[11px] text-[#9099A5]">~42ms</span>
              </div>
              <div className="text-[#9099A5]">{'{'}</div>
              <div className="pl-4"><span className="text-[#9099A5]">"request_id":</span> <span className="text-[#EFF2F5]">"REQ-1042"</span>,</div>
              <div className="pl-4"><span className="text-[#9099A5]">"decision":</span> <span className="text-[#F2B036]">"pending_approval"</span>,</div>
              <div className="pl-4"><span className="text-[#9099A5]">"permit_id":</span> <span className="text-[#EFF2F5]">"prm_req-1042_8c41e2"</span>,</div>
              <div className="pl-4"><span className="text-[#9099A5]">"payload_hash":</span> <span className="text-[#4AC777]">"9f2c7a41...4e3c5"</span></div>
              <div className="text-[#9099A5]">{'}'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Put Boundaries Around Possibility (Bottom CTA) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-[#2B3340] bg-[#202938]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <h2 className="font-space text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Put boundaries around possibility.
            </h2>
            <p className="text-base sm:text-lg text-[#9099A5] mt-2">
              Give your agent room to operate. Keep your capital under control.
            </p>
          </div>
          <button
            onClick={onLaunchApp}
            className="flex items-center gap-2.5 px-6 py-3.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-bold rounded-lg transition-all shadow-md active:scale-98 cursor-pointer shrink-0"
          >
            <span>Launch GuardRail</span>
            <ArrowRight className="w-4 h-4 text-[#09101A]" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-10 px-4 sm:px-6 lg:px-8 border-t border-[#2B3340] bg-[#09101A] text-xs text-[#9099A5]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Logo size="sm" />
          <div className="flex items-center gap-6 font-medium">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#controls" className="hover:text-white transition-colors">Controls</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#api" className="hover:text-white transition-colors">API</a>
          </div>
          <div className="flex items-center gap-3">
            <span>© 2026 GuardRail</span>
            <span>·</span>
            <span className="text-[#F2B036]">Stellar Testnet MVP</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
