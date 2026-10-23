import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ListTodo,
  Bookmark,
  Compass,
  Store,
  MapPin,
  Bell,
} from 'lucide-react';
import { Scheme } from '../types';
import {
  getTrackerItems,
  getSavedSchemes,
  addSchemeToTracker,
  updateTrackerStatus,
  getSavedProfile,
} from '../services/storageService';
import { GuidanceTracker } from '../components/dashboard/GuidanceTracker';
import { KendraFinderModal } from '../components/kendra/KendraFinderModal';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/appStore';
import { api } from '../services/api';

export const TrackerPage: React.FC = () => {
  const { t } = useTranslation();
  const { openNotificationModal } = useAppStore();
  const [trackerItems, setTrackerItems] = useState(() => getTrackerItems());
  const [savedSchemes, setSavedSchemes] = useState<Scheme[]>(() => getSavedSchemes());
  const [profile, setProfile] = useState(() => getSavedProfile());
  const [isKendraModalOpen, setIsKendraModalOpen] = useState(false);

  const refreshData = () => {
    setTrackerItems(getTrackerItems());
    setSavedSchemes(getSavedSchemes());
    setProfile(getSavedProfile());
  };

  useEffect(() => {
    api.getApplications(true).catch(() => {});
    api.getSavedSchemes(true).catch(() => {});

    const handleSync = () => {
      refreshData();
      api.getApplications().catch(() => {});
      api.getSavedSchemes().catch(() => {});
    };

    window.addEventListener('sn_tracker_updated', refreshData);
    window.addEventListener('sn_saved_updated', refreshData);
    window.addEventListener('sn_auth_updated', handleSync);
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      window.removeEventListener('sn_tracker_updated', refreshData);
      window.removeEventListener('sn_saved_updated', refreshData);
      window.removeEventListener('sn_auth_updated', handleSync);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, []);

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
        updateTrackerStatus(
          schemeId,
          partialOrFull.name || 'Scheme',
          partialOrFull.category,
          'Exploring'
        );
      }
    }
    refreshData();
  };

  // Untracked saved schemes that can be quick-added
  const trackedIds = trackerItems.map((t) => t.schemeId);
  const untrackedSaved = savedSchemes.filter(
    (s) => !trackedIds.includes(s.id) && (!s.slug || !trackedIds.includes(s.slug))
  );

  return (
    <div className="bg-slate-50/80 dark:bg-slate-950 min-h-screen py-6 sm:py-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center shadow-2xs">
                <ListTodo className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {t('tracker.title', undefined, 'Application Guidance Tracker')}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'tracker.subtitle',
                    undefined,
                    'Organize required documents, track application milestones, and access official government portals.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              to="/saved"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>View Saved Schemes ({savedSchemes.length})</span>
            </Link>

            <button
              type="button"
              onClick={() => openNotificationModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>WhatsApp & SMS अलर्ट्स</span>
            </button>

            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Compass className="w-4 h-4 text-emerald-300" />
              <span>Explore More Schemes</span>
            </Link>
          </div>
        </div>

        {/* Quick Add from Saved Schemes Strip if there are untracked saved schemes */}
        {untrackedSaved.length > 0 && (
          <div className="bg-teal-50/70 dark:bg-slate-900/90 border border-teal-200/80 dark:border-slate-800 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                Add from Your Saved Schemes:
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You have {untrackedSaved.length} saved scheme{untrackedSaved.length > 1 ? 's' : ''} not yet in your tracker.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {untrackedSaved.slice(0, 3).map((scheme) => (
                <button
                  key={scheme.id || scheme.slug}
                  type="button"
                  onClick={() => handleDropScheme(scheme)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-teal-700 hover:text-white dark:hover:bg-teal-600 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer truncate max-w-[180px]"
                  title={`Track ${scheme.name}`}
                >
                  + {scheme.name}
                </button>
              ))}
              {untrackedSaved.length > 3 && (
                <Link
                  to="/saved"
                  className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline pl-1"
                >
                  +{untrackedSaved.length - 3} more
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Main Guidance Tracker Component */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <GuidanceTracker
            items={trackerItems}
            onRefresh={refreshData}
            onDropScheme={handleDropScheme}
          />
        </div>

        {/* Offline Assistance & Kendra Finder Card */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-950 rounded-3xl p-6 sm:p-7 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Store className="w-3.5 h-3.5" />
              <span>Offline Assistance • CSC / e-Mitra / MeeSeva Locator</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              Need In-Person Help with Your Applications?
            </h3>
            <p className="text-xs sm:text-sm text-teal-100/90 leading-relaxed">
              Find verified Common Service Centers near {profile?.state ? profile.state : 'your location'} for biometric e-KYC, Aadhaar authentication, and direct physical scheme application assistance.
            </p>
          </div>

          <div className="flex items-center gap-3 relative z-10 shrink-0">
            <button
              type="button"
              onClick={() => setIsKendraModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer hover:scale-102"
            >
              <MapPin className="w-4 h-4" />
              <span>Locate Nearby Kendras</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kendra Locator Modal */}
      <KendraFinderModal
        isOpen={isKendraModalOpen}
        onClose={() => setIsKendraModalOpen(false)}
      />
    </div>
  );
};
