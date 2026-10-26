import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { OperatorWalletState } from '../types';
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
  Sliders,
  Users,
  Coins,
  Fingerprint,
  CheckCheck,
  RefreshCw,
  LogOut,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { connectOfficialStellarWallet, openWalletProfileModal } from '../services/stellarWallet';

interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenOnboarding: () => void;
  onOpenAuthModal?: () => void;
  operatorWallet?: OperatorWalletState;
  setOperatorWallet?: React.Dispatch<React.SetStateAction<OperatorWalletState>>;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onOpenOnboarding,
  onOpenAuthModal,
  operatorWallet,
  setOperatorWallet,
}) => {
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedApi, setCopiedApi] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<number>(0);

  // Connect via Official Stellar Wallets Kit Modal
  const handleConnectStellarWallet = () => {
    if (onOpenAuthModal) {
      onOpenAuthModal();
    } else {
      navigate('/onboarding');
    }
  };

  const handleCopyApi = () => {
    navigator.clipboard.writeText(`curl -X POST https://api.guardrail.stellar/v1/requests \\
  -H "Authorization: Bearer gr_live_7f3k29xq" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id":"agt_7f3k29xq","destination":"GDQP3X7KMN2WRZ8YL4HBVT5JCEF9SA6UQ2NLKO7MXPG4RYW9TBJE","asset":"USDC","amount":"750.00"}'`);
    setCopiedApi(true);
    setTimeout(() => setCopiedApi(false), 2000);
  };

  const steps = [
    {
      num: '01',
      title: 'Agent request',
      subtitle: 'Proposes a payment',
      icon: Bot,
      detail: 'The AI agent signs an HTTPS proposal with its API key naming recipient, asset code, and exact amount. It holds 1 of 3 keys and cannot execute alone.',
    },
    {
      num: '02',
      title: 'Policy evaluation',
      subtitle: 'Checks every rule',
      icon: Sliders,
      detail: 'GuardRail evaluates the request against per-transaction caps, allowlists, asset issuers, and daily/weekly rolling spending ledgers.',
    },
    {
      num: '03',
      title: 'Permit generation',
      subtitle: 'Binds the exact payload',
      icon: FileCode,
      detail: 'A single-use, cryptographically hashed permit is minted, locking the payload hash. Any modification invalidates the permit instantly.',
    },
    {
      num: '04',
      title: 'Operator approval',
      subtitle: 'When policy requires it',
      icon: Fingerprint,
      detail: 'If the amount exceeds the human threshold (e.g. 500 USDC), notification is dispatched for your cryptographic operator signature.',
    },
    {
      num: '05',
      title: 'Multisig co-sign',
      subtitle: 'Collects required signatures',
      icon: Lock,
      detail: 'GuardRail attaches co-signer Key 2 to the permitted payload. Threshold 2-of-3 is met without exposing root custody.',
    },
    {
      num: '06',
      title: 'Stellar transaction',
      subtitle: 'Submits to the network',
      icon: Wallet,
      detail: 'The assembled transaction envelope is broadcast directly to Stellar Horizon nodes for immediate settlement.',
    },
    {
      num: '07',
      title: 'Verification',
      subtitle: 'Records the outcome',
      icon: CheckCheck,
      detail: 'Final ledger sequence, transaction hash, and immutable audit record are verifiable on Stellar Testnet Explorer.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#09101A] text-white selection:bg-[#4AC777]/30 selection:text-white flex flex-col font-manrope">
      {/* 40px Grid Background Overlay - Matches Figma Lines 10-26 & Lines 24-60 */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(43, 51, 64, 0.7) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(43, 51, 64, 0.7) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Navigation Bar - Figma Frame 1000001567 */}
      <nav className="sticky top-0 z-40 bg-[#09101A]/95 backdrop-blur-md border-b border-[rgba(43,51,64,0.7)]">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-24 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <Logo size="md" />
          </Link>

          {/* Nav Links - Frame 1000001566 */}
          <div className="hidden md:flex items-center gap-12 font-manrope font-medium text-base text-[#9099A5]">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#controls" className="hover:text-white transition-colors">Controls</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#api" className="hover:text-white transition-colors">API</a>
          </div>

          {/* Action Buttons - Frame 1000001531 */}
          <div className="flex items-center gap-4">
            {operatorWallet?.connected && operatorWallet?.ownershipVerified ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={openWalletProfileModal}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#202938] border border-[#2B3340] rounded-md text-xs font-space text-white hover:border-[#4AC777] transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-[#4AC777] animate-pulse" />
                  <span>{operatorWallet.username ? `@${operatorWallet.username}` : `${operatorWallet.address.slice(0, 5)}…${operatorWallet.address.slice(-4)}`}</span>
                  <span className="text-[#4AC777] font-semibold">{operatorWallet.balanceXlm || '100.00'} XLM</span>
                </button>
                <Link
                  to="/dashboard"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-md transition-all shadow-md active:scale-98"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#09101A]" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white hover:bg-slate-100 text-[#09101A] font-manrope font-bold text-sm rounded-md transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#09101A]" />
                  <span>Log In</span>
                </Link>
                <Link
                  to="/signup"
                  className="hidden sm:flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-md transition-all shadow-sm active:scale-98"
                >
                  <span>Sign Up</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#09101A]" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - Figma Frame 1000001569 & Group 8 */}
      <section className="relative z-10 pt-16 sm:pt-24 pb-20 sm:pb-32 px-6 sm:px-12 lg:px-24 max-w-[1440px] mx-auto w-full">
        <div className="max-w-[1020px] flex flex-col items-start gap-8">
          {/* Pill Normal - Figma Frame 1000001452 */}
          <div className="inline-flex items-center justify-center px-3 py-1 bg-[#202938] border-[1.5px] border-[#2B3340] rounded-full text-xs font-manrope text-[#9099A5] gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4AC777] animate-pulse" />
            <span>Stellar-native agent security · Soroban Smart Contract</span>
          </div>

          {/* Heading 1 - Figma: Space Grotesk 700 60px letter-spacing -0.02em #FFFFFF */}
          <h1 className="font-space font-bold text-4xl sm:text-6xl lg:text-[60px] leading-[1.15] tracking-[-0.02em] text-white max-w-[756px]">
            Give AI Agents Permission, Not Unlimited Control.
          </h1>

          {/* M|Body 2 - Figma: Manrope 400 24px line-height 150% #9099A5 */}
          <p className="font-manrope font-normal text-lg sm:text-2xl text-[#9099A5] leading-[1.5] max-w-[779px]">
            GuardRail sits between your AI agent and its wallet. Every transaction is checked against your policies — and nothing moves without a valid permit and the right signatures.
          </p>

          {/* Action Buttons - Frame 1000001568 */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            {/* Primary Action Button - Set up GuardRail */}
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-semibold text-sm rounded-[6px] transition-all shadow-lg shadow-[#4AC777]/15 active:scale-98"
            >
              <span>Set up GuardRail</span>
              <ArrowRight className="w-4 h-4 text-[#09101A]" />
            </Link>

            {/* Secondary Action Button - Sign In / Dashboard */}
            <Link
              to={operatorWallet?.connected && operatorWallet?.ownershipVerified ? '/dashboard' : '/login'}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#09101A] hover:bg-[#202938] border border-[#2B3340] text-[#EFF2F5] font-manrope font-bold text-sm rounded-[6px] transition-all active:scale-98"
            >
              <span>{operatorWallet?.connected && operatorWallet?.ownershipVerified ? 'Go to Dashboard' : 'Sign In to App'}</span>
            </Link>

            {/* Official Stellar Wallets Kit Button */}
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-[#9099A5] hover:text-white font-manrope font-medium text-xs rounded-[6px] transition-all cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5 text-[#4AC777]" />
              <span>Official Stellar Wallets Kit</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 01 / The control layer - Figma Frame 1000001578 */}
      <section id="how-it-works" className="relative z-10 py-20 px-6 sm:px-12 lg:px-24 max-w-[1440px] mx-auto w-full">
        {/* Frame 1000001571 Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
          {/* Frame 1000001570 */}
          <div className="flex flex-col gap-3">
            <span className="font-space font-medium text-base tracking-[-0.02em] text-[#4AC777]">
              01 / The control layer
            </span>
            <h2 className="font-space font-bold text-3xl sm:text-[32px] text-white tracking-[-0.02em]">
              How GuardRail works
            </h2>
          </div>
          {/* Subtitle */}
          <p className="font-manrope font-normal text-lg sm:text-[20px] text-[#9099A5] leading-[1.5] max-w-[592px]">
            Between an agent’s intent and your capital, there’s a checkpoint. Permission is earned on every transaction — never assumed.
          </p>
        </div>

        {/* Line 61 Border */}
        <div className="w-full h-0 border-t-[1.5px] border-[#2B3340] mb-12" />

        {/* 3 Step Cards - Frame 1000001576 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          {/* Card 01 - The agent proposes */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#202938] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                <Bot className="w-5 h-5 text-[#4AC777]" />
              </div>
              <span className="font-manrope font-medium text-base text-[#9099A5]">01</span>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-space font-bold text-xl text-white tracking-[-0.02em]">
                The agent proposes.
              </h3>
              <p className="font-manrope font-normal text-sm text-[#9099A5] leading-[1.5]">
                A payment request names the recipient, asset and amount. A request is not an authorization.
              </p>
            </div>
          </div>

          {/* Card 02 - GuardRail evaluates */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#202938] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                <Shield className="w-5 h-5 text-[#4AC777]" />
              </div>
              <span className="font-manrope font-medium text-base text-[#9099A5]">02</span>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-space font-bold text-xl text-white tracking-[-0.02em]">
                GuardRail evaluates.
              </h3>
              <p className="font-manrope font-normal text-sm text-[#9099A5] leading-[1.5]">
                Every policy must pass. An eligible request receives a permit bound to that exact transaction.
              </p>
            </div>
          </div>

          {/* Card 03 - The right keys authorize */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-[#202938] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                <Fingerprint className="w-5 h-5 text-[#4AC777]" />
              </div>
              <span className="font-manrope font-medium text-base text-[#9099A5]">03</span>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-space font-bold text-xl text-white tracking-[-0.02em]">
                The right keys authorize.
              </h3>
              <p className="font-manrope font-normal text-sm text-[#9099A5] leading-[1.5]">
                Required signers co-sign the permitted payload. Human approval adds a checkpoint when needed.
              </p>
            </div>
          </div>
        </div>

        {/* Line 62 Border */}
        <div className="w-full h-0 border-t-[1.5px] border-[#2B3340] mt-12" />
      </section>

      {/* 02 / Define the boundaries (Policy Controls) - Figma Frame 1000001583 */}
      <section id="controls" className="relative z-10 py-16 px-6 sm:px-12 lg:px-24 bg-[#202938] border-y-[1.5px] border-[#2B3340]">
        <div className="max-w-[1440px] mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
            <div className="flex flex-col gap-3">
              <span className="font-space font-medium text-base tracking-[-0.02em] text-[#4AC777]">
                02 / Define the boundaries
              </span>
              <h2 className="font-space font-bold text-3xl sm:text-[32px] text-white tracking-[-0.02em]">
                Supported policy controls
              </h2>
            </div>
            <Link
              to="/policies"
              className="inline-flex items-center gap-2 font-manrope font-medium text-base sm:text-[20px] text-[#9099A5] hover:text-white transition-colors"
            >
              <span>Explore Policies</span>
              <ArrowRight className="w-4 h-4 text-[#9099A5]" />
            </Link>
          </div>

          {/* 4 Cards Grid - Frame 1000001573, 1579, 1580, 1581 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* Control 01 - Transaction limits */}
            <div className="p-8 bg-[#1B2330] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#202938] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                  <Sliders className="w-5 h-5 text-[#4AC777]" />
                </div>
                <span className="font-manrope font-medium text-base text-[#9099A5]">01</span>
              </div>
              <h3 className="font-space font-bold text-2xl text-white tracking-[-0.02em]">
                Transaction limits
              </h3>
              <p className="font-manrope font-normal text-sm text-[#9099A5] leading-[1.5]">
                Define what your agent can spend. Cap individual payments and set daily and weekly budgets.
              </p>
              <div className="font-space font-medium text-base text-[#4AC777] tracking-[-0.02em] mt-2">
                Per transaction · Daily · Weekly
              </div>
            </div>

            {/* Control 02 - Approved recipients */}
            <div className="p-8 bg-[#1B2330] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#202938] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                  <Users className="w-5 h-5 text-[#4AC777]" />
                </div>
                <span className="font-manrope font-medium text-base text-[#9099A5]">02</span>
              </div>
              <h3 className="font-space font-bold text-2xl text-white tracking-[-0.02em]">
                Approved recipients
              </h3>
              <p className="font-manrope font-normal text-sm text-[#9099A5] leading-[1.5]">
                Keep funds on a known path. Only addresses on your allow-list can receive a payment.
              </p>
              <div className="font-space font-medium text-base text-[#4AC777] tracking-[-0.02em] mt-2">
                Explicit allow-list · No unknown destinations
              </div>
            </div>

            {/* Control 03 - Asset controls */}
            <div className="p-8 bg-[#1B2330] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#202938] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                  <Coins className="w-5 h-5 text-[#4AC777]" />
                </div>
                <span className="font-manrope font-medium text-base text-[#9099A5]">03</span>
              </div>
              <h3 className="font-space font-bold text-2xl text-white tracking-[-0.02em]">
                Asset controls
              </h3>
              <p className="font-manrope font-normal text-sm text-[#9099A5] leading-[1.5]">
                Choose the assets your agent can move, down to the specific Stellar asset and issuer.
              </p>
              <div className="font-space font-medium text-base text-[#4AC777] tracking-[-0.02em] mt-2">
                Asset code · Verified issuer
              </div>
            </div>

            {/* Control 04 - Human approval */}
            <div className="p-8 bg-[#1B2330] border border-[#2B3340] rounded-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#202938] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                  <Fingerprint className="w-5 h-5 text-[#4AC777]" />
                </div>
                <span className="font-manrope font-medium text-base text-[#9099A5]">04</span>
              </div>
              <h3 className="font-space font-bold text-2xl text-white tracking-[-0.02em]">
                Human approval
              </h3>
              <p className="font-manrope font-normal text-sm text-[#9099A5] leading-[1.5]">
                Stay in control of higher-value decisions. Payments above your threshold wait for your signature.
              </p>
              <div className="font-space font-medium text-base text-[#4AC777] tracking-[-0.02em] mt-2">
                Approval threshold · Operator co-sign
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 / Security by construction - Figma Frame 1000001596 */}
      <section id="security" className="relative z-10 py-20 px-6 sm:px-12 lg:px-24 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column - Frame 1000001585 */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <span className="font-space font-medium text-base tracking-[-0.02em] text-[#4AC777]">
              03 / Security by construction
            </span>
            <h2 className="font-space font-bold text-3xl sm:text-5xl text-white tracking-[-0.02em] leading-tight">
              One key is never enough.
            </h2>
            <p className="font-manrope font-normal text-base sm:text-lg text-[#9099A5] leading-[1.5]">
              The protected wallet requires 2 of 3 signatures. Your agent holds one key — so it cannot move funds alone.
            </p>
            <p className="font-manrope font-normal text-sm sm:text-base text-[#9099A5] leading-[1.5]">
              GuardRail co-signs only a transaction bound to a valid permit. You sign when the policy requires human approval, and retain a key for recovery.
            </p>

            {/* Shield Check banner */}
            <div className="inline-flex items-center gap-3 p-4 bg-[#202938] border border-[#2B3340] rounded-lg">
              <Shield className="w-6 h-6 text-[#4AC777] shrink-0" />
              <span className="font-space font-medium text-base text-[#4AC777] tracking-[-0.02em]">
                No valid permit. No GuardRail signature.
              </span>
            </div>
          </div>

          {/* Right Column - Frame 1000001595 (Threshold & Signers) */}
          <div className="lg:col-span-6 bg-[#202938] border-[1.5px] border-[#2B3340] rounded-xl p-6 sm:p-8 flex flex-col gap-6">
            {/* Header: Signature Threshold */}
            <div className="flex items-center justify-between pb-4 border-b border-[#2B3340]">
              <span className="font-space font-medium text-xs tracking-[-0.02em] text-[#9099A5] uppercase">
                SIGNATURE THRESHOLD
              </span>
              <span className="font-space font-bold text-2xl text-[#4AC777] tracking-[-0.04em]">
                2 of 3
              </span>
            </div>

            {/* Signer 1: Agent signer */}
            <div className="flex items-center justify-between p-4 bg-[#1B2330] border border-[#2B3340] rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-[#202938] border border-[#2B3340] flex items-center justify-center text-white">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-space font-bold text-base text-white tracking-[-0.02em]">
                    Agent signer
                  </div>
                  <div className="font-manrope text-xs text-[#9099A5]">
                    Proposes transactions
                  </div>
                </div>
              </div>
              <span className="font-space font-medium text-xs text-[#9099A5]">weight 1</span>
            </div>

            {/* Signer 2: GuardRail co-signer */}
            <div className="flex items-center justify-between p-4 bg-[#1B2330] border border-[#2B3340] rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-[#202938] border border-[#2B3340] flex items-center justify-center text-white">
                  <Shield className="w-5 h-5 text-[#4AC777]" />
                </div>
                <div>
                  <div className="font-space font-bold text-base text-white tracking-[-0.02em]">
                    GuardRail co-signer
                  </div>
                  <div className="font-manrope text-xs text-[#9099A5]">
                    Signs only permitted payloads
                  </div>
                </div>
              </div>
              <span className="font-space font-medium text-xs text-[#9099A5]">weight 1</span>
            </div>

            {/* Signer 3: Operator signer */}
            <div className="flex items-center justify-between p-4 bg-[#1B2330] border border-[#2B3340] rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-[#202938] border border-[#2B3340] flex items-center justify-center text-white">
                  <Fingerprint className="w-5 h-5 text-[#4AC777]" />
                </div>
                <div>
                  <div className="font-space font-bold text-base text-white tracking-[-0.02em]">
                    Operator signer
                  </div>
                  <div className="font-manrope text-xs text-[#9099A5]">
                    Human approval & recovery
                  </div>
                </div>
              </div>
              <span className="font-space font-medium text-xs text-[#9099A5]">weight 1</span>
            </div>
          </div>
        </div>
      </section>

      {/* 04 / From intent to settlement - Figma Frame 1000001611 */}
      <section className="relative z-10 py-16 px-6 sm:px-12 lg:px-24 bg-[#202938] border-y-[1.5px] border-[#2B3340]">
        <div className="max-w-[1440px] mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-3 mb-10">
            <span className="font-space font-medium text-base tracking-[-0.02em] text-[#4AC777]">
              04 / From intent to settlement
            </span>
            <h2 className="font-space font-bold text-3xl sm:text-[32px] text-white tracking-[-0.02em]">
              Every step. Every checkpoint.
            </h2>
            <p className="font-manrope font-normal text-base text-[#9099A5] leading-[1.5]">
              The agent transaction flow — with a verifiable outcome, not just a promise.
            </p>
          </div>

          {/* Line 67 */}
          <div className="w-full h-0 border-t border-[#2B3340] mb-8" />

          {/* 7-Step Horizontal Pipeline - Frame 1000001605 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {steps.map((st, idx) => {
              const IconComp = st.icon;
              return (
                <button
                  key={st.num}
                  onClick={() => setActiveStepTab(idx)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[146px] ${
                    activeStepTab === idx
                      ? 'bg-[#151D2A] border-[#4AC777] shadow-md shadow-[#4AC777]/10'
                      : 'bg-[#09101A] border-[#2B3340] hover:border-[#9099A5]/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-md bg-[#09101A] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="mt-3">
                    <div className="font-manrope font-medium text-xs text-[#9099A5]">{st.num}</div>
                    <div className="font-space font-bold text-sm text-white tracking-[-0.02em] mt-0.5">
                      {st.title}
                    </div>
                    <div className="font-manrope text-[11px] text-[#9099A5] mt-1 line-clamp-1">
                      {st.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Detail Card */}
          <div className="p-6 bg-[#09101A] border border-[#2B3340] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-start gap-4">
              <span className="font-space font-bold text-3xl text-[#4AC777]">
                {steps[activeStepTab].num}
              </span>
              <div>
                <h4 className="font-space font-bold text-lg text-white">
                  {steps[activeStepTab].title} — {steps[activeStepTab].subtitle}
                </h4>
                <p className="font-manrope text-sm text-[#9099A5] mt-1 max-w-3xl">
                  {steps[activeStepTab].detail}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => setActiveStepTab((prev) => (prev + 1) % steps.length)}
                className="px-3.5 py-1.5 bg-[#202938] hover:bg-[#2B3340] border border-[#2B3340] text-xs font-semibold text-white rounded transition-colors"
              >
                Next Step
              </button>
            </div>
          </div>

          {/* Line 68 */}
          <div className="w-full h-0 border-t border-[#2B3340] mb-6" />

          {/* Failed Check Alert - Frame 1000001607 */}
          <div className="flex items-center gap-3 text-sm text-[#ED4A49]">
            <XCircle className="w-5 h-5 shrink-0 text-[#ED4A49]" />
            <span className="font-manrope font-normal text-sm text-[#ED4A49]">
              A failed policy check stops the request before a permit is issued.
            </span>
          </div>
        </div>
      </section>

      {/* 05 / Built for agents (Developer API Preview) - Figma Frame 1000001624 */}
      <section id="api" className="relative z-10 py-20 px-6 sm:px-12 lg:px-24 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column - Frame 1000001610 */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <span className="font-space font-medium text-base tracking-[-0.02em] text-[#4AC777]">
              05 / Built for agents
            </span>
            <h2 className="font-space font-bold text-3xl sm:text-[32px] text-white tracking-[-0.02em]">
              Developer API preview
            </h2>
            <p className="font-manrope font-normal text-base text-[#9099A5] leading-[1.5]">
              One request. A clear decision. Your agent submits intent; GuardRail handles policy evaluation and the approval path.
            </p>

            {/* Checklist items - Frame 1000001615 */}
            <div className="flex flex-col gap-3 font-manrope text-base text-[#9099A5]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#4AC777] shrink-0" />
                <span>Explicit recipient, asset and amount</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#4AC777] shrink-0" />
                <span>A traceable request identifier</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#4AC777] shrink-0" />
                <span>Policy-aware approval decisions</span>
              </div>
            </div>

            {/* Warning Pill */}
            <div className="font-space font-medium text-base text-[#F2B036] tracking-[-0.02em] mt-2">
              Illustrative API · Testnet MVP
            </div>
          </div>

          {/* Right Column - Figma Frame 1000001623 (Request & Response) */}
          <div className="lg:col-span-7 flex flex-col rounded-xl overflow-hidden border-[1.5px] border-[#2B3340]">
            {/* Request Block - Frame 1000001622 */}
            <div className="p-6 bg-[#202938] font-space text-sm leading-relaxed border-b border-[#2B3340]">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2B3340]">
                <div className="flex items-center gap-2 text-[#4AC777]">
                  <Terminal className="w-4 h-4" />
                  <span className="font-space font-normal text-sm text-[#4AC777]">POST /v1/requests</span>
                </div>
                <button
                  onClick={handleCopyApi}
                  className="text-xs text-[#9099A5] hover:text-white transition-colors"
                >
                  {copiedApi ? 'Copied curl' : 'Copy request'}
                </button>
              </div>

              <div className="font-space font-medium text-sm text-white mb-1">
                Authorization: Bearer gr_live_7f3k…
              </div>
              <div className="font-space font-medium text-sm text-white mb-4">
                Content-Type: application/json
              </div>

              {/* Payload JSON */}
              <div className="font-mono text-sm text-white bg-[#09101A] p-4 rounded-lg border border-[#2B3340]">
                <div>{'{'}</div>
                <div className="pl-4"><span className="text-[#9099A5]">"agent_id":</span> <span className="text-white">"agt_7f3k29xq"</span>,</div>
                <div className="pl-4"><span className="text-[#9099A5]">"destination":</span> <span className="text-white">"GDQP3…TBJE"</span>,</div>
                <div className="pl-4"><span className="text-[#9099A5]">"asset":</span> <span className="text-white">"USDC"</span>,</div>
                <div className="pl-4"><span className="text-[#9099A5]">"amount":</span> <span className="text-white">"750.00"</span></div>
                <div>{'}'}</div>
              </div>
            </div>

            {/* Response Block - Frame 1000001621 */}
            <div className="p-6 bg-[rgba(74,199,119,0.15)] font-mono text-sm text-[#EFF2F5]">
              <div className="font-space font-medium text-sm text-[#4AC777] mb-2 tracking-[-0.02em]">
                202 ACCEPTED
              </div>
              <div className="font-mono text-xs sm:text-sm text-[#9099A5]">
                <div>{'{'}</div>
                <div className="pl-4"><span className="text-[#9099A5]">"request_id":</span> <span className="text-[#9099A5]">"REQ-1042"</span>,</div>
                <div className="pl-4"><span className="text-[#9099A5]">"decision":</span> <span className="text-[#9099A5]">"pending_approval"</span></div>
                <div>{'}'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner - Figma Frame 1000001626 */}
      <section className="relative z-10 py-16 px-6 sm:px-12 lg:px-24 border-t border-[#2B3340] bg-[#09101A]">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="font-space font-bold text-3xl sm:text-[32px] text-white tracking-[-0.02em]">
              Put boundaries around possibility.
            </h2>
            <p className="font-manrope font-normal text-base text-[#9099A5] leading-[1.5]">
              Give your agent room to operate. Keep your capital under control.
            </p>
          </div>

          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-[6px] transition-all shadow-md active:scale-98 shrink-0"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 text-[#09101A]" />
          </Link>
        </div>
      </section>

      {/* Footer - Figma Frame 1000001631 */}
      <footer className="relative z-10 mt-auto py-10 px-6 sm:px-12 lg:px-24 border-t border-[#2B3340] bg-[#09101A] text-xs text-[#9099A5]">
        <div className="max-w-[1440px] mx-auto flex flex-col gap-8">
          {/* Top row: Logo & Links */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-3">
              <Logo size="md" />
            </Link>

            <div className="flex items-center gap-8 font-manrope font-medium text-sm text-[#9099A5]">
              <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
              <a href="#controls" className="hover:text-white transition-colors">Controls</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
              <a href="#api" className="hover:text-white transition-colors">API</a>
            </div>
          </div>

          {/* Line 72 */}
          <div className="w-full h-0 border-t border-[#2B3340]" />

          {/* Bottom row: Copyright & Stellar Testnet Indicator */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-space text-xs">
            <div className="font-bold text-[#9099A5]">
              © 2026 GuardRail
            </div>
            <div className="flex items-center gap-2 text-[#9099A5] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F2B036]" />
              <span>Stellar Testnet MVP · Simulated transactions</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
