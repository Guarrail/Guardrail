import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { OperatorWalletState, ControlledWalletState } from '../types';
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Shield,
  Fingerprint,
  RefreshCw,
  User,
  Key,
  Bot,
  Copy,
  Check,
  Sparkles,
  Sliders,
  CheckCheck,
} from 'lucide-react';
import {
  connectOfficialStellarWallet,
  signChallengeWithWallet,
  openWalletProfileModal,
} from '../services/stellarWallet';
import { api } from '../services/api';

interface OnboardingViewProps {
  operatorWallet: OperatorWalletState;
  setOperatorWallet: React.Dispatch<React.SetStateAction<OperatorWalletState>>;
  controlledWallet: ControlledWalletState;
  setControlledWallet: React.Dispatch<React.SetStateAction<ControlledWalletState>>;
  onComplete?: () => void;
  onExit?: () => void;
}

const STEPS = [
  { id: 1, label: 'Wallet', title: 'Connect Wallet', icon: Wallet },
  { id: 2, label: 'Profile', title: 'Operator Handle', icon: User },
  { id: 3, label: 'Verify', title: 'SEP-10 Proof', icon: Fingerprint },
  { id: 4, label: 'Vault', title: 'Protected Vault', icon: Shield },
  { id: 5, label: 'Ready', title: 'Active', icon: CheckCircle2 },
];

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  operatorWallet,
  setOperatorWallet,
  controlledWallet,
  setControlledWallet,
  onComplete,
  onExit,
}) => {
  const navigate = useNavigate();

  // Determine initial step based on wallet state
  const getInitialStep = (): 1 | 2 | 3 | 4 | 5 => {
    if (!operatorWallet.connected) return 1;
    if (!operatorWallet.username) return 2;
    if (!operatorWallet.ownershipVerified) return 3;
    if (!controlledWallet.address || controlledWallet.address.length !== 56) return 4;
    return 5;
  };

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(getInitialStep());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isRegisteringContract, setIsRegisteringContract] = useState(false);
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Profile Form State
  const [usernameInput, setUsernameInput] = useState(operatorWallet.username || '');
  const [displayNameInput, setDisplayNameInput] = useState(operatorWallet.displayName || '');
  const [roleInput, setRoleInput] = useState<'Treasury Operator' | 'Security Admin' | 'DevOps & AI Lead'>(
    (operatorWallet.role as any) || 'Treasury Operator'
  );

  // Controlled Wallet Input: ensure empty or valid 56-char address
  const [controlledInput, setControlledInput] = useState(
    controlledWallet.address && controlledWallet.address.length === 56 && controlledWallet.address.startsWith('G')
      ? controlledWallet.address
      : ''
  );

  // Auto-fetch fresh valid vault address on mount if not set
  useEffect(() => {
    if (!controlledInput) {
      api
        .generateVaultAddress()
        .then((res) => {
          if (res?.address) {
            setControlledInput(res.address);
          }
        })
        .catch((err) => {
          console.warn('Could not auto-generate vault address:', err);
        });
    }
  }, []);

  // Sync profile inputs if wallet state updates
  useEffect(() => {
    if (operatorWallet.username && !usernameInput) {
      setUsernameInput(operatorWallet.username);
    }
    if (operatorWallet.displayName && !displayNameInput) {
      setDisplayNameInput(operatorWallet.displayName);
    }
  }, [operatorWallet]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ==========================================
  // STEP 1: Connect via Official Stellar Wallets Kit
  // ==========================================
  const handleConnectWallet = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const walletInfo = await connectOfficialStellarWallet();

      const existingProfile = await api.getOperatorProfile(walletInfo.address).catch(() => null);
      const backendAlias = existingProfile?.alias || '';
      const isAlreadyVerified = existingProfile?.is_verified || false;
      const defaultUsername = backendAlias || `operator_${walletInfo.address.slice(0, 4).toLowerCase()}`;

      setOperatorWallet((prev) => {
        const next: OperatorWalletState = {
          ...prev,
          connected: true,
          address: walletInfo.address,
          ownershipVerified: isAlreadyVerified,
          balanceXlm: walletInfo.balanceXlm,
          walletName: walletInfo.walletName,
          username: prev.username || defaultUsername,
          displayName: prev.displayName || backendAlias || 'Treasury Operator',
          role: prev.role || 'Treasury Operator',
          avatar: prev.avatar || 'shield',
        };
        localStorage.setItem('guardrail_operator_profile', JSON.stringify(next));
        return next;
      });

      if (!usernameInput) setUsernameInput(defaultUsername);
      if (!displayNameInput && backendAlias) setDisplayNameInput(backendAlias);

      setCurrentStep(2);
    } catch (err) {
      console.error('Wallet connection failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect Stellar wallet.');
    } finally {
      setIsConnecting(false);
    }
  };

  // ==========================================
  // STEP 2: Save Username and Profile Setup
  // ==========================================
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!usernameInput.trim()) {
      setErrorMsg('Please choose a valid username / operator handle.');
      return;
    }

    const cleanUsername = usernameInput.trim().replace(/^@/, '').toLowerCase();

    if (operatorWallet.address) {
      try {
        await api.updateOperatorProfile({
          address: operatorWallet.address,
          alias: cleanUsername,
        });
      } catch (err) {
        console.warn('Backend profile sync note:', err);
      }
    }

    setOperatorWallet((prev) => {
      const next: OperatorWalletState = {
        ...prev,
        username: cleanUsername,
        displayName: displayNameInput.trim() || 'Treasury Operator',
        role: roleInput,
      };
      localStorage.setItem('guardrail_operator_profile', JSON.stringify(next));
      return next;
    });

    setErrorMsg(null);
    setCurrentStep(3);
  };

  // ==========================================
  // STEP 3: Cryptographic Ownership Verification
  // ==========================================
  const handleVerifyOwnership = async () => {
    if (!operatorWallet.address) {
      setErrorMsg('Please connect your operator wallet first.');
      return;
    }
    setIsSigning(true);
    setErrorMsg(null);

    try {
      // 1. Get nonce & challenge from backend API
      const challengeRes = await api.getChallenge(operatorWallet.address);

      // 2. Sign challenge message using wallet (supports Freighter, Albedo, xBull, etc.)
      const signature = await signChallengeWithWallet(challengeRes.challenge, operatorWallet.address);

      // 3. Verify on backend API with alias and original challenge string (supports SEP-53)
      const verifyRes = await api.verifyChallenge(
        operatorWallet.address,
        signature,
        operatorWallet.username || usernameInput,
        challengeRes.challenge
      );

      setOperatorWallet((prev) => {
        const next: OperatorWalletState = {
          ...prev,
          ownershipVerified: true,
          username: verifyRes.operator?.alias || prev.username,
        };
        localStorage.setItem('guardrail_operator_profile', JSON.stringify(next));
        return next;
      });

      setCurrentStep(4);
    } catch (err) {
      console.error('Cryptographic verification failed on backend API:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Cryptographic signature verification failed. Please approve the signing request in your Stellar wallet.'
      );
    } finally {
      setIsSigning(false);
    }
  };

  // ==========================================
  // STEP 4: Generate Fresh Key & Register Vault
  // ==========================================
  const handleGenerateFreshAddress = async () => {
    setIsGeneratingAddress(true);
    setErrorMsg(null);
    try {
      const res = await api.generateVaultAddress();
      if (res?.address) {
        setControlledInput(res.address);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to generate fresh Stellar address from backend API.');
    } finally {
      setIsGeneratingAddress(false);
    }
  };

  const handleCompleteControlled = async () => {
    setIsRegisteringContract(true);
    setErrorMsg(null);

    const cleanAddress = controlledInput.trim();
    if (cleanAddress && (!cleanAddress.startsWith('G') || cleanAddress.length !== 56)) {
      setErrorMsg(
        'Invalid Stellar address format. Must be a 56-character public key starting with "G". Click "Generate Fresh Vault Key" to auto-generate a valid key.'
      );
      setIsRegisteringContract(false);
      return;
    }

    try {
      const scStatus = await api.getSmartContractStatus();

      const walletRes = await api.createWallet({
        address: cleanAddress || undefined,
        name: `${operatorWallet.username ? `@${operatorWallet.username}'s` : 'Primary'} AI Controlled Treasury`,
        operator_address: operatorWallet.address,
        balance: '100.0000000',
      });

      setControlledWallet((prev) => ({
        ...prev,
        id: walletRes.id,
        address: walletRes.address,
        ownershipVerified: true,
        smartContractConnected: true,
        smartContractAddress: scStatus.contract_address,
        currentThreshold: walletRes.threshold_med || 2,
        currentSignersCount: 3,
      }));

      setCurrentStep(5);
    } catch (err) {
      console.error('Controlled wallet registration error on backend:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to register controlled wallet on backend API. Please verify the address and try again.'
      );
    } finally {
      setIsRegisteringContract(false);
    }
  };

  // ==========================================
  // STEP 5: Launch Dashboard
  // ==========================================
  const handleLaunchDashboard = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#09101A] text-white flex flex-col font-manrope selection:bg-[#4AC777]/30 selection:text-white">
      {/* Subtle Background Grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-15 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(43, 51, 64, 0.6) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(43, 51, 64, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-[680px] mx-auto px-4 pt-8 sm:pt-12 pb-2 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Logo size="md" />
        </Link>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-[#F2B036]/15 border border-[#F2B036]/30 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F2B036]" />
            <span className="font-space font-medium text-[11px] text-[#F2B036] tracking-tight">
              Stellar Testnet
            </span>
          </div>

          <Link
            to="/login"
            className="text-xs text-[#9099A5] hover:text-white px-2.5 py-1 rounded transition-colors"
          >
            Registered? <span className="text-[#4AC777] font-semibold">Log In</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-[680px] mx-auto w-full px-4 pb-20 flex flex-col gap-6">
        {/* Step Flow Header Title */}
        <div className="flex flex-col gap-1 text-center pt-2">
          <h1 className="font-space font-bold text-2xl sm:text-3xl text-white tracking-tight">
            Set Up Your Operator Account
          </h1>
          <p className="font-manrope text-xs sm:text-sm text-[#9099A5]">
            5 simple steps to connect, verify, and secure your autonomous AI treasury.
          </p>
        </div>

        {/* Clean Step Flow Navigation Bar at the top */}
        <div className="w-full bg-[#121924]/90 backdrop-blur-md border border-[#232F3E] rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between relative px-2 sm:px-4">
            {/* Background connecting track */}
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-[#1F2B3B] -z-0" />
            {/* Active connecting line */}
            <div
              className="absolute top-4 left-6 h-0.5 bg-[#4AC777] transition-all duration-500 -z-0"
              style={{
                width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
              }}
            />

            {STEPS.map((s) => {
              const StepIcon = s.icon;
              const isCompleted = currentStep > s.id;
              const isActive = currentStep === s.id;
              const isPending = currentStep < s.id;

              return (
                <button
                  key={s.id}
                  disabled={isPending}
                  onClick={() => {
                    if (isCompleted) setCurrentStep(s.id as 1 | 2 | 3 | 4 | 5);
                  }}
                  className={`relative z-10 flex flex-col items-center gap-1.5 transition-all ${
                    isCompleted ? 'cursor-pointer hover:opacity-90' : isPending ? 'cursor-not-allowed opacity-40' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-space text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-[#4AC777] text-[#09101A] shadow-md shadow-[#4AC777]/20 ring-2 ring-[#4AC777]/30'
                        : isActive
                        ? 'bg-[#202938] border-2 border-[#F2B036] text-[#F2B036] ring-4 ring-[#F2B036]/20'
                        : 'bg-[#151D28] border border-[#2B3340] text-[#9099A5]'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </div>

                  <span
                    className={`font-space text-[10px] sm:text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'text-[#F2B036]'
                        : isCompleted
                        ? 'text-[#4AC777]'
                        : 'text-[#9099A5]'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-3.5 bg-[#ED4A49]/15 border border-[#ED4A49]/40 rounded-xl text-xs text-[#ED4A49] flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="underline ml-4 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 1: Connect Wallet                                                 */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-8 bg-[#131B26] border border-[#232F3E] rounded-2xl shadow-xl flex flex-col gap-6 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1">
              <span className="font-space text-xs font-semibold text-[#4AC777]">Step 1 · Wallet Setup</span>
              <h2 className="font-space font-bold text-xl sm:text-2xl text-white">
                Connect Your Stellar Wallet
              </h2>
              <p className="font-manrope text-xs sm:text-sm text-[#9099A5]">
                Use the official Stellar Wallets Kit to link your non-custodial signer. Your private key never leaves your browser.
              </p>
            </div>

            {operatorWallet.connected ? (
              <div className="p-5 bg-[#0D141F] border border-[#4AC777]/40 rounded-xl flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#4AC777] font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Wallet Connected</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-space font-medium bg-[#1B2432] border border-[#2B3545] text-white">
                    {operatorWallet.walletName || 'Stellar Connected'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#151D28] rounded-lg border border-[#232F3E]">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#9099A5] uppercase tracking-wider font-space">Public Key</span>
                    <span className="font-space text-xs text-white font-medium break-all mt-0.5">
                      {operatorWallet.address}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(operatorWallet.address, 'op_addr')}
                    className="p-1.5 text-[#9099A5] hover:text-white rounded hover:bg-[#202938] transition-colors ml-2"
                  >
                    {copiedKey === 'op_addr' ? <Check className="w-4 h-4 text-[#4AC777]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[#9099A5] px-1">
                  <span>Testnet Balance:</span>
                  <span className="font-space font-bold text-[#4AC777] text-sm">
                    {operatorWallet.balanceXlm || '100.00'} XLM
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={openWalletProfileModal}
                    className="text-xs text-[#9099A5] hover:text-white underline cursor-pointer"
                  >
                    Switch Wallet
                  </button>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-5 py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-98"
                  >
                    <span>Continue to Profile Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="w-full py-4 px-6 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#4AC777]/20 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting Stellar Wallets Kit...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      <span>Launch Official Stellar Wallets Kit</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-3 pt-2 text-[11px] text-[#9099A5] font-space flex-wrap">
                  <span>Supported:</span>
                  {['Freighter', 'Albedo', 'xBull', 'Lobstr', 'Hana'].map((w) => (
                    <span key={w} className="px-2 py-0.5 bg-[#0D141F] border border-[#232F3E] rounded text-white">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 2: Profile & Operator Identity                                    */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <form
            onSubmit={handleSaveProfile}
            className="p-6 sm:p-8 bg-[#131B26] border border-[#232F3E] rounded-2xl shadow-xl flex flex-col gap-6 animate-in fade-in duration-150"
          >
            <div className="flex flex-col gap-1">
              <span className="font-space text-xs font-semibold text-[#4AC777]">Step 2 · Operator Identity</span>
              <h2 className="font-space font-bold text-xl sm:text-2xl text-white">
                Set Operator Handle
              </h2>
              <p className="font-manrope text-xs sm:text-sm text-[#9099A5]">
                Your handle identifies your operator approvals and multisig co-signing actions in the audit ledger.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {/* Handle Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">
                  Operator Username / Handle *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#9099A5] font-space text-sm font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={usernameInput.replace(/^@/, '')}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
                    placeholder="alice_treasury"
                    className="w-full pl-8 pr-4 py-2.5 bg-[#0B121C] border border-[#232F3E] focus:border-[#4AC777] focus:outline-none rounded-lg text-sm text-white font-space placeholder-[#4A5568]"
                  />
                </div>
                <span className="text-[11px] text-[#9099A5]">
                  Preview: <span className="text-[#4AC777] font-semibold">@{usernameInput.trim().replace(/^@/, '').toLowerCase() || 'operator'}</span>
                </span>
              </div>

              {/* Display Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">Full Name or Title</label>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Alice Vance - Treasury Lead"
                  className="w-full px-4 py-2.5 bg-[#0B121C] border border-[#232F3E] focus:border-[#4AC777] focus:outline-none rounded-lg text-sm text-white font-manrope placeholder-[#4A5568]"
                />
              </div>

              {/* Role Picker */}
              <div className="flex flex-col gap-2 pt-1">
                <label className="text-xs font-semibold text-white">Select Responsibility</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { title: 'Treasury Operator', desc: 'Financial limits & approvals' },
                    { title: 'Security Admin', desc: 'Allowlists & circuit breakers' },
                    { title: 'DevOps & AI Lead', desc: 'Agent API keys & telemetry' },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.title}
                      onClick={() => setRoleInput(r.title as any)}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        roleInput === r.title
                          ? 'bg-[#182332] border-[#4AC777] shadow-sm'
                          : 'bg-[#0B121C] border-[#232F3E] hover:border-[#38495E]'
                      }`}
                    >
                      <span className="font-space text-xs font-bold text-white">{r.title}</span>
                      <span className="text-[10px] text-[#9099A5]">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#232F3E] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-[#9099A5] hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-98"
              >
                <span>Continue to Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 3: Cryptographic Ownership Verification                           */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="p-6 sm:p-8 bg-[#131B26] border border-[#232F3E] rounded-2xl shadow-xl flex flex-col gap-6 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1">
              <span className="font-space text-xs font-semibold text-[#4AC777]">Step 3 · Cryptographic Proof</span>
              <h2 className="font-space font-bold text-xl sm:text-2xl text-white">
                Verify Wallet Ownership (SEP-10)
              </h2>
              <p className="font-manrope text-xs sm:text-sm text-[#9099A5]">
                Sign the challenge using your connected Stellar wallet. This verifies you control the key without revealing your secret.
              </p>
            </div>

            <div className="p-4 bg-[#0B121C] border border-[#232F3E] rounded-xl flex flex-col gap-2.5 font-space text-xs">
              <div className="flex items-center justify-between text-[#9099A5]">
                <span>Operator</span>
                <span className="text-white font-semibold">@{operatorWallet.username}</span>
              </div>
              <div className="flex items-center justify-between text-[#9099A5]">
                <span>Public Address</span>
                <span className="text-white text-[11px] break-all">{operatorWallet.address}</span>
              </div>
              <div className="flex items-center justify-between text-[#9099A5]">
                <span>Standard</span>
                <span className="text-[#4AC777] font-semibold">SEP-53 / SEP-10 Compatible</span>
              </div>
            </div>

            {operatorWallet.ownershipVerified ? (
              <div className="p-4 bg-[#4AC777]/10 border border-[#4AC777]/30 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-xs text-[#4AC777] font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ownership Cryptographically Verified!</span>
                </div>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Continue to Vault Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleVerifyOwnership}
                  disabled={isSigning}
                  className="w-full py-3.5 px-6 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#4AC777]/20 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {isSigning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Approve Signature in Wallet Prompt...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4" />
                      <span>Sign Challenge & Verify Ownership</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-center text-[#9099A5]">
                  Opens your wallet for off-chain message signing. Zero gas required.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-[#232F3E] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-[#9099A5] hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              {operatorWallet.ownershipVerified && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-5 py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>Next: Configure Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 4: AI Treasury Vault & Soroban Contract Setup                     */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="p-6 sm:p-8 bg-[#131B26] border border-[#232F3E] rounded-2xl shadow-xl flex flex-col gap-6 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1">
              <span className="font-space text-xs font-semibold text-[#4AC777]">Step 4 · Treasury Vault</span>
              <h2 className="font-space font-bold text-xl sm:text-2xl text-white">
                Register Protected AI Vault
              </h2>
              <p className="font-manrope text-xs sm:text-sm text-[#9099A5]">
                Configure the multisig boundary. GuardRail co-signs only when transactions strictly comply with your policies.
              </p>
            </div>

            {/* Vault Address Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white">
                  Controlled Stellar Vault Key *
                </label>
                <button
                  type="button"
                  onClick={handleGenerateFreshAddress}
                  disabled={isGeneratingAddress}
                  className="text-[11px] text-[#4AC777] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isGeneratingAddress ? 'Generating...' : 'Generate Fresh Vault Key'}</span>
                </button>
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={controlledInput}
                  onChange={(e) => setControlledInput(e.target.value.trim())}
                  placeholder="G..."
                  className="w-full pl-4 pr-10 py-2.5 bg-[#0B121C] border border-[#232F3E] focus:border-[#4AC777] focus:outline-none rounded-lg text-xs sm:text-sm text-white font-space placeholder-[#4A5568]"
                />
                {controlledInput && (
                  <button
                    type="button"
                    onClick={() => handleCopy(controlledInput, 'vault_addr')}
                    className="absolute right-3 p-1 text-[#9099A5] hover:text-white"
                  >
                    {copiedKey === 'vault_addr' ? (
                      <Check className="w-4 h-4 text-[#4AC777]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <span className="text-[11px] text-[#9099A5]">
                A valid 56-character Stellar public address has been pre-generated for your protected treasury.
              </span>
            </div>

            {/* Multisig Boundary Breakdown */}
            <div className="p-4 bg-[#0B121C] border border-[#232F3E] rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9099A5]">Multisig Signing Boundary</span>
                <span className="text-[#4AC777] font-semibold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Soroban Smart Contract Active</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs font-space">
                <div className="p-2.5 bg-[#121A26] rounded-lg border border-[#232F3E]/60 flex flex-col">
                  <span className="text-[10px] text-[#9099A5]">Signer 1: AI Agent</span>
                  <span className="text-white font-bold mt-0.5">Weight: 1</span>
                </div>
                <div className="p-2.5 bg-[#121A26] rounded-lg border border-[#232F3E]/60 flex flex-col">
                  <span className="text-[10px] text-[#9099A5]">Signer 2: GuardRail CoSigner</span>
                  <span className="text-[#4AC777] font-bold mt-0.5">Weight: 1</span>
                </div>
                <div className="p-2.5 bg-[#121A26] rounded-lg border border-[#232F3E]/60 flex flex-col">
                  <span className="text-[10px] text-[#9099A5]">Required Threshold</span>
                  <span className="text-[#F2B036] font-bold mt-0.5">Medium: 2</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#232F3E] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs text-[#9099A5] hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                onClick={handleCompleteControlled}
                disabled={isRegisteringContract || !controlledInput}
                className="px-6 py-2.5 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isRegisteringContract ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registering Vault on Backend API...</span>
                  </>
                ) : (
                  <>
                    <span>Register Vault & Complete</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 5: Ready / Launch Dashboard                                       */}
        {/* ========================================================================= */}
        {currentStep === 5 && (
          <div className="p-8 sm:p-10 bg-[#131B26] border border-[#232F3E] rounded-2xl shadow-xl flex flex-col items-center text-center gap-6 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#4AC777]/15 border border-[#4AC777]/40 flex items-center justify-center text-[#4AC777]">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="flex flex-col gap-1.5 max-w-md">
              <span className="font-space text-xs font-bold text-[#4AC777] uppercase tracking-wider">
                Setup Complete
              </span>
              <h2 className="font-space font-bold text-2xl sm:text-3xl text-white">
                GuardRail Protection Active!
              </h2>
              <p className="font-manrope text-xs sm:text-sm text-[#9099A5]">
                Your operator identity is verified and your protected AI treasury is registered on the Stellar coordinator.
              </p>
            </div>

            {/* Summary Review Card */}
            <div className="w-full max-w-md p-4 bg-[#0B121C] border border-[#232F3E] rounded-xl flex flex-col gap-2.5 text-left font-space text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#1F2B3B]">
                <span className="text-[#9099A5]">Operator Handle</span>
                <span className="text-[#4AC777] font-bold">@{operatorWallet.username}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#1F2B3B]">
                <span className="text-[#9099A5]">Operator Address</span>
                <span className="text-white">
                  {operatorWallet.address ? `${operatorWallet.address.slice(0, 8)}…${operatorWallet.address.slice(-6)}` : 'Connected'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#1F2B3B]">
                <span className="text-[#9099A5]">Treasury Vault</span>
                <span className="text-white">
                  {controlledWallet.address ? `${controlledWallet.address.slice(0, 8)}…${controlledWallet.address.slice(-6)}` : 'Registered'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#9099A5]">Multisig Boundary</span>
                <span className="text-[#F2B036] font-bold">2-of-3 Threshold Active</span>
              </div>
            </div>

            {/* Launch Dashboard Button */}
            <button
              onClick={handleLaunchDashboard}
              className="w-full max-w-md py-3.5 px-6 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-xl transition-all shadow-xl shadow-[#4AC777]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Launch GuardRail Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
