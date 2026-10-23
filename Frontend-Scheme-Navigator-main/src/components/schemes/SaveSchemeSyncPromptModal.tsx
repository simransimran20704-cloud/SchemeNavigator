import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, ShieldCheck, X, ArrowRight, Smartphone, Laptop, CheckCircle2 } from 'lucide-react';
import { Scheme } from '../../types';
import { useAppStore } from '../../store/appStore';
import { getAuthUser } from '../../services/storageService';

export const SaveSchemeSyncPromptModal: React.FC = () => {
  const { openAuthModal } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [savedScheme, setSavedScheme] = useState<Scheme | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      const customEvent = e as CustomEvent<{ scheme?: Scheme }>;
      const user = getAuthUser();
      if (user?.isLoggedIn) return;

      const skipPreference = localStorage.getItem('sn_skip_save_signup');
      if (skipPreference === 'true') return;

      setSavedScheme(customEvent.detail?.scheme || null);
      setIsOpen(true);
    };

    const handleAuthChange = () => {
      const user = getAuthUser();
      if (user?.isLoggedIn) {
        setIsOpen(false);
      }
    };

    window.addEventListener('sn_prompt_save_signup', handlePrompt);
    window.addEventListener('sn_auth_updated', handleAuthChange);

    return () => {
      window.removeEventListener('sn_prompt_save_signup', handlePrompt);
      window.removeEventListener('sn_auth_updated', handleAuthChange);
    };
  }, []);

  const handleCloseOrSkip = () => {
    if (dontAskAgain) {
      try {
        localStorage.setItem('sn_skip_save_signup', 'true');
      } catch {}
    }
    setIsOpen(false);
  };

  const handleSignUp = () => {
    if (dontAskAgain) {
      try {
        localStorage.setItem('sn_skip_save_signup', 'true');
      } catch {}
    }
    setIsOpen(false);
    openAuthModal('signup');
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleCloseOrSkip}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md my-auto flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Close Button */}
        <button
          type="button"
          onClick={handleCloseOrSkip}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10 cursor-pointer"
          aria-label="Skip / Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Banner */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 p-6 text-white text-center relative overflow-hidden shrink-0">
          <div className="relative z-10 space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-2 border border-white/20 shadow-xs">
              <Bookmark className="w-6 h-6 text-emerald-300 fill-emerald-300" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Scheme Saved to Device</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black tracking-tight">
              {savedScheme?.name ? `Saved "${savedScheme.name.slice(0, 40)}..."` : 'Scheme Saved Locally!'}
            </h3>
            <p className="text-xs text-teal-100/90 max-w-xs mx-auto">
              This scheme is safely saved in your browser on this device.
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Multi-Device Feature Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center -space-x-1.5 text-teal-700 dark:text-emerald-400">
                <Smartphone className="w-5 h-5" />
                <Laptop className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Sync Between Phone & Laptop
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Create a free account or sign in to seamlessly access your bookmarked schemes and application tracker across all your phones, tablets, and computers.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {/* Primary: Sign Up / Sign In */}
            <button
              type="button"
              onClick={handleSignUp}
              className="w-full py-3 px-4 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Sign Up / Sign In to Sync Across Devices</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Secondary: Skip & Continue as Guest */}
            <button
              type="button"
              onClick={handleCloseOrSkip}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer text-center"
            >
              Skip for now — Continue as Guest
            </button>
          </div>

          {/* Remember Choice Checkbox */}
          <div className="pt-1 flex items-center justify-center">
            <label className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-teal-700 focus:ring-teal-500 cursor-pointer"
              />
              <span>Don't show this reminder again on this device</span>
            </label>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
