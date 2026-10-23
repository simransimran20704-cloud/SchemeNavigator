import React from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ShieldCheck, AlertTriangle, X, CheckSquare } from 'lucide-react';
import { Scheme } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { DeadlineTicker } from '../calendar/DeadlineTicker';

import { getSafeOfficialUrl } from '../../utils/portalUrls';
import { translateSchemeTitle } from '../../utils/schemeTranslator';

interface ExternalPortalModalProps {
  scheme: Scheme | null;
  isOpen: boolean;
  onClose: () => void;
}


export const ExternalPortalModal: React.FC<ExternalPortalModalProps> = ({
  scheme,
  isOpen,
  onClose,
}) => {
  const { t, tp, langCode } = useTranslation();

  if (!isOpen || !scheme) return null;

  const targetUrl = getSafeOfficialUrl(scheme);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg my-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-950 text-white p-5 pr-12 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('modal.portal_exit_badge', undefined, 'Official Government Portal Exit')}</span>
          </div>
          <h3 className="text-lg font-bold leading-snug">
            {t('modal.portal_exit_title', undefined, 'Continuing to Official Application Channel')}
          </h3>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <span className="text-xs font-medium text-slate-700 block mb-0.5">{t('modal.dest_scheme', undefined, 'Destination Scheme:')}</span>
            <div className="font-bold text-slate-900 text-base">{translateSchemeTitle(scheme.name, langCode)}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <DeadlineTicker scheme={scheme} variant="badge" />
            </div>
            <div className="text-xs text-teal-800 font-medium mt-1.5 flex items-center gap-1">
              <span>{t('modal.managed_by', undefined, 'Managed by:')}</span>
              <span className="text-slate-800">{tp(scheme.verification?.ministryOrAuthority || 'Government Department')}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
              <span>{t('modal.target_website', undefined, 'Target Website:')}</span>
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-semibold text-teal-800 hover:underline bg-teal-50 px-2 py-0.5 rounded border border-teal-200 max-w-[240px] truncate"
              >
                {targetUrl}
              </a>
            </div>
          </div>

          <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>{t('modal.notice_label', undefined, 'Notice:')}</strong> {t('modal.notice_text', undefined, 'You are now leaving SchemeNavigator. Application submission, document verification, and benefits approval take place exclusively on the official government website.')}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
              <span>{t('modal.preflight_checklist_title', undefined, 'Recommended Quick Pre-flight Checklist:')}</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t('modal.checklist_item1', undefined, 'Keep your Aadhaar linked mobile number handy for OTP verification.')}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t('modal.checklist_item2', undefined, 'Prepare scanned copies of mandatory documents under 200KB / 2MB.')}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t('modal.checklist_item3', undefined, 'Never pay any unofficial third party agent or private middlemen.')}
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            {t('modal.stay_on_sn', undefined, 'Stay on SchemeNavigator')}
          </button>
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-700 to-teal-900 hover:from-teal-800 hover:to-teal-950 text-white text-sm font-bold rounded-xl shadow-md shadow-teal-900/20 hover:shadow-lg transition-all cursor-pointer"
          >
            <span>{t('modal.go_to_official_portal', undefined, 'Go to Official Portal')}</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
};
