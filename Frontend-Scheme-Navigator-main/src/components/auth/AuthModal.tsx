import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, setAuthUser } = useAppStore();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('otp');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // Flow states
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Resend OTP countdown
  const [resendCountdown, setResendCountdown] = useState(0);

  // OTP input refs
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Reset modal state on open during render without cascading effect
  const [prevOpenState, setPrevOpenState] = useState(isAuthModalOpen);
  const [prevModalMode, setPrevModalMode] = useState(authModalMode);
  if (isAuthModalOpen && (!prevOpenState || authModalMode !== prevModalMode)) {
    setPrevOpenState(isAuthModalOpen);
    setPrevModalMode(authModalMode);
    setMode(authModalMode || 'signin');
    setStep('form');
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtp(['', '', '', '', '', '']);
  } else if (!isAuthModalOpen && prevOpenState) {
    setPrevOpenState(false);
  }

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async (purpose: 'signup' | 'login') => {
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (purpose === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.sendOtp(email.trim(), purpose);
      setSuccessMessage(res.message || `Verification code sent to ${email}`);
      setStep('otp');
      setResendCountdown(60);
      // Auto-focus first OTP input after switching
      setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otp.join('').trim();
    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.verifyOtp({
        email: email.trim(),
        otp: fullOtp,
        purpose: mode === 'signup' ? 'signup' : 'login',
        name: name.trim() || undefined,
        password: password || undefined,
      });

      if (res.user) {
        setAuthUser(res.user);
        setStep('success');
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }

        setTimeout(() => {
          closeAuthModal();
        }, 1800);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.loginWithPassword(email.trim(), password);
      if (res.user) {
        setAuthUser(res.user);
        setStep('success');
        setTimeout(() => {
          closeAuthModal();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    // Handle paste of full 6 digits
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
      return;
    }

    const digit = val.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance
    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split('');
    const newOtp = [...otp];
    digits.forEach((d, i) => {
      newOtp[i] = d;
    });
    setOtp(newOtp);
    const nextIndex = Math.min(digits.length, 5);
    otpInputsRef.current[nextIndex]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleVerifyOtp();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={closeAuthModal}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md my-auto max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10 cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 p-6 text-white text-center relative overflow-hidden shrink-0">
          <div className="relative z-10 space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-2 border border-white/20">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <h3 className="text-xl font-black tracking-tight">
              {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
            </h3>
            <p className="text-xs text-teal-100/90 max-w-xs mx-auto">
              {mode === 'signup'
                ? 'Sign up with verified email OTP to access personalized schemes and saved journeys.'
                : 'Sign in to access your bookmarked schemes and application tracker.'}
            </p>
          </div>
        </div>

        {/* Tabs: Sign In / Sign Up */}
        {step !== 'success' && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1.5 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setStep('form');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setStep('form');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && step === 'otp' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* STEP 1: FORM INPUT */}
          {step === 'form' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (mode === 'signup') {
                  handleSendOtp('signup');
                } else if (authMethod === 'otp') {
                  handleSendOtp('login');
                } else {
                  handlePasswordLogin();
                }
              }}
              className="space-y-3.5"
            >
              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {mode === 'signin' && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Sign in with:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('otp')}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                        authMethod === 'otp'
                          ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Email OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('password')}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                        authMethod === 'password'
                          ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Password
                    </button>
                  </div>
                </div>
              )}

              {((mode === 'signin' && authMethod === 'password') || mode === 'signup') && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Password {mode === 'signup' ? '(Optional)' : ''}
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : mode === 'signup' ? (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : authMethod === 'otp' ? (
                  <>
                    <span>Send OTP to Email</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={closeAuthModal}
                  className="text-xs text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-emerald-400 font-semibold transition-colors cursor-pointer"
                >
                  Skip for now — Continue as Guest
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 'otp' && (
            <div className="space-y-4 text-center">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the 6-digit code sent to:
                </p>
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center justify-center gap-2">
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>



              {/* 6-box OTP Input */}
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 py-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputsRef.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-600 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 text-slate-900 dark:text-white transition-all"
                  />
                ))}
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full py-3 bg-teal-800 hover:bg-teal-900 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>

              {/* Resend OTP */}
              <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
                {resendCountdown > 0 ? (
                  <span>Resend code in {resendCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp(mode === 'signup' ? 'signup' : 'login')}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend verification code</span>
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={closeAuthModal}
                  className="text-xs text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-emerald-400 font-semibold transition-colors cursor-pointer"
                >
                  Skip for now — Continue as Guest
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS STATE */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                {mode === 'signup' ? 'Account Created Successfully!' : 'Welcome Back!'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                You are now logged in. Your preferences, saved schemes, and tracker milestones are synced.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
