import React, { useState, useEffect, useRef } from 'react';
import {
  getSavedProfile,
  getSavedSchemeIds,
  getSavedSchemes,
  getTrackerItems,
  getAuthUser,
  addSchemeToTracker,
  updateTrackerStatus,
  calculateProfileCompletion,
} from '../services/storageService';
import { api } from '../services/api';
import { Scheme } from '../types';
import { GuidanceTracker } from '../components/dashboard/GuidanceTracker';
import { SavedSchemesManager } from '../components/dashboard/SavedSchemesManager';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/appStore';
import { transliterateName } from '../utils/nameTransliterator';
import {
  Compass,
  Bookmark,
  Clock,
  CheckCircle2,
  PlusCircle,
  Store,
  MapPin,
  Sparkles,
  ArrowRight,
  Bot,
  FileText,
  Printer,
  ChevronRight,
  Check,
  X,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { KendraFinderModal } from '../components/kendra/KendraFinderModal';

type DashboardTab = 'overview' | 'tracker' | 'saved' | 'kendra' | 'ai';

export const DashboardPage: React.FC = () => {
  const { t, tp, tState, tOccupation, langCode } = useTranslation();
  const { totalSchemesCount, openNotificationModal } = useAppStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [profile, setProfile] = useState(getSavedProfile());
  const [, setSavedIds] = useState(getSavedSchemeIds());
  const [savedSchemes, setSavedSchemes] = useState<Scheme[]>(() => getSavedSchemes());
  const [trackerItems, setTrackerItems] = useState(getTrackerItems());
  const [authUser, setAuthUser] = useState(getAuthUser());
  const [totalCatalogCount, setTotalCatalogCount] = useState<number>(totalSchemesCount || 4732);
  const [draggedScheme, setDraggedScheme] = useState<Scheme | null>(null);
  const [isKendraModalOpen, setIsKendraModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [trackerFilter, setTrackerFilter] = useState<string>('ALL');

  const trackerRef = useRef<HTMLDivElement>(null);
  const [isFloatingDropOver, setIsFloatingDropOver] = useState(false);

  // Sync total count if store updates during render without cascading effect
  const [prevTotalSchemes, setPrevTotalSchemes] = useState(totalSchemesCount);
  if (totalSchemesCount && totalSchemesCount !== prevTotalSchemes) {
    setPrevTotalSchemes(totalSchemesCount);
    setTotalCatalogCount(totalSchemesCount);
  }

  const refreshData = () => {
    setProfile(getSavedProfile());
    setSavedIds(getSavedSchemeIds());
    setTrackerItems(getTrackerItems());
    setAuthUser(getAuthUser());
    const stored = getSavedSchemes();
    setSavedSchemes(stored || []);
  };

  useEffect(() => {
    api.getSavedSchemes(true).catch(() => {});
    api.getApplications(true).catch(() => {});

    const handleSync = () => {
      refreshData();
      api.getSavedSchemes().catch(() => {});
      api.getApplications().catch(() => {});
    };

    window.addEventListener('sn_saved_updated', refreshData);
    window.addEventListener('sn_profile_updated', refreshData);
    window.addEventListener('sn_tracker_updated', refreshData);
    window.addEventListener('sn_auth_updated', handleSync);
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    api
      .getSchemes({ page: 1 })
      .then((res) => {
        if (res?.pagination?.total) {
          setTotalCatalogCount(res.pagination.total);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('sn_saved_updated', refreshData);
      window.removeEventListener('sn_profile_updated', refreshData);
      window.removeEventListener('sn_tracker_updated', refreshData);
      window.removeEventListener('sn_auth_updated', handleSync);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, []);

  // Window edge auto-scroll when dragging
  useEffect(() => {
    if (!draggedScheme) return;

    let animId: number | null = null;
    let scrollSpeed = 0;

    const scrollLoop = () => {
      if (scrollSpeed !== 0) {
        window.scrollBy(0, scrollSpeed);
      }
      animId = requestAnimationFrame(scrollLoop);
    };
    animId = requestAnimationFrame(scrollLoop);

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      const edgeSize = 140;
      if (e.clientY < edgeSize) {
        scrollSpeed = -Math.max(8, Math.round(((edgeSize - e.clientY) / edgeSize) * 22));
      } else if (e.clientY > window.innerHeight - edgeSize) {
        scrollSpeed = Math.max(8, Math.round(((e.clientY - (window.innerHeight - edgeSize)) / edgeSize) * 22));
      } else {
        scrollSpeed = 0;
      }
    };

    const handleWindowDragEnd = () => {
      scrollSpeed = 0;
      if (animId) cancelAnimationFrame(animId);
      setDraggedScheme(null);
      setIsFloatingDropOver(false);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragend', handleWindowDragEnd);
    window.addEventListener('drop', handleWindowDragEnd);

    return () => {
      scrollSpeed = 0;
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragend', handleWindowDragEnd);
      window.removeEventListener('drop', handleWindowDragEnd);
    };
  }, [draggedScheme]);

  const handleDragStart = (scheme: Scheme) => {
    setDraggedScheme(scheme);
    setActiveTab('tracker');
    setTimeout(() => {
      trackerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const handleDragEnd = () => {
    setDraggedScheme(null);
    setIsFloatingDropOver(false);
  };

  const handleDropScheme = (partialOrFull: Scheme) => {
    const schemeId = partialOrFull.id || partialOrFull.slug;
    if (!schemeId) return;

    if (partialOrFull.name && partialOrFull.name !== 'undefined') {
      addSchemeToTracker(partialOrFull, 'Exploring');
    } else {
      const fullScheme = savedSchemes.find((s) => s.id === schemeId || s.slug === schemeId);
      if (fullScheme) {
        addSchemeToTracker(fullScheme, 'Exploring');
      } else {
        updateTrackerStatus(schemeId, partialOrFull.name || 'Scheme', partialOrFull.category, 'Exploring');
      }
    }
    refreshData();
    setDraggedScheme(null);
    setIsFloatingDropOver(false);
  };

  // Profile readiness score & missing signals
  const completionPercent = calculateProfileCompletion(profile);

  const missingSignals: { label: string; boost: number; key: string }[] = [];
  if (!profile?.incomeRange) missingSignals.push({ label: '+ Add Family Income', boost: 15, key: 'income' });
  if (!profile?.category) missingSignals.push({ label: '+ Add Social Category', boost: 10, key: 'category' });
  if (!profile?.employmentType) missingSignals.push({ label: '+ Add Occupation', boost: 10, key: 'occupation' });
  if (!profile?.areaType) missingSignals.push({ label: '+ Add Residence Area', boost: 5, key: 'area' });

  // Filtered lists based on status
  const filteredSavedSchemes = savedSchemes.filter((s) => Boolean(s));

  const filteredTrackerItems = trackerItems.filter((item) => {
    return trackerFilter === 'ALL' || item.status === trackerFilter;
  });

  // Category counts for the interactive sector distribution
  const sectorCategories = [
    { name: 'Agriculture', label: 'Agriculture & Farming', icon: '🌾', count: 12 },
    { name: 'Education', label: 'Education & Scholarships', icon: '🎓', count: 9 },
    { name: 'Health', label: 'Health & Medical', icon: '🏥', count: 7 },
    { name: 'Business', label: 'Business & MSME', icon: '💼', count: 5 },
    { name: 'Women & Child', label: 'Women & Child', icon: '👩‍👧', count: 8 },
    { name: 'Social Welfare', label: 'Social Welfare & Pensions', icon: '🛡️', count: 11 },
  ];

  // Quick Mitra AI prompts
  const aiPrompts = [
    `Which schemes are best for a ${profile?.employmentType || 'citizen'} in ${profile?.state || 'India'}?`,
    'What documents are needed for PM Kisan and DBT subsidies?',
    'How do I check application status at a CSC Kendra?',
    'What scholarships can college students apply for this session?',
  ];

  return (
    <div className="bg-slate-50/80 dark:bg-slate-950 min-h-screen py-6 sm:py-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Header & Greeting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 text-xs font-bold border border-emerald-300/80 dark:border-emerald-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('dashboard.title', undefined, 'Citizen Command Center')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
              {t('dashboard.welcome', undefined, 'Welcome back,')} {transliterateName(authUser?.name || profile?.name, langCode) || t('common.citizen')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl font-normal">
              {t('dashboard.subtitle', undefined, 'Manage your personal profile signals, bookmarked schemes, and application progress.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsChecklistModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{tp('Print Checklist')}</span>
            </button>

            <Link
              to="/recommendations"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-800 to-slate-950 hover:from-teal-900 hover:to-slate-900 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              <Compass className="w-4 h-4 text-emerald-300" />
              <span>{t('dashboard.view_recs_btn', undefined, 'View Recommendations')}</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-200" />
            </Link>
          </div>
        </div>

        {/* Interactive View Navigation Tabs */}
        <div className="w-full bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-teal-800 to-slate-950 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{tp('Overview & Readiness')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'tracker'
                ? 'bg-gradient-to-r from-teal-800 to-slate-950 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{tp('Application Pipeline')}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'tracker' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
              {trackerItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-gradient-to-r from-teal-800 to-slate-950 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>{t('dashboard.savedTitle', undefined, 'Saved Schemes')}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'saved' ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'}`}>
              {savedSchemes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kendra')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'kendra'
                ? 'bg-gradient-to-r from-teal-800 to-slate-950 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>{tp('CSC Kendra Locator')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-teal-800 to-slate-950 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>{t('nav.askMitra', undefined, 'Ask Mitra AI')}</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & READINESS */}
        {(activeTab === 'overview' || activeTab === 'tracker' || activeTab === 'saved') && (
          <>
            {/* WhatsApp & SMS Notification Alert Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bell className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      WhatsApp एवं SMS अलर्ट सेवा (Citizen Mobile Notifications)
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                    योजना स्थिति अपडेट, आवेदन अंतिम तिथियां और नए लाभ सीधे अपने फोन पर प्राप्त करें।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => openNotificationModal()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>अलर्ट सेटिंग्स (Configure Alerts)</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.stat_matches', undefined, 'Available Schemes')}</span>
                  <Compass className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {totalCatalogCount.toLocaleString('en-IN')}+
                </div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium block">
                  {t('dashboard.stat_matches_sub', undefined, 'Live verified initiatives')}
                </span>
              </div>

              <div
                onClick={() => setActiveTab('saved')}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all space-y-1 group cursor-pointer block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    {t('dashboard.stat_saved', undefined, 'Saved Schemes')}
                  </span>
                  <Bookmark className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {savedSchemes.length}
                </div>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium block">
                  Click to manage saved &rarr;
                </span>
              </div>

              <div
                onClick={() => setActiveTab('tracker')}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-md transition-all space-y-1 group cursor-pointer block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                    {t('dashboard.stat_milestones', undefined, 'Application Pipeline')}
                  </span>
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {trackerItems.length}
                </div>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium block">
                  Click to view milestones &rarr;
                </span>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.stat_profile_status', undefined, 'Readiness Score')}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {completionPercent}%
                </div>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium block">
                  {completionPercent >= 80 ? 'Calibrated for high precision' : 'Calibration boost available'}
                </span>
              </div>
            </div>

            {/* Interactive Citizen Readiness Score & Calibration Booster */}
            <div className="bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-teal-800/40 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-teal-800/90 border border-teal-500/50 text-emerald-300 text-xs font-bold">
                      {tp('Citizen Calibration Engine')}
                    </span>
                    {completionPercent >= 80 ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">
                        {tp('High Accuracy')}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/40">
                        {tp('Add Signals to Improve Match')}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    {transliterateName(profile?.name || authUser?.name, langCode) || t('common.citizen')} ({profile?.age || 20} {t('common.yrs', undefined, 'Yrs')} • {profile?.gender ? tp(profile.gender.toUpperCase()) : tp('MALE')})
                  </h2>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-teal-100/90 font-medium">
                    <span className="bg-teal-900/60 px-3 py-1 rounded-xl border border-teal-700/50">
                      📍 {profile?.state ? tState(profile.state) : tState('Haryana')} ({tp(profile?.areaType || 'Urban')})
                    </span>
                    <span className="bg-teal-900/60 px-3 py-1 rounded-xl border border-teal-700/50">
                      💼 {tOccupation(profile?.employmentType || 'Student')}
                    </span>
                    <span className="bg-teal-900/60 px-3 py-1 rounded-xl border border-teal-700/50">
                      💰 {profile?.incomeRange || '₹1–2.5 lakh'}
                    </span>
                  </div>

                  {/* Missing signals quick boosters */}
                  {missingSignals.length > 0 && (
                    <div className="pt-2">
                      <span className="text-xs text-teal-300 font-bold block mb-2">
                        Quick Calibration Boosters (Click to add):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {missingSignals.map((sig, idx) => (
                          <Link
                            key={idx}
                            to="/survey"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-800/80 hover:bg-emerald-600 hover:text-slate-950 border border-teal-600/50 text-emerald-300 text-xs font-bold transition-all shadow-xs"
                          >
                            <span>{sig.label}</span>
                            <span className="px-1.5 py-0.2 bg-teal-950/60 rounded text-[10px]">+{sig.boost}%</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Circular / Visual Gauge Card */}
                <div className="bg-teal-900/40 backdrop-blur-md p-5 rounded-2xl border border-teal-700/50 flex flex-col items-center gap-3 shrink-0 text-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-teal-950/80"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-400 transition-all duration-1000"
                        strokeDasharray={`${completionPercent}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-white">{completionPercent}%</span>
                      <span className="text-[9px] text-teal-300 font-bold uppercase">Ready</span>
                    </div>
                  </div>

                  <Link
                    to="/survey"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
                  >
                    <span>Update Survey</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Interactive Sector Radar / Category Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Explore Schemes by Welfare Category
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Instant filter into curated schemes calibrated for your profile
                  </p>
                </div>
                <Link
                  to="/explore"
                  className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
                >
                  <span>Explore All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {sectorCategories.map((cat, idx) => (
                  <Link
                    key={idx}
                    to={`/explore?category=${encodeURIComponent(cat.name)}`}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200/80 dark:border-slate-700/80 hover:border-teal-400 dark:hover:border-teal-600 transition-all duration-200 text-center space-y-1.5 group"
                  >
                    <div className="text-2xl">{cat.icon}</div>
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-teal-900 dark:group-hover:text-teal-300 truncate">
                      {cat.name}
                    </div>
                    <span className="inline-block text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                      Explore &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: APPLICATION PIPELINE / TRACKER */}
        {(activeTab === 'overview' || activeTab === 'tracker') && (
          <div ref={trackerRef} className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <span>{t('dashboard.trackerTitle', undefined, 'Application Guidance & Milestone Pipeline')}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track stages from document preparation to submission and official benefit disbursal
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1">
                {['ALL', 'Exploring', 'Documents Needed', 'Ready to Apply', 'Applied Externally', 'Completed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTrackerFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      trackerFilter === st
                        ? 'bg-teal-800 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {st === 'ALL' ? `All (${trackerItems.length})` : st}
                  </button>
                ))}
              </div>
            </div>

            <GuidanceTracker
              items={filteredTrackerItems}
              onRefresh={refreshData}
              isDragActive={draggedScheme !== null}
              onDropScheme={handleDropScheme}
            />
          </div>
        )}

        {/* TAB 3: SAVED SCHEMES */}
        {(activeTab === 'overview' || activeTab === 'saved') && (
          <div id="saved" className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <SavedSchemesManager
              schemes={filteredSavedSchemes}
              trackedSchemeIds={trackerItems.map((t) => t.schemeId)}
              onRefresh={refreshData}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        )}

        {/* TAB 4: KENDRA OFFLINE ASSISTANCE */}
        {(activeTab === 'overview' || activeTab === 'kendra') && (
          <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-2 max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                <Store className="w-3.5 h-3.5" />
                <span>Offline Assistance • CSC / e-Mitra / MeeSeva Locator</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                Nearest Kendra Finder (CSC / e-Mitra Locator)
              </h3>

              <p className="text-xs sm:text-sm text-teal-100/90 leading-relaxed">
                Find verified Common Service Centers near {profile?.state ? profile.state : 'your location'} for in-person biometric e-KYC, Aadhaar authentication, and direct scheme application assistance.
              </p>
            </div>

            <div className="flex items-center gap-3 relative z-10 shrink-0">
              <button
                type="button"
                onClick={() => setIsKendraModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer hover:scale-102 active:scale-95"
              >
                <MapPin className="w-4 h-4" />
                <span>Locate Nearby Kendras</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: MITRA AI ADVISOR CARD */}
        {(activeTab === 'overview' || activeTab === 'ai') && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-700 to-slate-950 text-white flex items-center justify-center shadow-md shrink-0">
                <Bot className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Mitra AI Citizen Advisor</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                    24/7 Active
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ask questions about eligibility criteria, mandatory documents, or upcoming deadlines
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {aiPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => navigate('/assistant', { state: { initialQuery: prompt } })}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200/80 dark:border-slate-700/80 hover:border-teal-400 dark:hover:border-teal-600 transition-all text-left text-xs font-semibold text-slate-800 dark:text-slate-200 group cursor-pointer"
                >
                  <span className="truncate pr-2">💬 "{prompt}"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Drag & Drop Capsule */}
      {draggedScheme && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsFloatingDropOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsFloatingDropOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsFloatingDropOver(false);
            handleDropScheme(draggedScheme);
          }}
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-2xl border-2 flex items-center gap-3.5 transition-all duration-200 cursor-pointer ${
            isFloatingDropOver
              ? 'bg-teal-700 text-white border-teal-300 scale-105 ring-4 ring-teal-400/50 shadow-teal-900/30'
              : 'bg-teal-950/95 text-teal-50 border-teal-400 shadow-xl backdrop-blur-md hover:border-teal-300'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black transition-colors ${
              isFloatingDropOver ? 'bg-white text-teal-800' : 'bg-teal-800 text-teal-200'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-black tracking-wider uppercase text-emerald-300">
              {isFloatingDropOver ? 'Release to Add Scheme' : 'Drop Anywhere Here to Track'}
            </div>
            <div className="text-xs sm:text-sm font-bold text-white max-w-xs sm:max-w-md truncate">
              {draggedScheme.name}
            </div>
          </div>
        </div>
      )}

      {/* Kendra Locator Modal */}
      <KendraFinderModal
        isOpen={isKendraModalOpen}
        onClose={() => setIsKendraModalOpen(false)}
      />

      {/* Printable Welfare Checklist Modal */}
      {isChecklistModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Citizen Welfare Application Checklist
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Printable summary of your saved schemes and required documents for CSC / Kendra visit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChecklistModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="font-extrabold text-slate-900 dark:text-white">
                Applicant: {profile?.name || 'Citizen'} ({profile?.age || 20} Yrs • {profile?.gender || 'Male'})
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                State: {profile?.state || 'Not specified'} • Area: {profile?.areaType || 'Urban'} • Occupation: {profile?.employmentType || 'Student'}
              </div>
            </div>

            {/* Saved Schemes List */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Saved Schemes ({savedSchemes.length})
              </h4>
              {savedSchemes.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No saved schemes yet. Bookmark schemes to include them here.</p>
              ) : (
                <ul className="space-y-2">
                  {savedSchemes.map((s, i) => (
                    <li key={i} className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{s.name}</span>
                        <span className="text-[11px] text-teal-700 dark:text-teal-400 block">{s.category}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-[10px] font-extrabold text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                        {s.level || 'Central'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Standard CSC Documents Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Mandatory Physical Documents to Carry to Kendra:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  'Aadhaar Card (Original + Copy)',
                  'Bank Account Passbook / Cancelled Cheque',
                  'Income Certificate / Ration Card',
                  'Domicile / Residence Certificate',
                  'Caste / Category Certificate (if applicable)',
                  'Recent Passport-size Photographs (x2)',
                ].map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsChecklistModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document Summary</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
