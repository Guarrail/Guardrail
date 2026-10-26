import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Wallet,
  Shield,
  Fingerprint,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { OperatorWalletState } from '../types';
import { connectOfficialStellarWallet, signChallengeWithWallet } from '../services/stellarWallet';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (walletState: OperatorWalletState) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const navigate = useNavigate();
  const [authStep, setAuthStep] = useState<'idle' | 'connecting' | 'signing' | 'verifying' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authStatusText, setAuthStatusText] = useState<string>('');
  const [connectedAddress, setConnectedAddress] = useState<string>('');

  if (!isOpen) return null;

  const handleStartAuthFlow = async () => {
    setErrorMsg(null);
    setAuthStep('connecting');
    setAuthStatusText('Opening Stellar Wallets Kit...');

    try {
      // 1. Connect wallet via official kit
      const walletInfo = await connectOfficialStellarWallet();
      setConnectedAddress(walletInfo.address);
      setAuthStep('signing');
      setAuthStatusText('Requesting cryptographic challenge from backend API...');

      // 2. Request SEP-10 challenge from backend API
      const challengeRes = await api.getChallenge(walletInfo.address);

      setAuthStatusText('Please sign authentication challenge in your Stellar wallet...');

      // 3. Sign challenge using connected wallet
      const signature = await signChallengeWithWallet(challengeRes.challenge, walletInfo.address);

      setAuthStep('verifying');
      setAuthStatusText('Verifying Ed25519 signature on backend API...');

      // 4. Verify signature on backend API
      const verifyRes = await api.verifyChallenge(walletInfo.address, signature);

      // 5. Query operator profile
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

      // Save to localStorage
      localStorage.setItem('guardrail_operator_profile', JSON.stringify(authenticatedOperator));

      setAuthStep('success');
      setAuthStatusText('Authenticated successfully via Backend API!');

      setTimeout(() => {
        onAuthSuccess(authenticatedOperator);
        onClose();
        if (username) {
          navigate('/dashboard');
        } else {
          // If no username is set yet, guide them to complete onboarding profile
          navigate('/onboarding');
        }
      }, 800);
    } catch (err) {
      console.error('Login authentication error:', err);
      setAuthStep('idle');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please approve the wallet connection and cryptographic signature.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md p-6 sm:p-8 bg-[#202938] border-[1.5px] border-[#2B3340] rounded-2xl shadow-2xl flex flex-col gap-6 text-white font-manrope">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#9099A5] hover:text-white rounded-lg hover:bg-[#2B3340] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#09101A] border border-[#2B3340] flex items-center justify-center text-[#4AC777]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-space font-bold text-xl text-white tracking-[-0.02em]">
                Sign In with Stellar
              </h3>
              <span className="font-space text-[11px] font-medium text-[#F2B036] tracking-tight">
                Stellar Testnet Coordinator API
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#9099A5] leading-relaxed">
            Authenticate using the official Stellar Wallets Kit. A cryptographic SEP-10 challenge proves wallet ownership without exposing private keys.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 bg-[#ED4A49]/15 border border-[#ED4A49]/40 rounded-lg flex items-start gap-2.5 text-xs text-[#ED4A49]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Active Auth Progress / State */}
        {authStep !== 'idle' ? (
          <div className="p-5 bg-[#17202C] border border-[#2B3340] rounded-xl flex flex-col items-center justify-center text-center gap-3">
            {authStep === 'success' ? (
              <CheckCircle2 className="w-8 h-8 text-[#4AC777] animate-bounce" />
            ) : (
              <RefreshCw className="w-7 h-7 text-[#4AC777] animate-spin" />
            )}

            <div className="font-space font-bold text-sm text-white tracking-tight">
              {authStep === 'connecting' && 'Step 1: Connecting Stellar Wallet'}
              {authStep === 'signing' && 'Step 2: Signing Cryptographic Challenge'}
              {authStep === 'verifying' && 'Step 3: Verifying Signature on Backend API'}
              {authStep === 'success' && 'Authenticated!'}
            </div>

            <p className="font-manrope text-xs text-[#9099A5] max-w-xs leading-normal">
              {authStatusText}
            </p>

            {connectedAddress && (
              <div className="font-mono text-[11px] text-white/80 bg-[#09101A] px-2.5 py-1 rounded border border-[#2B3340]">
                {connectedAddress.slice(0, 8)}…{connectedAddress.slice(-6)}
              </div>
            )}
          </div>
        ) : (
          /* Idle Action */
          <div className="flex flex-col gap-3">
            <button
              onClick={handleStartAuthFlow}
              className="w-full py-3 px-4 bg-[#4AC777] hover:bg-[#3fb86b] text-[#09101A] font-manrope font-bold text-sm rounded-lg transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4 text-[#09101A]" />
              <span>Connect & Sign In with Stellar</span>
            </button>

            <div className="flex items-center justify-between text-xs text-[#9099A5] pt-1">
              <span>Supported: Freighter, xBull, Albedo, LOBSTR</span>
              <a
                href="https://stellarwalletskit.dev/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white flex items-center gap-0.5"
              >
                <span>Docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Bottom Switcher */}
        <div className="pt-2 border-t border-[#2B3340]/60 flex items-center justify-between text-xs font-manrope">
          <span className="text-[#9099A5]">Need to register a new operator?</span>
          <button
            onClick={() => {
              onClose();
              navigate('/onboarding');
            }}
            className="text-[#4AC777] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Start Onboarding</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
