import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { OperatorWalletState } from '../types';
import {
  Wallet,
  Shield,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { connectOfficialStellarWallet, signChallengeWithWallet } from '../services/stellarWallet';
import { api } from '../services/api';

interface LoginPageProps {
  operatorWallet: OperatorWalletState;
  setOperatorWallet: React.Dispatch<React.SetStateAction<OperatorWalletState>>;
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  operatorWallet,
  setOperatorWallet,
  onLoginSuccess,
}) => {
  const navigate = useNavigate();
  const [loginStep, setLoginStep] = useState<'idle' | 'connecting' | 'signing' | 'verifying' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');

  const handleStartLogin = async () => {
    setErrorMsg(null);
    setLoginStep('connecting');
    setStatusText('Opening Official Stellar Wallets Kit...');

    try {
      // 1. Connect wallet via official Stellar Wallets Kit
      const walletInfo = await connectOfficialStellarWallet();
      setLoginStep('signing');
      setStatusText('Requesting cryptographic SEP-10 challenge from backend coordinator...');

      // 2. Request challenge from backend API
      const challengeRes = await api.getChallenge(walletInfo.address);
      setStatusText('Please approve and sign the authentication challenge in your Stellar wallet...');

      // 3. Sign challenge using user's wallet
      const signature = await signChallengeWithWallet(challengeRes.challenge, walletInfo.address);

      setLoginStep('verifying');
      setStatusText('Verifying cryptographic Ed25519 signature on backend API...');

      // 4. Verify on backend API
      const verifyRes = await api.verifyChallenge(walletInfo.address, signature, undefined, challengeRes.challenge);

      // 5. Query operator profile from backend
      const profile = await api.getOperatorProfile(walletInfo.address).catch(() => null);

      const username = profile?.alias || verifyRes.operator?.alias || '';

      const authenticatedOperator: OperatorWalletState = {
        connected: true,
        address: walletInfo.address,
        ownershipVerified: true,
        balanceXlm: walletInfo.balanceXlm,
        walletName: walletInfo.walletName,
        username: username || `operator_${walletInfo.address.slice(0, 4).toLowerCase()}`,
        displayName: profile?.alias || 'Treasury Operator',
        role: 'Treasury Operator',
        avatar: 'shield',
      };

      // Persist to local storage
      localStorage.setItem('guardrail_operator_profile', JSON.stringify(authenticatedOperator));
      setOperatorWallet(authenticatedOperator);

      setLoginStep('success');
      setStatusText('Authenticated successfully! Redirecting to dashboard...');

      setTimeout(() => {
        onLoginSuccess();
      }, 700);
    } catch (err) {
      console.error('Login error:', err);
      setLoginStep('idle');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please approve the wallet connection and cryptographic signature.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#09101A] text-white flex flex-col font-manrope selection:bg-[#4AC777]/30 selection:text-white">
      {/* 40px Grid Background Overlay */}
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

      {/* Header */}
      <header className="relative z-10 w-full max-w-[800px] mx-auto px-4 pt-10 sm:pt-14 pb-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Logo size="md" />
        </Link>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-[rgba(242,176,54,0.2)] rounded-[4px]">
            <span className="w-1 h-1 rounded-full bg-[#F2B036]" />
            <span className="font-space font-medium text-[10px] text-[#F2B036] tracking-[-0.02em]">
              Stellar Testnet
            </span>
          </div>

          <Link
            to="/signup"
            className="text-xs text-[#4AC777] hover:text-[#3fb86b] font-medium px-2.5 py-1 rounded hover:bg-[#202938] transition-colors"
          >
            Sign Up →
          </Link>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 max-w-[520px] mx-auto w-full px-4 pb-20 flex flex-col justify-center">
        <div className="p-6 sm:p-8 bg-[#202938] border-[1.5px] border-[#2B3340] rounded-2xl shadow-2xl flex flex-col gap-6">
          {/* Card Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#09101A] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-space font-bold text-2xl text-white tracking-[-0.02em]">
                  Sign In to GuardRail
                </h1>
                <span className="font-space text-[11px] font-medium text-[#F2B036] tracking-tight">
                  Cryptographic Non-Custodial Authentication
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[#9099A5] leading-relaxed mt-1">
              Connect your Stellar wallet to sign the backend SEP-10 challenge. Proves wallet ownership without revealing your private key.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 bg-[#ED4A49]/15 border border-[#ED4A49]/40 rounded-lg flex items-start gap-2.5 text-xs text-[#ED4A49]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* Step / Status feedback */}
          {loginStep !== 'idle' ? (
            <div className="p-6 bg-[#17202C] border border-[#2B3340] rounded-xl flex flex-col items-center justify-center text-center gap-3">
              {loginStep === 'success' ? (
                <CheckCircle2 className="w-10 h-10 text-[#4AC777] animate-bounce" />
              ) : (
                <RefreshCw className="w-8 h-8 text-[#4AC777] animate-spin" />
              )}

              <div className="font-space font-bold text-sm text-white tracking-tight">
                {loginStep === 'connecting' && 'Step 1: Connecting Stellar Wallet'}
                {loginStep === 'signing' && 'Step 2: Signing Cryptographic Challenge'}
                {loginStep === 'verifying' && 'Step 3: Verifying Signature on Backend API'}
                {loginStep === 'success' && 'Authenticated!'}
              </div>

              <p className="font-manrope text-xs text-[#9099A5] max-w-xs leading-normal">
                {statusText}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                onClick={handleStartLogin}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-lg transition-all shadow-lg shadow-[#4AC777]/20 active:scale-98 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet & Sign In</span>
              </button>

              <div className="p-3.5 bg-[#09101A] border border-[#2B3340] rounded-lg flex items-center justify-between text-xs text-[#9099A5]">
                <span className="flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-[#F2B036]" />
                  <span>Supported: Freighter, Albedo, xBull, Lobstr, Hana</span>
                </span>
                <span className="text-[10px] text-[#4AC777] font-space font-medium">SEP-10</span>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#2B3340] flex items-center justify-between text-xs text-[#9099A5]">
            <span>Don't have an operator profile yet?</span>
            <Link
              to="/signup"
              className="font-semibold text-[#4AC777] hover:underline flex items-center gap-1"
            >
              <span>Sign Up Here</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
