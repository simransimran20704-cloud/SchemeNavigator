/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, SchemeMatchResult, Scheme, TrackerItem } from '../types';
import { api } from '../services/api';
import {
  getSavedProfile,
  saveUserProfile,
  getSavedSchemeIds,
  getSavedSchemes,
  setSavedSchemesList,
  toggleSaveScheme,
  getTrackerItems,
  getCachedRecommendations,
  saveCachedRecommendations,
  getAuthUser,
  setAuthUser as storeSetAuthUser,
  logoutUser,
  AuthUser,
} from '../services/storageService';
import { TOP_INDIAN_LANGUAGES, LanguageInfo, getLanguageByCode } from '../constants/languages';
import { DEFAULT_CATEGORY_COUNTS } from '../constants';

export interface ProfileStatus {
  exists: boolean;
  isComplete: boolean;
  completionPercentage: number;
}

export interface AppState {
  totalSchemesCount: number;
  categoryCounts: Record<string, number>;
  profile: UserProfile | null;
  profileStatus: ProfileStatus;
  surveyDraft: any;
  surveyAnswers: Partial<UserProfile>;
  surveyProgress: number;
  recommendations: SchemeMatchResult[];
  selectedScheme: Scheme | null;
  savedSchemes: Scheme[];
  savedSchemeIds: string[];
  applications: TrackerItem[];
  selectedLanguage: LanguageInfo;
  isTourActive: boolean;
  theme: 'light' | 'dark';
  isVoiceReaderOpen: boolean;
  loading: boolean;
  error: string | null;

  // Auth State
  authUser: AuthUser | null;
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup';

  // Notification State
  isNotificationModalOpen: boolean;
  notificationModalScheme: Scheme | null;
  notificationModalTemplate: string;
  notificationModalData: Record<string, any>;

