import React, { useState, useEffect, useMemo } from 'react';
import { getSavedProfile, getCachedRecommendations } from '../services/storageService';
import { useAppStore } from '../store/appStore';
import { SchemeCard } from '../components/schemes/SchemeCard';
import { SchemeFilterBar } from '../components/schemes/SchemeFilterBar';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { isMatchingState } from '../services/matchingEngine';
import { useTranslation } from '../hooks/useTranslation';
import { YojanaCalendarBanner } from '../components/calendar/YojanaCalendarBanner';
import { YojanaCalendarModal } from '../components/calendar/YojanaCalendarModal';
import { transliterateName } from '../utils/nameTransliterator';

import {
  Edit3,
  Sparkles,
  Info,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export const RecommendationsPage: React.FC = () => {
  const { t, tp, tCategory, tState, tOccupation, langCode } = useTranslation();
  const { recommendations: storeRecommendations } = useAppStore();
  const [profile, setProfile] = useState(() => getSavedProfile() || {});

  // Initialize immediately from store recommendations or persistent cache (0ms delay)
  const [apiResults, setApiResults] = useState<any[]>(() => {
    if (storeRecommendations && storeRecommendations.length > 0) {
      return storeRecommendations;
    }
    const cached = getCachedRecommendations();
    if (cached && cached.length > 0) {
      return cached;
    }
    return [];
  });

  // Only show loading if we don't already have recommendations
  const [isLoading, setIsLoading] = useState<boolean>(() => apiResults.length === 0);

  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedState, setSelectedState] = useState(profile.state || 'All India');
  const [sortBy, setSortBy] = useState('relevance');
  const [minMatchScore, setMinMatchScore] = useState(40);
  const [, setForceUpdate] = useState(0);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // Reset pagination when active filter criteria change during render without cascading effect
  const filterKey = `${selectedCategory}|${selectedState}|${searchQuery}|${sortBy}|${minMatchScore}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(20);
  }

  useEffect(() => {
    const handleProfileUpdate = () => {
      const updated = getSavedProfile();
      if (updated) {
        setProfile(updated);
        setSelectedState(updated.state || 'All India');
      }
    };

    window.addEventListener('sn_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('sn_profile_updated', handleProfileUpdate);
  }, []);

  // Sync when store recommendations update from survey submission in background
  const [prevStoreRecs, setPrevStoreRecs] = useState(storeRecommendations);
  if (storeRecommendations && storeRecommendations !== prevStoreRecs) {
    setPrevStoreRecs(storeRecommendations);
    if (storeRecommendations.length > 0) {
      setApiResults(storeRecommendations);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) setIsLoading(true);
    });
    api.getRecommendations(profile).then((res) => {
      if (isMounted) {
        if (res && res.length > 0) {
          setApiResults(res);
        }
        setIsLoading(false);
      }
    }).catch((err) => {
      console.warn('getRecommendations background error handled:', err);
      if (isMounted) {
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [profile]);

  // Compute filtered recommendations
  const matchResults = useMemo(() => {
    const sourceList = apiResults;

    return sourceList.filter((res) => {
      const s = res.scheme;
      if (!s) return false;
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.verification?.ministryOrAuthority?.toLowerCase().includes(q) ||
        (Array.isArray(s.tags) && s.tags.some((t: string) => t.toLowerCase().includes(q)));

      const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;

      const matchesState =
        selectedState === 'All India' ||
        s.coveredStates.includes('All India') ||
        isMatchingState(selectedState, s.coveredStates);

      const matchesScore = res.matchScore >= (minMatchScore || 40);

      return matchesSearch && matchesCat && matchesState && matchesScore;
    });
  }, [apiResults, searchQuery, selectedCategory, selectedState, minMatchScore]);

  // Apply sorting within groups
  const sortedResults = useMemo(() => {
    const list = [...matchResults];
    if (sortBy === 'highest_match') return list.sort((a, b) => b.matchScore - a.matchScore);
    if (sortBy === 'popular') return list.sort((a, b) => b.scheme.popularScore - a.scheme.popularScore);
    if (sortBy === 'alphabetical') return list.sort((a, b) => a.scheme.name.localeCompare(b.scheme.name));
    return list;
  }, [matchResults, sortBy]);

  // Dynamic category counts matching the active state and search filters
  const dynamicCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    apiResults.forEach((res) => {
      const s = res.scheme;
      if (!s) return;
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.verification?.ministryOrAuthority?.toLowerCase().includes(q) ||
        (Array.isArray(s.tags) && s.tags.some((t: string) => t.toLowerCase().includes(q)));

      const matchesState =
        selectedState === 'All India' ||
        s.coveredStates.includes('All India') ||
        isMatchingState(selectedState, s.coveredStates);

      const matchesScore = res.matchScore >= (minMatchScore || 40);

      if (matchesSearch && matchesState && matchesScore) {
        counts[s.category] = (counts[s.category] || 0) + 1;
      }
    });

    return counts;
  }, [apiResults, searchQuery, selectedState, minMatchScore]);

  return (
    <div className="bg-slate-50/80 dark:bg-slate-950 min-h-screen py-6 sm:py-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{t('recommendations.badge', undefined, 'Personalized Recommendations')}</span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('recommendations.title', undefined, 'Schemes You May Be Eligible For')}
            </h1>

            {/* Profile Signals Pill */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">{t('recommendations.active_profile', undefined, 'Active Profile:')}</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700">
                {profile.name?.toLowerCase() === 'user' || profile.name?.toLowerCase() === 'citizen' || profile.name?.toLowerCase() === 'guest'
                  ? t('common.citizen', undefined, t('common.user', undefined, profile.name))
                  : transliterateName(profile.name || t('common.citizen'), langCode)}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700">
                {profile.age || 20} {t('common.yrs', undefined, 'Yrs')}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700">
                {profile.state ? tState(profile.state) : tState('Haryana')} ({tp(profile.areaType || 'Urban')})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700">
                {tOccupation(profile.employmentType || 'Student')}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700">
                {profile.incomeRange || '₹1–2.5 lakh'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <Link
              to="/survey"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 hover:text-teal-900 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600 text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>{t('recommendations.edit_profile_btn', undefined, 'Edit Profile')}</span>
            </Link>
          </div>
        </div>

        {/* Informational Match Disclaimer */}
        <div className="p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3">
          <Info className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>{t('recommendations.disclaimer_title', undefined, 'About Match Scores:')}</strong> {t('recommendations.disclaimer_text', undefined, 'The match percentage indicates structural alignment between your profile and publicly listed eligibility criteria. It is an informational navigation guide and does not constitute a government approval.')}
          </p>
        </div>

        {/* Yojana Calendar & Deadline Urgency Alerts Banner */}
        {sortedResults.length > 0 && (
          <YojanaCalendarBanner
            schemes={sortedResults.map((r) => r.scheme)}
            onOpenCalendar={() => setIsCalendarModalOpen(true)}
            title={t('calendar.bannerTitle', undefined, 'Yojana Application Calendar & Deadline Urgency Alerts')}
          />
        )}

        {/* Filter Bar */}
        <SchemeFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedState={selectedState}
          onStateChange={setSelectedState}
          sortBy={sortBy}
          onSortChange={setSortBy}
          minMatchScore={minMatchScore}
          onMinScoreChange={setMinMatchScore}
          showMatchFilter={true}
          categoryCounts={dynamicCategoryCounts}
          matchingCount={sortedResults.length}
          totalCount={apiResults.length}
        />

        {/* Match Count Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-teal-100/80 dark:bg-teal-950/60 text-teal-900 dark:text-teal-300 font-extrabold text-sm border border-teal-200 dark:border-teal-800 animate-pulse">
                <div className="w-3.5 h-3.5 border-2 border-teal-600 dark:border-teal-400 border-t-transparent rounded-full animate-spin" />
                <span>{tp('Analyzing verified schemes for you...')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-100/80 dark:bg-teal-950/60 text-teal-900 dark:text-teal-300 font-extrabold text-sm border border-teal-200 dark:border-teal-800">
                <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>{sortedResults.length} {t('recommendations.schemesFound', undefined, sortedResults.length === 1 ? 'Scheme Found For You' : 'Schemes Found For You')}</span>
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400 font-medium hidden md:inline">
              {t('recommendations.rankedByFit', undefined, '(Ranked by AI & eligibility fit)')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedCategory !== 'All' && (
              <span className="text-teal-800 dark:text-teal-300">
                {t('recommendations.filtered_by_cat', undefined, 'Filtered by Category:')} <strong>{tCategory(selectedCategory)}</strong>
              </span>
            )}
            {minMatchScore > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs">
                <span>{t('recommendations.minMatch', undefined, 'Min Match')}: ≥ {minMatchScore}%</span>
                <button
                  type="button"
                  onClick={() => setMinMatchScore(0)}
                  className="hover:text-rose-600 font-extrabold cursor-pointer ml-1"
                  title="Show all match scores"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Schemes Results */}
        {isLoading ? (
          /* Loading Skeletons - Prevents flashing 0 schemes or empty state */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
                <div className="space-y-2 pt-2">
                  <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded-md" />
                  <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                  <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                  <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedResults.length > 0 ? (
          <div className="space-y-8">
            {/* Grid of Top Schemes (Showing first 20 by default) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedResults.slice(0, visibleCount).map((result) => (
                <SchemeCard
                  key={result.scheme.id || result.scheme.slug}
                  matchResult={result}
                  onSaveChange={() => setForceUpdate((p) => p + 1)}
                />
              ))}
            </div>

            {/* Next Schemes Pagination Button */}
            {visibleCount < sortedResults.length ? (
              <div className="flex flex-col items-center justify-center pt-8 pb-4 space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 24)}
                    className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-700 via-teal-800 to-teal-950 hover:from-teal-800 hover:to-slate-900 text-white font-extrabold text-sm shadow-xl shadow-teal-950/20 hover:shadow-2xl transition-all cursor-pointer group active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-300 group-hover:rotate-12 transition-transform" />
                    <span>{t('recommendations.showNext', undefined, 'Show Next')} {Math.min(24, sortedResults.length - visibleCount)} {t('recommendations.eligibleSchemes', undefined, 'Eligible Schemes')}</span>
                    <ArrowRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {sortedResults.length > visibleCount && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(sortedResults.length)}
                      className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      <span>{t('recommendations.showAll', undefined, 'Show All')} {sortedResults.length} {t('nav.explore', undefined, 'Schemes')}</span>
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {t('recommendations.showingCount', undefined, `Showing ${Math.min(visibleCount, sortedResults.length)} of ${sortedResults.length} eligible schemes found for your profile`)}
                </span>
              </div>
            ) : (
              <div className="text-center pt-6 pb-2 text-xs text-slate-400 font-medium">
                {t('recommendations.showingAllDone', undefined, `✓ Showing all ${sortedResults.length} eligible schemes matching your criteria.`)}
              </div>
            )}
          </div>
        ) : (
          /* Empty State - Filter-Aware vs Truly Empty */
          minMatchScore > 0 || selectedCategory !== 'All' || searchQuery.trim() !== '' ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-14 border border-slate-200 dark:border-slate-800 text-center space-y-5 shadow-sm max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  No schemes match your active filter criteria
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  {minMatchScore > 0 && `No schemes currently meet the strict threshold of ≥ ${minMatchScore}% match. `}
                  {selectedCategory !== 'All' && `No results found in "${selectedCategory}". `}
                  {searchQuery && `No matches found for "${searchQuery}". `}
                  {apiResults.length > 0 && `You have ${apiResults.length} eligible schemes available for your profile at other score levels.`}
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                {minMatchScore > 0 && (
                  <button
                    type="button"
                    onClick={() => setMinMatchScore(0)}
                    className="px-6 py-3 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span>Show All Eligible Schemes (Reset Score Filter)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedState(profile.state || 'All India');
                    setMinMatchScore(40);
                    setSearchQuery('');
                  }}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t('explore.reset_filters', undefined, 'Reset All Filters')}
                </button>
                <Link
                  to="/survey"
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>Recalibrate Profile</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 sm:p-16 border border-slate-200 dark:border-slate-800 text-center space-y-5 shadow-sm max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  No schemes found for you
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  We could not find active government schemes matching your current profile parameters. You can recalibrate your details or browse the complete nationwide catalog.
                </p>
              </div>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/survey"
                  className="px-6 py-3 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Recalibrate Profile</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedState(profile.state || 'All India');
                    setMinMatchScore(40);
                    setSearchQuery('');
                  }}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t('explore.reset_filters', undefined, 'Reset Filters')}
                </button>
                <Link
                  to="/explore"
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
                >
                  {t('recommendations.explore_all_btn', undefined, 'Explore All Schemes Directory')}
                </Link>
              </div>
            </div>
          )
        )}

        {/* Yojana Calendar Modal */}
        <YojanaCalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
          schemes={sortedResults.map((r) => r.scheme)}
        />
      </div>
    </div>
  );
};
