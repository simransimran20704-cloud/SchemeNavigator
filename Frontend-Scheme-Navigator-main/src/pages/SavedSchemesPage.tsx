import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  ArrowRight,
  Search,
  CheckCircle2,
  Calendar,
  Compass,
  ListTodo,
  Trash2,
  Plus,
} from 'lucide-react';
import { Scheme } from '../types';
import {
  getSavedSchemes,
  getTrackerItems,
  toggleSaveScheme,
  addSchemeToTracker,
  removeSavedScheme,
} from '../services/storageService';
import { useTranslation } from '../hooks/useTranslation';
import { StatusPill } from '../components/common/StatusPill';
import { YojanaCalendarModal } from '../components/calendar/YojanaCalendarModal';
import { YojanaCalendarBanner } from '../components/calendar/YojanaCalendarBanner';
import { translateSchemeTitle } from '../utils/schemeTranslator';

import { api } from '../services/api';
import { useAppStore } from '../store/appStore';

export const SavedSchemesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, tp, langCode } = useTranslation();
  const {
    savedSchemes: storeSavedSchemes,
    applications: storeTrackerItems,
    authUser,
    openAuthModal,
  } = useAppStore();
  const [isGuestBannerDismissed, setIsGuestBannerDismissed] = useState(false);
  const [savedSchemes, setSavedSchemes] = useState<Scheme[]>(() => {
    const fromStore = storeSavedSchemes && storeSavedSchemes.length > 0 ? storeSavedSchemes : [];
    return fromStore.length > 0 ? fromStore : getSavedSchemes();
  });
  const [trackerItems, setTrackerItems] = useState(() => {
    const fromStore = storeTrackerItems && storeTrackerItems.length > 0 ? storeTrackerItems : [];
    return fromStore.length > 0 ? fromStore : getTrackerItems();
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Sync store updates during render without cascading effect
  const [prevStoreSaved, setPrevStoreSaved] = useState(storeSavedSchemes);
  if (storeSavedSchemes !== prevStoreSaved) {
    setPrevStoreSaved(storeSavedSchemes);
    if (Array.isArray(storeSavedSchemes)) {
      setSavedSchemes(storeSavedSchemes);
    }
  }

  const [prevStoreTrack, setPrevStoreTrack] = useState(storeTrackerItems);
  if (storeTrackerItems !== prevStoreTrack) {
    setPrevStoreTrack(storeTrackerItems);
    if (Array.isArray(storeTrackerItems)) {
      setTrackerItems(storeTrackerItems);
    }
  }

  const refreshData = () => {
    const localSaved = getSavedSchemes();
    const localTrack = getTrackerItems();
    setSavedSchemes(localSaved);
    setTrackerItems(localTrack);
  };

  useEffect(() => {
    api.getSavedSchemes(true).then((remote) => {
      if (remote && Array.isArray(remote)) {
        setSavedSchemes(remote);
      }
    }).catch(() => {});

    const handleAuthOrFocus = () => {
      refreshData();
      api.getSavedSchemes().then((remote) => {
        if (remote && Array.isArray(remote)) {
          setSavedSchemes(remote);
        }
      }).catch(() => {});
    };

    window.addEventListener('sn_saved_updated', refreshData);
    window.addEventListener('sn_tracker_updated', refreshData);
    window.addEventListener('sn_auth_updated', handleAuthOrFocus);
    window.addEventListener('focus', handleAuthOrFocus);
    document.addEventListener('visibilitychange', handleAuthOrFocus);

    return () => {
      window.removeEventListener('sn_saved_updated', refreshData);
      window.removeEventListener('sn_tracker_updated', refreshData);
      window.removeEventListener('sn_auth_updated', handleAuthOrFocus);
      window.removeEventListener('focus', handleAuthOrFocus);
      document.removeEventListener('visibilitychange', handleAuthOrFocus);
    };
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRemove = (scheme: Scheme, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    removeSavedScheme(scheme);
    const sid = String(scheme.id || '').toLowerCase();
    const ssl = String(scheme.slug || '').toLowerCase();
    setSavedSchemes((prev) =>
      prev.filter((s) => {
        const k1 = String(s.id || '').toLowerCase();
        const k2 = String(s.slug || '').toLowerCase();
        if (sid && (k1 === sid || k2 === sid)) return false;
        if (ssl && (k1 === ssl || k2 === ssl)) return false;
        return true;
      })
    );
    showToast('Scheme removed from saved list');
  };

  const handleAddToTracker = (scheme: Scheme, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    addSchemeToTracker(scheme, 'Exploring');
    refreshData();
    showToast(`"${scheme.name}" added to Application Tracker`);
  };

  const trackedSchemeIds = trackerItems.map((item) => item.schemeId);

  // Categories present in saved schemes
  const categories = Array.from(new Set(savedSchemes.map((s) => s.category).filter(Boolean)));

  const filteredSchemes = savedSchemes.filter((scheme) => {
    if (!scheme) return false;
    const name = (scheme.name || scheme.id || scheme.slug || '').toLowerCase();
    const shortDesc = (scheme.shortDescription || (scheme as any)?.description || '').toLowerCase();
    const cat = (scheme.category || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      name.includes(q) ||
      shortDesc.includes(q) ||
      cat.includes(q);
    const matchesCat = selectedCategory === 'all' || scheme.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="bg-slate-50/80 dark:bg-slate-950 min-h-screen py-6 sm:py-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed top-20 right-6 z-50 bg-teal-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-teal-700 flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-2xs">
                <Bookmark className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {t('saved.title', undefined, 'Saved Schemes')}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'saved.subtitle',
                    undefined,
                    'View and manage your shortlisted government schemes in one place.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Yojana Calendar</span>
            </button>

            <Link
              to="/tracker"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs transition-colors"
            >
              <ListTodo className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Go to Application Tracker</span>
              {trackerItems.length > 0 && (
                <span className="px-1.5 py-0.5 bg-teal-700 text-white rounded-full text-[10px] font-black">
                  {trackerItems.length}
                </span>
              )}
            </Link>

            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Compass className="w-4 h-4 text-emerald-300" />
              <span>Explore More Schemes</span>
            </Link>
          </div>
        </div>

        {/* Guest Mode Informational Banner */}
        {!authUser?.isLoggedIn && !isGuestBannerDismissed && savedSchemes.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Bookmark className="w-4 h-4 fill-current" />
              </div>
              <div>
                <span className="font-bold text-amber-950 dark:text-amber-200 block">
                  Guest Mode: Schemes are saved locally on this device
                </span>
                <span className="text-amber-800/90 dark:text-amber-300/80">
                  To access these saved schemes across your phone and laptop, sign in with your email or continue as guest.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Sign In to Sync
              </button>
              <button
                type="button"
                onClick={() => setIsGuestBannerDismissed(true)}
                className="px-2.5 py-1.5 text-amber-800 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 rounded-xl font-semibold transition-colors cursor-pointer"
              >
                Keep Local
              </button>
            </div>
          </div>
        )}

        {/* Deadline Urgency Banner */}
        {savedSchemes.length > 0 && (
          <YojanaCalendarBanner
            schemes={savedSchemes}
            onOpenCalendar={() => setIsCalendarModalOpen(true)}
            title="Saved Schemes Deadline Urgency Alerts"
          />
        )}

        {/* Search & Category Filter Bar */}
        {savedSchemes.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search saved schemes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All ({savedSchemes.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat} ({savedSchemes.filter((s) => s.category === cat).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {savedSchemes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-14 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto shadow-2xs">
              <Bookmark className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('saved.empty_title', undefined, 'No Saved Schemes Yet')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t(
                'saved.empty_desc',
                undefined,
                'When you browse schemes, tap the bookmark icon on any scheme card to save it here for quick access later.'
              )}
            </p>
            <div className="pt-2">
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                <span>{t('dashboard.explore_all_btn', undefined, 'Explore All Schemes')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : filteredSchemes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center space-y-2 border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No saved schemes match your search or filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="text-xs text-teal-700 dark:text-teal-400 font-bold hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Scheme Cards Grid - ONLY Saved Schemes */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredSchemes.map((scheme) => {
              const isTracked =
                trackedSchemeIds.includes(scheme.id) ||
                (scheme.slug ? trackedSchemeIds.includes(scheme.slug) : false);

              const schemeKey = scheme.slug || scheme.id;

              return (
                <div
                  key={schemeKey}
                  onClick={() => navigate(`/schemes/${schemeKey}`)}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/schemes/${schemeKey}`);
                    }
                  }}
                >
                  <div className="space-y-3">
                    {/* Top Row: Category pill & remove bookmark button */}
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill type="category" value={scheme.category || 'Social Welfare'} />
                      <button
                        type="button"
                        onClick={(e) => handleRemove(scheme, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Remove from saved schemes"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Scheme Name & Description */}
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-2 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                        {translateSchemeTitle(scheme.name || scheme.id || scheme.slug || 'Government Scheme', langCode)}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mt-1.5 leading-relaxed">
                        {tp(scheme.shortDescription || (scheme as any)?.description || 'Verified government scheme details and application guidelines.')}
                      </p>
                    </div>

                    {/* Level / Ministry badge if available */}
                    {scheme.level && (
                      <span className="inline-block text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {tp(scheme.level)} {tp('Scheme')}
                      </span>
                    )}
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <Link
                      to={`/schemes/${schemeKey}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 hover:underline"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    {isTracked ? (
                      <Link
                        to="/tracker"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60"
                        title="Already being tracked. Click to view in Tracker."
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>In Tracker</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleAddToTracker(scheme, e)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                        title="Add this scheme to your Application Guidance Tracker"
                      >
                        <Plus className="w-3.5 h-3.5 text-teal-600" />
                        <span>+ Add to Tracker</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Yojana Calendar Modal */}
      <YojanaCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        schemes={savedSchemes}
      />
    </div>
  );
};
