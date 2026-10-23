import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Bell,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  History,
  Settings,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/appStore';
import {
  NotificationPreferences,
  SendNotificationResponse,
  NotificationLogItem,
  Scheme,
} from '../../types';
import { getSafeOfficialUrl } from '../../utils/portalUrls';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScheme?: Scheme | null;
  initialTemplate?: string;
  initialData?: Record<string, any>;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  initialScheme,
  initialTemplate,
  initialData,
}) => {
  const { t, langCode } = useTranslation();
  const { authUser } = useAppStore();

  const [activeTab, setActiveTab] = useState<'settings' | 'logs'>('settings');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [channelWhatsApp, setChannelWhatsApp] = useState(true);
  const [channelSMS, setChannelSMS] = useState(true);
  const [notifyTracker, setNotifyTracker] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyNewSchemes, setNotifyNewSchemes] = useState(false);
  const [selectedLang, setSelectedLang] = useState(langCode || 'hi-IN');

  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lastResponse, setLastResponse] = useState<SendNotificationResponse | null>(null);

  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Load preferences when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    api.getNotificationPreferences().then((prefs: NotificationPreferences) => {
      if (!isMounted) return;
      if (prefs.phone_number) {
        setPhoneNumber(prefs.phone_number.replace(/^\+91/, ''));
      }
      setChannelWhatsApp(prefs.channel_whatsapp ?? true);
      setChannelSMS(prefs.channel_sms ?? true);
      setNotifyTracker(prefs.notify_tracker_updates ?? true);
      setNotifyDeadlines(prefs.notify_deadlines ?? true);
      setNotifyNewSchemes(prefs.notify_new_schemes ?? false);
      setSelectedLang(prefs.preferred_language || langCode || 'hi-IN');
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, langCode]);

  // Load logs when switching to logs tab
  useEffect(() => {
    if (activeTab === 'logs' && isOpen) {
      loadLogs();
    }
  }, [activeTab, isOpen]);

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const cleanPhone = phoneNumber ? `+91${phoneNumber.replace(/\D/g, '')}` : '';
      const items = await api.getNotificationLogs(cleanPhone);
      setLogs(items);
    } catch (err) {
      console.warn('Failed to load logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSavePreferences = async () => {
    const rawDigits = phoneNumber.replace(/\D/g, '');
    if (rawDigits.length > 0 && rawDigits.length < 10) {
      setStatusMessage({ text: 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें (Please enter a valid 10-digit mobile number)', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const cleanPhone = rawDigits ? (rawDigits.startsWith('91') && rawDigits.length === 12 ? `+${rawDigits}` : `+91${rawDigits.slice(-10)}`) : '';
      await api.saveNotificationPreferences({
        phone_number: cleanPhone,
        channel_whatsapp: channelWhatsApp,
        channel_sms: channelSMS,
        notify_tracker_updates: notifyTracker,
        notify_deadlines: notifyDeadlines,
        notify_new_schemes: notifyNewSchemes,
        preferred_language: selectedLang,
      });

      setStatusMessage({
        text: 'अधिसूचना प्राथमिकताएं सफलतापूर्वक सहेजी गईं! (Notification preferences saved successfully!)',
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage({ text: 'प्राथमिकताएं सहेजने में विफल। कृपया पुनः प्रयास करें।', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestNotification = async () => {
    const rawDigits = phoneNumber.replace(/\D/g, '');
    if (rawDigits.length < 10) {
      setStatusMessage({ text: 'परीक्षण संदेश भेजने के लिए कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।', type: 'error' });
      return;
    }

    const selectedChannels: ('whatsapp' | 'sms')[] = [];
    if (channelWhatsApp) selectedChannels.push('whatsapp');
    if (channelSMS) selectedChannels.push('sms');

    if (selectedChannels.length === 0) {
      setStatusMessage({ text: 'कृपया कम से कम एक चैनल (WhatsApp या SMS) चुनें।', type: 'error' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    setLastResponse(null);

    const cleanPhone = rawDigits.startsWith('91') && rawDigits.length === 12 ? `+${rawDigits}` : `+91${rawDigits.slice(-10)}`;

    try {
      let templateType = initialTemplate || 'test';
      let payloadData: Record<string, any> = initialData || {};

      if (initialScheme) {
        templateType = 'scheme_summary';
        payloadData = {
          scheme_name: initialScheme.name,
          category: initialScheme.category || 'General',
          brief: initialScheme.tagline || initialScheme.shortDescription || '',
          benefits_summary: initialScheme.benefits?.[0]?.description || 'सरकारी सहायता एवं लाभ',
          eligibility_summary: `आयु: ${initialScheme.eligibility?.minAge || 0}-${initialScheme.eligibility?.maxAge || 100} वर्ष`,
          portal_url: getSafeOfficialUrl(initialScheme),
        };
      }

      const res = await api.sendNotification({
        phone_number: cleanPhone,
        channels: selectedChannels,
        template_type: templateType,
        data: payloadData,
        lang_code: selectedLang,
      });

      setLastResponse(res);
      setStatusMessage({
        text: 'नोटिफिकेशन सफलतापूर्वक भेजा गया! (Notification dispatched successfully!)',
        type: 'success',
      });

      // Reload logs in background
      loadLogs();
    } catch {
      setStatusMessage({ text: 'संदेश भेजने में त्रुटि हुई। कृपया पुनः प्रयास करें।', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl my-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-950 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>Multi-Channel Citizen Alerts • 100% Free & Secure</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <span>WhatsApp & SMS Notification Center</span>
          </h2>
          <p className="text-xs sm:text-sm text-teal-100/90 mt-1 max-w-xl">
            सरकारी योजनाओं की स्थिति, अंतिम तिथियों और नए लाभों की समय पर जानकारी सीधे अपने मोबाइल पर पाएं।
          </p>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-emerald-950 shadow-md font-extrabold'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>अलर्ट सेटिंग्स (Preferences)</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white text-emerald-950 shadow-md font-extrabold'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>भेजे गए संदेश (Activity Log)</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 max-h-[65vh]">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === 'settings' ? (
            <>
              {/* Context alert if opened for a specific scheme */}
              {initialScheme && (
                <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-teal-950 dark:text-teal-200">
                      योजना गाइड भेजें: {initialScheme.name}
                    </p>
                    <p className="text-teal-700 dark:text-teal-300 mt-0.5">
                      इस योजना की पात्रता, आवश्यक दस्तावेज और आवेदन लिंक सीधे अपने WhatsApp या SMS पर प्राप्त करें।
                    </p>
                  </div>
                </div>
              )}

              {/* Mobile Number Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  मोबाइल नंबर (Mobile Number) <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1.5 text-slate-500 text-xs font-bold border-r border-slate-200 dark:border-slate-700 pr-2">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full pl-20 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  आपके नंबर का उपयोग केवल आधिकारिक योजना सूचनाओं के लिए किया जाएगा। कोई स्पैम नहीं।
                </p>
              </div>

              {/* Delivery Channels */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  नोटिफिकेशन चैनल चुनें (Choose Notification Channels)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* WhatsApp Channel */}
                  <div
                    onClick={() => setChannelWhatsApp(!channelWhatsApp)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      channelWhatsApp
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 opacity-60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">WhatsApp</span>
                        <input
                          type="checkbox"
                          checked={channelWhatsApp}
                          onChange={(e) => setChannelWhatsApp(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        सीधे 1-क्लिक WhatsApp लिंक एवं अलर्ट्स
                      </p>
                    </div>
                  </div>

                  {/* SMS / Text Message Channel */}
                  <div
                    onClick={() => setChannelSMS(!channelSMS)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      channelSMS
                        ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 opacity-60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">SMS / Text</span>
                        <input
                          type="checkbox"
                          checked={channelSMS}
                          onChange={(e) => setChannelSMS(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        मानक टेक्स्ट संदेश (बिना इंटरनेट के भी प्राप्त)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Triggers / Preferences */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  अलर्ट प्राथमिकताएं (Alert Preferences)
                </label>
                <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-850/50 text-xs">
                  <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      🔔 योजना आवेदन स्थिति अपडेट (Application Status Changes)
                    </span>
                    <input
                      type="checkbox"
                      checked={notifyTracker}
                      onChange={(e) => setNotifyTracker(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      ⏰ आवेदन अंतिम तिथि अनुस्मारक (Deadline & Intake Reminders)
                    </span>
                    <input
                      type="checkbox"
                      checked={notifyDeadlines}
                      onChange={(e) => setNotifyDeadlines(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      💡 नई पात्र योजनाओं का मासिक बुलेटिन (New Matching Scheme Alerts)
                    </span>
                    <input
                      type="checkbox"
                      checked={notifyNewSchemes}
                      onChange={(e) => setNotifyNewSchemes(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                  </label>
                </div>
              </div>

              {/* Language selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  संदेश भाषा (Alert Language)
                </label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="hi-IN">हिन्दी (Hindi)</option>
                  <option value="en-IN">English (Indian)</option>
                  <option value="or-IN">ଓଡ଼ିଆ (Odia)</option>
                  <option value="bn-IN">বাংলা (Bengali)</option>
                  <option value="mr-IN">मराठी (Marathi)</option>
                  <option value="te-IN">తెలుగు (Telugu)</option>
                  <option value="ta-IN">தமிழ் (Tamil)</option>
                </select>
              </div>

              {/* Clean, Modern, Professional Alert Message Card */}
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/60 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 p-4 sm:p-5 shadow-xs space-y-3.5 animate-in fade-in transition-all">
                {/* Header & Title with Active Badge */}
                <div className="flex items-start justify-between gap-2 border-b border-emerald-100 dark:border-emerald-800/50 pb-2.5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
                      {lastResponse ? '✅ अलर्ट सक्रिय संदेश (Dispatched Alert)' : '📋 संदेश पूर्वावलोकन (Alert Preview)'}
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>🔔 Your SchemeNavigator Alerts Are Active</span>
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Active</span>
                  </span>
                </div>

                {/* Short Introductory Message */}
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  You’ll now receive timely updates about your government-scheme journey:
                </p>

                {/* Three Notification Benefits */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-800/90 border border-emerald-100 dark:border-slate-700/80 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <span className="text-sm">🎯</span>
                      <span>New Matches</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                      Get notified when a government scheme relevant to your profile is found.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-800/90 border border-emerald-100 dark:border-slate-700/80 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <span className="text-sm">⏰</span>
                      <span>Deadline Alerts</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                      Receive timely reminders before important application deadlines.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-800/90 border border-emerald-100 dark:border-slate-700/80 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <span className="text-sm">📋</span>
                      <span>Application Updates</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                      Get updates related to government schemes you are tracking.
                    </p>
                  </div>
                </div>

                {/* WhatsApp & SMS Delivery Information */}
                <div className="flex items-center gap-2 pt-1 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                  <span className="text-sm">📱</span>
                  <span>Notifications will be sent through WhatsApp and SMS.</span>
                </div>

                {/* Short Closing Tagline */}
                <div className="pt-2 border-t border-emerald-100/80 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400 italic">
                    Stay informed. Never miss an opportunity.
                  </span>
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-400">
                    — Team SchemeNavigator
                  </span>
                </div>

                {/* 1-Click WhatsApp Action Button when dispatched */}
                {lastResponse?.whatsapp_web_url && (
                  <div className="pt-2">
                    <a
                      href={lastResponse.whatsapp_web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp पर खोलें (Open in WhatsApp)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Logs Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>हाल ही में भेजे गए अलर्ट्स ({logs.length})</span>
                <button
                  onClick={loadLogs}
                  disabled={loadingLogs}
                  className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>रिफ्रेश</span>
                </button>
              </div>

              {loadingLogs ? (
                <div className="py-12 text-center text-slate-400 text-xs">लोड हो रहा है...</div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  अभी तक कोई संदेश नहीं भेजा गया है। "परीक्षण संदेश भेजें" दबाकर चेक करें।
                </div>
              ) : (
                logs.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                        {item.channel === 'whatsapp' ? (
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                        )}
                        <span className="uppercase text-[11px]">{item.channel}</span>
                        <span className="text-slate-400 font-mono text-[10px]">({item.recipient})</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          item.status === 'sent' || item.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : item.status === 'simulated'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <p className="text-slate-800 dark:text-slate-200 font-semibold">{item.title}</p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] whitespace-pre-line line-clamp-3">
                      {item.message}
                    </p>
                    <p className="text-slate-400 text-[10px] font-mono">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>सुरक्षित एवं निःशुल्क • Cancel anytime</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {activeTab === 'settings' && (
              <button
                type="button"
                onClick={handleSendTestNotification}
                disabled={isSending || isSaving}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-pulse' : ''}`} />
                <span>{isSending ? 'भेजा जा रहा है...' : (initialScheme ? 'गाइड भेजें (Send Guide)' : 'परीक्षण संदेश (Send Test)')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSavePreferences}
              disabled={isSaving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaving ? 'सहेजा जा रहा है...' : 'सेटिंग्स सहेजें (Save Preferences)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