  // Actions
  openNotificationModal: (scheme?: Scheme | null, template?: string, data?: Record<string, any>) => void;
  closeNotificationModal: () => void;
  setProfile: (profile: Partial<UserProfile>) => void;
  setSurveyProgress: (step: number) => void;
  saveDraft: (answers: any, currentStep: number) => Promise<void>;
  submitSurvey: (profile: UserProfile) => Promise<SchemeMatchResult[]>;
  toggleBookmark: (schemeId: string) => Promise<void>;
  updateApplicationStatus: (item: TrackerItem) => Promise<void>;
  setSelectedScheme: (scheme: Scheme | null) => void;
  setSelectedLanguage: (lang: LanguageInfo | string) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  openVoiceReader: () => void;
  closeVoiceReader: () => void;
  toggleVoiceReader: () => void;
  handleCheckEligibility: (navigate: (path: string) => void) => void;
  startTour: () => void;
  stopTour: () => void;
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
  setAuthUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfileState] = useState<UserProfile | null>(() => getSavedProfile());
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>(() => {
    const saved = getSavedProfile();
    return {
      exists: !!saved,
      isComplete: Boolean(saved?.age && saved?.state),
      completionPercentage: saved ? 100 : 0,
    };
  });
  const [surveyDraft, setSurveyDraft] = useState<any>(null);
  const [surveyProgress, setSurveyProgress] = useState<number>(1);
  const [recommendations, setRecommendations] = useState<SchemeMatchResult[]>(() => getCachedRecommendations());
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  const [savedSchemeIds, setSavedSchemeIds] = useState<string[]>(() => getSavedSchemeIds());
  const [savedSchemes, setSavedSchemes] = useState<Scheme[]>(() => getSavedSchemes());
  const [applications, setApplications] = useState<TrackerItem[]>(() => getTrackerItems());
  const [authUser, setAuthUserState] = useState<AuthUser | null>(() => getAuthUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [totalSchemesCount, setTotalSchemesCount] = useState<number>(4732);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(DEFAULT_CATEGORY_COUNTS);

  // Notification Modal State
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [notificationModalScheme, setNotificationModalScheme] = useState<Scheme | null>(null);
  const [notificationModalTemplate, setNotificationModalTemplate] = useState<string>('test');
  const [notificationModalData, setNotificationModalData] = useState<Record<string, any>>({});

  const openNotificationModal = useCallback(
    (scheme: Scheme | null = null, template: string = 'test', data: Record<string, any> = {}) => {
      setNotificationModalScheme(scheme);
      setNotificationModalTemplate(template);
      setNotificationModalData(data);
      setIsNotificationModalOpen(true);
    },
    []
  );

  const closeNotificationModal = useCallback(() => {
    setIsNotificationModalOpen(false);
  }, []);

  useEffect(() => {
    const syncSaved = () => {
      setSavedSchemeIds(getSavedSchemeIds());
      setSavedSchemes(getSavedSchemes());
    };
    const syncAuth = () => {
      const u = getAuthUser();
      setAuthUserState(u);
      if (u) {
        syncBackendData();
      }
    };
    const syncTracker = () => {
      setApplications(getTrackerItems());
    };
    const syncProfile = () => {
      const p = getSavedProfile();
      setProfileState(p);
      setProfileStatus({
        exists: !!p,
        isComplete: Boolean(p?.age && p?.state),
        completionPercentage: p ? 100 : 0,
      });
    };

    window.addEventListener('sn_saved_updated', syncSaved);
    window.addEventListener('sn_auth_updated', syncAuth);
    window.addEventListener('sn_tracker_updated', syncTracker);
    window.addEventListener('sn_profile_updated', syncProfile);

    const syncBackendData = async () => {
      const user = getAuthUser();
      if (!user) return;
      try {
        const [remoteSaved, remoteProf, remoteApps] = await Promise.allSettled([
          api.getSavedSchemes(true),
          api.getProfile(),
          api.getApplications(true),
        ]);

        if (remoteSaved.status === 'fulfilled' && remoteSaved.value && Array.isArray(remoteSaved.value)) {
          setSavedSchemes(remoteSaved.value);
          setSavedSchemeIds(remoteSaved.value.map((s: Scheme) => s.id || s.slug || ''));
          setSavedSchemesList(remoteSaved.value);
        }
        if (remoteProf.status === 'fulfilled' && remoteProf.value) {
          const prof = remoteProf.value;
          setProfileState(prof);
          setProfileStatus({
            exists: true,
            isComplete: Boolean(prof.age && prof.state),
            completionPercentage: 100,
          });
        }
        if (remoteApps.status === 'fulfilled' && remoteApps.value && Array.isArray(remoteApps.value)) {
          setApplications(remoteApps.value);
        }
      } catch (err) {
        console.warn('[appStore] syncBackendData error:', err);
      }
    };

    // Immediately sync backend data if user is already logged in
    if (getAuthUser()) {
      syncBackendData();
    }

    // Sync auth with backend session if available
    api.getCurrentUser().then(async (res) => {
      if (res?.user) {
        storeSetAuthUser(res.user);
        setAuthUserState(res.user);
        await syncBackendData();
      }
    }).catch(() => {});

    // Listen for window focus and visibilitychange to sync cross-device
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && getAuthUser()) {
        syncBackendData();
      }
    };
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    // Periodic background polling to sync live data across open devices
    const pollInterval = setInterval(() => {
      if (getAuthUser() && document.visibilityState === 'visible') {
        syncBackendData();
      }
    }, 8000);

    // Dynamically fetch live scheme statistics from backend / APIMitra
    api
      .getSchemes({ limit: 1 })
      .then((res) => {
        if (res?.pagination?.total) {
          setTotalSchemesCount(res.pagination.total);
        }
        if (res?.categoryCounts && Object.keys(res.categoryCounts).length > 0) {
          setCategoryCounts(res.categoryCounts);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch real-time scheme stats:', err);
      });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('sn_saved_updated', syncSaved);
      window.removeEventListener('sn_auth_updated', syncAuth);
      window.removeEventListener('sn_tracker_updated', syncTracker);
      window.removeEventListener('sn_profile_updated', syncProfile);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, []);
  const [selectedLanguage, setSelectedLanguageState] = useState<LanguageInfo>(() => {
    try {
      const savedCode = localStorage.getItem('scheme_navigator_language');
      if (savedCode) {
        return getLanguageByCode(savedCode);
      }
    } catch {
      // ignore
    }
    return TOP_INDIAN_LANGUAGES[0];
  });
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Theme state: default to 'light' for new users, or stored preference
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('scheme_navigator_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [isVoiceReaderOpen, setIsVoiceReaderOpen] = useState<boolean>(false);

  // Apply dark class to <html> element whenever theme changes
  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('scheme_navigator_theme', theme);
    } catch (e) {
      console.warn('Theme toggle error:', e);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
  }, []);

  const startTour = useCallback(() => {
    setIsTourActive(true);
  }, []);

  const stopTour = useCallback(() => {
    setIsTourActive(false);
  }, []);

  const openVoiceReader = useCallback(() => {
    setIsVoiceReaderOpen(true);
  }, []);

  const closeVoiceReader = useCallback(() => {
    setIsVoiceReaderOpen(false);
  }, []);

  const toggleVoiceReader = useCallback(() => {
    setIsVoiceReaderOpen((prev) => !prev);
  }, []);

  const setSelectedLanguage = (lang: LanguageInfo | string) => {
    const target = typeof lang === 'string' ? getLanguageByCode(lang) : lang;
    setSelectedLanguageState(target);
    try {
      localStorage.setItem('scheme_navigator_language', target.code);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = target.code.split('-')[0] || 'en';
        document.documentElement.dir = target.code.startsWith('ur') ? 'rtl' : 'ltr';
      }
    } catch {
      // ignore
    }
    try {
      window.dispatchEvent(new CustomEvent('sn_language_updated', { detail: target }));
      window.dispatchEvent(new CustomEvent('sn_translations_updated', { detail: target }));
    } catch {
      // ignore
    }
  };

  const setProfile = (fields: Partial<UserProfile>) => {
    setProfileState((prev) => {
      const updated = { ...(prev || {}), ...fields } as UserProfile;
      saveUserProfile(updated);
      api.updateProfile(updated);
      setProfileStatus({
        exists: true,
        isComplete: Boolean(updated.age && updated.state),
        completionPercentage: 100,
      });
      return updated;
    });
  };

  const saveDraft = async (answers: any, currentStep: number) => {
    setSurveyDraft({ answers, currentStep });
    await api.saveSurveyDraft(answers, currentStep);
  };

  const submitSurvey = async (surveyProfile: UserProfile): Promise<SchemeMatchResult[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.submitSurvey(surveyProfile);
      const finalProfile = (result && result.profile) ? result.profile : surveyProfile;
      setProfileState(finalProfile);
      saveUserProfile(finalProfile);
      setProfileStatus({
        exists: true,
        isComplete: true,
        completionPercentage: 100,
      });
      setSurveyDraft(null);
      const recs = result.recommendations || [];
      setRecommendations(recs);
      saveCachedRecommendations(recs);
      return recs;
    } catch (err: any) {
      setError(err?.message || "We couldn't process your profile right now. Please try again.");
      // Even if offline/network error, persist the filled profile locally!
      setProfileState(surveyProfile);
      saveUserProfile(surveyProfile);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const toggleBookmark = async (schemeId: string, schemeObj?: Scheme) => {
    let target = schemeObj;
    if (!target) {
      try {
        target = await api.getScheme(schemeId);
      } catch {
        // ignore
      }
    }
    toggleSaveScheme(schemeId, target);
  };

  const updateApplicationStatus = async (item: TrackerItem) => {
    setApplications((prev) => {
      const idx = prev.findIndex((a) => a.schemeId === item.schemeId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [item, ...prev];
    });
    await api.updateApplication(item);
  };

  const handleCheckEligibility = useCallback(
    (navigate: (path: string) => void) => {
      const currentProf = profile || getSavedProfile();
      const hasCompleteProfile = profileStatus.isComplete || (!!currentProf?.age && !!currentProf?.state);

      if (hasCompleteProfile) {
        navigate('/recommendations');
      } else {
        navigate('/survey');
      }
    },
    [profile, profileStatus]
  );

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const setAuthUser = useCallback(async (user: AuthUser | null) => {
    storeSetAuthUser(user);
    setAuthUserState(user);
    if (user) {
      // 1. Sync Saved Schemes immediately so bookmarks appear without delay
      const syncSavedPromise = api.getSavedSchemes(true).then((remoteSaved) => {
        if (remoteSaved && Array.isArray(remoteSaved)) {
          setSavedSchemes(remoteSaved);
          setSavedSchemeIds(remoteSaved.map((s: Scheme) => s.id || s.slug || ''));
          setSavedSchemesList(remoteSaved);
        }
      }).catch((err) => console.warn('[appStore] Saved schemes sync error:', err));

      // 2. Sync Application Tracker immediately
      const syncAppsPromise = api.getApplications(true).then((remoteApps) => {
        if (remoteApps && Array.isArray(remoteApps)) {
          setApplications(remoteApps);
        }
      }).catch((err) => console.warn('[appStore] Tracker sync error:', err));

      // 3. Sync User Profile and Recommendations concurrently
      const syncProfilePromise = (async () => {
        try {
          const localProf = getSavedProfile();
          const remoteProf = await api.getProfile();

          let activeProf = remoteProf;
          if (!remoteProf && localProf && (localProf.age || localProf.state)) {
            activeProf = await api.updateProfile(localProf);
          } else if (remoteProf) {
            saveUserProfile(remoteProf, false);
          }

          if (activeProf) {
            setProfileState(activeProf);
            setProfileStatus({
              exists: true,
              isComplete: Boolean(activeProf.age && activeProf.state),
              completionPercentage: 100,
            });
            try {
              const surveyRes = await api.submitSurvey(activeProf);
              if (surveyRes?.recommendations) {
                setRecommendations(surveyRes.recommendations);
                saveCachedRecommendations(surveyRes.recommendations);
              }
            } catch {
              // fallback
            }
          }
        } catch (err) {
          console.warn('[appStore] Profile sync error:', err);
        }
      })();

      await Promise.allSettled([syncSavedPromise, syncAppsPromise, syncProfilePromise]);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    logoutUser();
    setAuthUserState(null);
    setProfileState(null);
    setProfileStatus({
      exists: false,
      isComplete: false,
      completionPercentage: 0,
    });
    setRecommendations([]);
    setSavedSchemes([]);
    setSavedSchemeIds([]);
    setSavedSchemesList([]);
    setApplications([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        totalSchemesCount,
        categoryCounts,
        profile,
        profileStatus,
        surveyDraft,
        surveyAnswers: profile || {},
        surveyProgress,
        recommendations,
        selectedScheme,
        savedSchemes,
        savedSchemeIds,
        applications,
        selectedLanguage,
        isTourActive,
        theme,
        isVoiceReaderOpen,
        loading,
        error,
        authUser,
        isAuthModalOpen,
        authModalMode,
        isNotificationModalOpen,
        notificationModalScheme,
        notificationModalTemplate,
        notificationModalData,
        openNotificationModal,
        closeNotificationModal,
        setProfile,
        setSurveyProgress,
        saveDraft,
        submitSurvey,
        toggleBookmark,
        updateApplicationStatus,
        setSelectedScheme,
        setSelectedLanguage,
        toggleTheme,
        setTheme,
        openVoiceReader,
        closeVoiceReader,
        toggleVoiceReader,
        handleCheckEligibility,
        startTour,
        stopTour,
        openAuthModal,
        closeAuthModal,
        setAuthUser,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = (): AppState => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
