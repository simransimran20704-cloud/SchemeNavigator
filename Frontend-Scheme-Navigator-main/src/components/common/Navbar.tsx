import React, { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { CompassLogo } from './CompassLogo';
import {
  Bookmark,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Compass,
  Moon,
  Sun,
  Volume2,
  Store,
  ListTodo,
  LogIn,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Globe,
  Bell,
  Calendar,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useTranslation } from '../../hooks/useTranslation';
import { LanguageSelector } from './LanguageSelector';
import { KendraFinderModal } from '../kendra/KendraFinderModal';
import { transliterateName } from '../../utils/nameTransliterator';

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isKendraModalOpen, setIsKendraModalOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const {
    savedSchemeIds,
    applications,
    authUser,
    openAuthModal,
    logout,
    handleCheckEligibility,
    startTour,
    theme,
    toggleTheme,
    isVoiceReaderOpen,
    toggleVoiceReader,
    selectedLanguage,
    openNotificationModal,
  } = useAppStore();
  const { t, tp, langCode } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const displayName = authUser?.name?.toLowerCase() === 'user' || authUser?.name?.toLowerCase() === 'citizen' || authUser?.name?.toLowerCase() === 'guest'
    ? t('common.citizen', undefined, t('common.user', undefined, authUser?.name))
    : transliterateName(authUser?.name, langCode);

  const handleHowItWorksClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);

    if (location.pathname === '/' || location.pathname === '') {
      const element = document.getElementById('how-it-works');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById('how-it-works');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors duration-200">
      <div className="w-full max-w-[1600px] mx-auto pl-4 sm:pl-6 lg:pl-8 xl:pl-12 pr-3 sm:pr-4 lg:pr-5 xl:pr-8">
        <div className="flex items-center justify-between h-13 sm:h-14 lg:h-16 gap-1.5 xl:gap-3 min-w-0">
          {/* Brand Logo */}
          <div className="shrink-0 flex items-center">
            <CompassLogo size="sm" />
          </div>

          {/* Center Navigation Links - Clean, compact, direct */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 2xl:gap-2 shrink-0">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-2 xl:px-3 py-1 xl:py-1.5 rounded-xl text-xs xl:text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              {t('nav.home')}
            </NavLink>

            <NavLink
              id="nav-explore"
              to="/explore"
              className={({ isActive }) =>
                `px-2 xl:px-3 py-1 xl:py-1.5 rounded-xl text-xs xl:text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              {t('nav.explore', undefined, 'Explore Schemes')}
            </NavLink>

            <NavLink
              id="nav-events"
              to="/events"
              className={({ isActive }) =>
                `inline-flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 py-1 xl:py-1.5 rounded-xl text-xs xl:text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <Calendar className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-amber-500 dark:text-amber-400 shrink-0" />
              <span>{t('nav.events', undefined, tp('Nearby Events'))}</span>
            </NavLink>

            <a
              href="#how-it-works"
              onClick={handleHowItWorksClick}
              className="px-2 xl:px-3 py-1 xl:py-1.5 rounded-xl text-xs xl:text-sm font-semibold whitespace-nowrap text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
            >
              {t('nav.howItWorks')}
            </a>

            <NavLink
              id="nav-ai-advisor"
              to="/assistant"
              className={({ isActive }) =>
                `inline-flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 py-1 xl:py-1.5 rounded-xl text-xs xl:text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100/70'
                }`
              }
            >
              <Sparkles className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-emerald-500 animate-pulse shrink-0" />
              <span>{t('nav.aiAdvisor')}</span>
            </NavLink>

            <NavLink
              id="nav-kendra-finder"
              to="/kendra-finder"
              className={({ isActive }) =>
                `inline-flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 py-1 xl:py-1.5 rounded-xl text-xs xl:text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <Store className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-teal-600 dark:text-emerald-400 shrink-0" />
              <span>{t('nav.kendraFinder', undefined, 'Kendra Finder')}</span>
            </NavLink>

            <NavLink
              to="/about"
              className={({ isActive }) =>
                `px-2 xl:px-3 py-1 xl:py-1.5 rounded-xl text-xs xl:text-sm font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              {t('nav.about')}
            </NavLink>
          </nav>

          {/* Right Actions & Utilities - Seamless, cohesive arrangement */}
          <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
            {/* Interactive Tour Button (Wide desktop) */}
            <button
              type="button"
              onClick={startTour}
              className="hidden 2xl:flex p-1.5 xl:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Take interactive tour"
              aria-label="Interactive Tour"
            >
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
            </button>

            {/* Universal Voice Reader */}
            <button
              type="button"
              onClick={toggleVoiceReader}
              className={`p-1.5 xl:p-2 rounded-xl transition-all cursor-pointer ${
                isVoiceReaderOpen
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Listen to this page (Voice Reader)"
              aria-label="Toggle Page Voice Reader"
            >
              <Volume2 className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
            </button>

            {/* Language Selector Dropdown */}
            <LanguageSelector variant="navbar" align="right" />

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 xl:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Saved Schemes Icon (Navigates to /saved) */}
            <Link
              id="nav-saved-schemes"
              to="/saved"
              className="relative p-1.5 text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={t('nav.savedSchemes', undefined, 'Saved Schemes')}
            >
              <Bookmark className="w-4.5 h-4.5" />
              {savedSchemeIds.length > 0 && (
                <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[15px] h-[15px] text-[9px] font-black text-white bg-amber-600 dark:bg-amber-500 rounded-full px-0.5 shadow-xs ring-2 ring-white dark:ring-slate-950">
                  {savedSchemeIds.length}
                </span>
              )}
            </Link>

            {/* Application Tracker Icon (Navigates to /tracker) */}
            <Link
              id="nav-tracker"
              to="/tracker"
              className="relative p-1.5 text-slate-700 dark:text-slate-200 hover:text-teal-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={t('nav.tracker', undefined, 'Application Guidance Tracker')}
            >
              <ListTodo className="w-4.5 h-4.5" />
              {applications.length > 0 && (
                <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[15px] h-[15px] text-[9px] font-black text-white bg-teal-700 dark:bg-emerald-600 rounded-full px-0.5 shadow-xs ring-2 ring-white dark:ring-slate-950">
                  {applications.length}
                </span>
              )}
            </Link>

            {/* WhatsApp & SMS Alerts Bell Icon */}
            <button
              type="button"
              id="nav-notifications"
              onClick={() => openNotificationModal()}
              className="relative p-1.5 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer group"
              title="WhatsApp & SMS Notifications (व्हाट्सएप और एसएमएस सूचनाएं)"
              aria-label="Notifications Center"
            >
              <Bell className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-950 animate-pulse" />
            </button>

            {/* User Authentication: Sign In or Profile Menu */}
            {!authUser?.isLoggedIn ? (
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-teal-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                title="Sign In / Register"
              >
                <LogIn className="w-4 h-4 text-teal-700 dark:text-emerald-400" />
                <span>{t('nav.signIn', undefined, 'Sign In')}</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center gap-1.5 p-1 pl-2.5 pr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-800"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[85px] xl:max-w-[100px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isUserDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2"
                    onClick={() => setIsUserDropdownOpen(false)}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {displayName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {authUser.email}
                      </div>
                    </div>
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('nav.myDashboard', undefined, 'My Dashboard')}</span>
                    </Link>
                    <Link
                      to="/saved"
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('nav.savedSchemes', undefined, 'Saved Schemes')} ({savedSchemeIds.length})</span>
                    </Link>
                    <Link
                      to="/tracker"
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ListTodo className="w-3.5 h-3.5 text-teal-600" />
                      <span>{t('nav.tracker', undefined, 'Application Tracker')}</span>
                    </Link>
                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{t('nav.signOut', undefined, 'Sign Out')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Check Eligibility CTA Button - Guaranteed visibility */}
            <button
              id="nav-check-eligibility"
              type="button"
              onClick={() => handleCheckEligibility(navigate)}
              className="inline-flex items-center gap-1.5 px-3 xl:px-3.5 py-1.5 xl:py-2 bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 hover:from-teal-800 hover:to-emerald-900 text-white text-xs xl:text-sm font-bold rounded-xl shadow-xs hover:shadow-md transition-all duration-200 active:scale-95 cursor-pointer group whitespace-nowrap shrink-0"
            >
              <Compass className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-emerald-300 group-hover:rotate-45 transition-transform duration-300 shrink-0" />
              <span>{t('nav.check', undefined, 'Check')}</span>
            </button>
          </div>

          {/* Mobile & Tablet Controls */}
          <div className="flex lg:hidden items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Tablet Check Eligibility Button */}
            <button
              type="button"
              onClick={() => handleCheckEligibility(navigate)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 cursor-pointer shrink-0"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>{t('nav.check', undefined, 'Check')}</span>
            </button>

            {/* Theme Toggle on mobile bar */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 active:scale-95 transition-all shrink-0 cursor-pointer"
              aria-label="Toggle Theme"
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
              )}
            </button>

            {/* Compact Language Selector */}
            <LanguageSelector variant="compact" align="right" className="shrink-0" />

            {/* Mobile Drawer Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:outline-hidden cursor-pointer active:scale-95 transition-all shrink-0"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl px-4 pt-3 pb-6 space-y-2.5 animate-in slide-in-from-top-2 duration-200 shadow-xl max-w-full overflow-hidden">
          {/* Mobile User Profile / Sign In Banner */}
          {authUser?.isLoggedIn ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {authUser.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                openAuthModal('signin');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer mb-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('nav.signInCreate', undefined, 'Sign In / Create Account')}</span>
            </button>
          )}

          {/* Mobile In-Drawer Language Selector */}
          <div className="p-3 bg-teal-50/70 dark:bg-slate-900 rounded-2xl border border-teal-200/60 dark:border-slate-800 flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-800 dark:bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Globe className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                  <span>{selectedLanguage.nativeName}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    ({selectedLanguage.name})
                  </span>
                </div>
                <div className="text-[10px] text-teal-700 dark:text-emerald-400 font-semibold truncate">
                  12 Regional Languages
                </div>
              </div>
            </div>
            <LanguageSelector variant="compact" align="right" className="shrink-0" />
          </div>

          <div className="space-y-1">
            <NavLink
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-teal-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <span>{t('nav.home')}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            <NavLink
              to="/explore"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-teal-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <span>{t('nav.explore')}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            {/* Dedicated Nearby Events & Camps Link */}
            <NavLink
              to="/events"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-teal-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>{t('nav.events', undefined, tp('Nearby Events & Camps'))}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            {/* Dedicated Saved Schemes Link */}
            <NavLink
              to="/saved"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{t('nav.savedSchemes', undefined, 'Saved Schemes')}</span>
                {savedSchemeIds.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-bold">
                    {savedSchemeIds.length}
                  </span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            {/* Dedicated Application Tracker Link */}
            <NavLink
              to="/tracker"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-teal-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
                <span>{t('nav.tracker', undefined, 'Application Tracker')}</span>
                {applications.length > 0 && (
                  <span className="px-2 py-0.5 bg-teal-800 text-white rounded-full text-[10px] font-bold">
                    {applications.length}
                  </span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            {/* My Dashboard Link */}
            <NavLink
              to="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-teal-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
                <span>{t('nav.myDashboard', undefined, 'My Dashboard')}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            {/* WhatsApp & SMS Alerts Mobile Drawer Button */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                openNotificationModal();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>व्हाट्सएप और एसएमएस अलर्ट (WhatsApp & SMS)</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-md text-[10px] font-extrabold uppercase">
                Active
              </span>
            </button>

            <a
              href="#how-it-works"
              onClick={handleHowItWorksClick}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
            >
              <span>{t('nav.howItWorks')}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>

            <NavLink
              to="/assistant"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-900 dark:bg-teal-800 text-white shadow-xs'
                    : 'bg-teal-50 dark:bg-emerald-950/50 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-emerald-700/60'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                <span>{t('nav.aiAdvisor')}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            <NavLink
              to="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-teal-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <span>{t('nav.about')}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            <NavLink
              to="/kendra-finder"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-emerald-300 border border-teal-200/60 dark:border-teal-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
                <span>{t('nav.kendraFinder', undefined, 'Kendra Finder (CSC / e-Mitra)')}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </NavLink>

            {/* Mobile Voice Reader Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                toggleVoiceReader();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
                <span>{isVoiceReaderOpen ? 'Close Voice Reader' : 'Listen to this page (Voice Reader)'}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Mobile Interactive Tour Trigger */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                startTour();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
                <span>Take Interactive Tour</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Mobile CTA */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleCheckEligibility(navigate);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-700 to-emerald-700 text-white font-black text-sm rounded-xl shadow-md cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>{t('nav.checkEligibility')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Kendra Finder Modal Mount */}
      <KendraFinderModal
        isOpen={isKendraModalOpen}
        onClose={() => setIsKendraModalOpen(false)}
      />
    </header>
  );
};
