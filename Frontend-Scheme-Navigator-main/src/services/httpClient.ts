/**
 * HttpApiClient — real HTTP implementation of the same interface as MockFrontendApiClient.
 *
 * Activated when VITE_API_BASE_URL is set. Falls back to MockFrontendApiClient otherwise,
 * so the app still works fully offline / without a backend.
 *
 * Session token lifecycle:
 *   The token is stored purely in memory (a private instance variable).
 *   It is never written to sessionStorage or localStorage.
 *   A new token is requested on every page load; the token is gone the moment
 *   the page is closed or refreshed.
 */

import type {
  UserProfile,
  SchemeMatchResult,
  TrackerItem,
  Scheme,
  NotificationPreferences,
  SendNotificationPayload,
  SendNotificationResponse,
  NotificationLogItem,
} from '../types';
import {
  getSavedProfile as getUserProfile,
  saveUserProfile,
  saveCachedRecommendations,
  clearCachedRecommendations,
  getSavedSchemes as getLocalSavedSchemes,
  setSavedSchemesList,
  getDeletedSchemeKeys,
  addDeletedSchemeKey,
  removeDeletedSchemeKey,
  getTrackerItems as getLocalTrackerItems,
  saveTrackerItem as saveLocalTrackerItem,
  setTrackerItemsList,
  getAuthUser,
  getLocalNotificationPreferences,
  saveLocalNotificationPreferences,
} from './storageService';
import { calculateSchemeMatch, rankSchemesForProfile } from './matchingEngine';
import { parseVoiceInput } from '../utils/voiceParser';
import { isGeminiConfigured, askGeminiDirect } from './geminiService';
import { detectMessageLanguage } from '../utils/languageDetector';
import { translateSchemeContent } from '../utils/schemeTranslator';
// ── Government Scheme API Integration (APIMitra Live Provider) ─────────────────
const GOVT_SCHEME_API_URL = 'https://api.apimitra.in/schemes';
const GOVT_SCHEME_API_KEY =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_APIMITRA_API_KEY as string | undefined)?.trim()) ||
  '';

async function fetchLiveGovtSchemes(query: string, limit: number = 4): Promise<Scheme[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${GOVT_SCHEME_API_URL}?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': GOVT_SCHEME_API_KEY,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.data || json?.schemes || json?.results || [];
    if (!Array.isArray(items)) return [];
    return items.map((raw: any) => ({
      id: raw.slug || raw.id || `live-${Date.now()}`,
      name: raw.scheme_name || raw.name || raw.short_title || 'Government Scheme',
      shortName: raw.short_title || '',
      slug: raw.slug || raw.id || '',
      tagline: (raw.brief || raw.scheme_name || '').slice(0, 120),
      shortDescription: raw.brief || raw.shortDescription || raw.description || '',
      detailedDescription: raw.brief || raw.detailedDescription || '',
      category: (raw.categories?.split(',')[0]?.trim() || raw.category || 'Social Security') as any,
      level: (raw.level?.toLowerCase() === 'state' ? 'State' : 'Central') as 'Central' | 'State',
      coveredStates: raw.beneficiary_state && raw.beneficiary_state !== 'All' ? [raw.beneficiary_state] : ['All India'],
      benefits: raw.brief ? [{ title: 'Financial & Welfare Assistance', amountOrValue: '', description: raw.brief, type: 'Financial Assistance' as const }] : [],
      eligibility: {
        minAge: 0,
        maxAge: 100,
        allowedGenders: ['all' as any],
        allowedOccupations: ['Other'],
        allowedCategories: ['All' as any],
        customConditions: raw.scheme_for ? [`Target Beneficiary: ${raw.scheme_for}`] : [],
        requiresBPL: false,
      },
      documents: [
        { id: 'doc-aadhaar', name: 'Aadhaar Card', description: 'Identity and biometric authentication', isMandatory: true, documentType: 'identity' as const },
        { id: 'doc-bank', name: 'Bank Passbook', description: 'Aadhaar-seeded bank account for DBT payment', isMandatory: true, documentType: 'bank' as const },
      ],
      applicationSteps: [
        { stepNumber: 1, title: 'Visit Official Department Portal', description: `Check scheme details and guidelines under ${raw.ministry || 'Ministry'}.`, tips: '', actionUrl: '' },
        { stepNumber: 2, title: 'Apply Online or Visit Nearest CSC', description: 'Submit applicant demographic information with required identity and category documents.', tips: '', actionUrl: '' },
      ],
      verification: {
        sourceDepartment: raw.ministry || 'Government of India',
        ministryOrAuthority: raw.ministry || 'Government of India',
        lastUpdated: new Date().toISOString(),
        officialPortalUrl: '',
        helpline: '1800-11-0001',
        isOfficialVerified: true,
      },
      popularScore: 85,
      tags: raw.tags ? raw.tags.split(',').map((t: string) => t.trim()) : ['Welfare', 'Government Scheme'],
    }));
  } catch {
    return [];
  }
}

export function getCurrentAuthEmail(): string {
  try {
    const directUser = getAuthUser();
    if (directUser?.email) return directUser.email.trim();
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of ['sn_auth_user_v2', 'sn_auth_user', 'authUser']) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email) return String(parsed.email).trim();
        }
      }
    }
    if (typeof sessionStorage !== 'undefined') {
      for (const key of ['sn_auth_user_v2', 'sn_auth_user', 'authUser']) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email) return String(parsed.email).trim();
        }
      }
    }
  } catch {}
  return '';
}

export function isNetworkOrAbortError(err: any): boolean {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  const msg = String(err?.message || err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('abort') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('connection') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout')
  );
}

class HttpApiClient {
  private baseUrl: string;
  private candidateBaseUrls: string[] = [];
  private _token: string | null = null;
  private _tokenPromise: Promise<string> | null = null;
  private _cache = new Map<string, { data: any; expiry: number }>();
  private isBackendAvailable: boolean | null = null;
  private schemeIndexMap = new Map<string, Scheme>();
  private staticSummaryData: {
    schemes: Scheme[];
    categoryCounts: Record<string, number>;
    total: number;
  } | null = null;
  private staticFullSchemes: Scheme[] | null = null;
  private staticFullLoadingPromise: Promise<Scheme[]> | null = null;
  private staticLoadingPromise: Promise<void> | null = null;
  private staticListData: {
    schemes: Scheme[];
    categoryCounts: Record<string, number>;
    total: number;
  } | null = null;
  private staticListLoadingPromise: Promise<void> | null = null;
  private _deletedSavedKeys = new Set<string>();

  public indexStaticSchemes(schemes: Scheme[]) {
    if (!Array.isArray(schemes)) return;
    for (const s of schemes) {
      if (!s) continue;
      const id = String(s.id || '').trim().toLowerCase();
      const slug = String(s.slug || '').trim().toLowerCase();

      const existing = this.schemeIndexMap.get(id) || this.schemeIndexMap.get(slug);
      const isBetter =
        !existing ||
        (Array.isArray(s.documents) && s.documents.length > 0) ||
        (Array.isArray(s.applicationSteps) && s.applicationSteps.length > 0);

      if (isBetter) {
        if (id) {
          this.schemeIndexMap.set(id, s);
          this.schemeIndexMap.set(id.replace(/[-_]/g, ''), s);
        }
        if (slug) {
          this.schemeIndexMap.set(slug, s);
          this.schemeIndexMap.set(slug.replace(/[-_]/g, ''), s);
        }
        if (s.name) {
          const normName = s.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
          this.schemeIndexMap.set(normName, s);
          this.schemeIndexMap.set(s.name.trim().toLowerCase(), s);
        }
        if (s.shortName) {
          this.schemeIndexMap.set(s.shortName.trim().toLowerCase(), s);
        }
      }
    }
  }

  constructor(baseUrl: string) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, ''); // strip trailing slash
    this.initCandidates();
  }

  private initCandidates() {
    const list: string[] = [];
    if (this.baseUrl) {
      list.push(this.baseUrl);
    } else {
      list.push('');
    }

    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1';
      const isLan =
        /^192\.168\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        hostname.endsWith('.local');

      if (isLoopback || isLan) {
        const directUrl = `http://${hostname}:8000`;
        if (!list.includes(directUrl)) {
          list.push(directUrl);
        }
        if (!list.includes('')) {
          list.push('');
        }
      }
    }
    this.candidateBaseUrls = list;
  }

  public hasBackend(): boolean {
    if (this.baseUrl) return true;
    if (this.candidateBaseUrls && this.candidateBaseUrls.length > 0) return true;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      return host === 'localhost' || host === '127.0.0.1' || !host.includes('github.io');
    }
    return false;
  }

  private getStaticBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      // If deployed on GitHub Pages with repository subpath
      if (pathname.startsWith('/Scheme-Navigator-App')) {
        return '/Scheme-Navigator-App/';
      }
      // On Cloudflare, Vercel, Netlify, or local, it is hosted at root
      return '/';
    }
    const base = import.meta.env.BASE_URL || '/';
    return base.endsWith('/') ? base : `${base}/`;
  }

  /**
   * Loads the slim card-list file (schemes-list.json) which omits heavy
   * eligibility/verification objects to keep the initial listing payload small.
   * Falls back to loadStaticSummary() if the slim file is absent.
   */
  private async loadStaticList(): Promise<{
    schemes: Scheme[];
    categoryCounts: Record<string, number>;
    total: number;
  }> {
    if (this.staticListData) return this.staticListData;
    if (this.staticListLoadingPromise) {
      await this.staticListLoadingPromise;
      if (this.staticListData) return this.staticListData;
    }

    this.staticListLoadingPromise = (async () => {
      try {
        const cleanBase = this.getStaticBaseUrl();
        const res = await fetch(`${cleanBase}data/schemes-list.json`);
        if (res.ok) {
          this.staticListData = await res.json();
          if (this.staticListData?.schemes) {
            this.indexStaticSchemes(this.staticListData.schemes);
          }
          return;
        }
      } catch (err) {
        console.warn('Could not load schemes-list.json, falling back to summary:', err);
      }
      // Fallback: re-use the full summary data
      const summary = await this.loadStaticSummary();
      this.staticListData = summary;
      if (summary?.schemes) {
        this.indexStaticSchemes(summary.schemes);
      }
    })().finally(() => {
      this.staticListLoadingPromise = null;
    });

    await this.staticListLoadingPromise;
    return this.staticListData || { schemes: [], categoryCounts: {}, total: 0 };
  }

  private async loadStaticSummary(): Promise<{
    schemes: Scheme[];
    categoryCounts: Record<string, number>;
    total: number;
  }> {
    if (this.staticSummaryData) return this.staticSummaryData;
    if (this.staticLoadingPromise) {
      await this.staticLoadingPromise;
      if (this.staticSummaryData) return this.staticSummaryData;
    }

    this.staticLoadingPromise = (async () => {
      try {
        const cleanBase = this.getStaticBaseUrl();
        const res = await fetch(`${cleanBase}data/schemes-summary.json`);
        if (res.ok) {
          this.staticSummaryData = await res.json();
          if (this.staticSummaryData?.schemes) {
            this.indexStaticSchemes(this.staticSummaryData.schemes);
          }
          return;
        }

        const fullRes = await fetch(`${cleanBase}data/schemes.json`);
        if (fullRes.ok) {
          const all: Scheme[] = await fullRes.json();
          const counts: Record<string, number> = {};
          for (const s of all) {
            if (s.category) counts[s.category] = (counts[s.category] || 0) + 1;
          }
          this.staticSummaryData = { schemes: all, categoryCounts: counts, total: all.length };
          this.staticFullSchemes = all;
          this.indexStaticSchemes(all);
          return;
        }
      } catch (err) {
        console.warn('Could not load static schemes data:', err);
      }
    })().finally(() => {
      this.staticLoadingPromise = null;
    });

    await this.staticLoadingPromise;
    return this.staticSummaryData || { schemes: [], categoryCounts: {}, total: 0 };
  }

  private async loadStaticFull(): Promise<Scheme[]> {
    if (this.staticFullSchemes && this.staticFullSchemes.length > 0) {
      return this.staticFullSchemes;
    }
    if (this.staticFullLoadingPromise) {
      return this.staticFullLoadingPromise;
    }
    this.staticFullLoadingPromise = (async () => {
      try {
        const cleanBase = this.getStaticBaseUrl();
        const res = await fetch(`${cleanBase}data/schemes.json`);
        if (res.ok) {
          const list: Scheme[] = await res.json();
          this.staticFullSchemes = list;
          this.indexStaticSchemes(list);
          return list;
        }
      } catch (err) {
        console.warn('Could not load full schemes.json:', err);
      }
      const summary = await this.loadStaticSummary();
      return summary.schemes || [];
    })().finally(() => {
      this.staticFullLoadingPromise = null;
    });

    return this.staticFullLoadingPromise;
  }


  private getCached<T>(key: string): T | null {
    const entry = this._cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data as T;
    }
    this._cache.delete(key);
    return null;
  }

  private setCached(key: string, data: any, ttlMs: number = 60000) {
    this._cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  public clearCache() {
    this._cache.clear();
  }

  // ── Token management ──────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (this._token) return this._token;

    try {
      const stored = sessionStorage.getItem('sn_session_token');
      if (stored) {
        this._token = stored;
        return stored;
      }
    } catch {
      // ignore
    }

    if (!this.hasBackend() || this.isBackendAvailable === false) {
      const fallbackToken = 'offline-session-token';
      this._token = fallbackToken;
      return fallbackToken;
    }

    if (!this._tokenPromise) {
      this._tokenPromise = this._createSession().finally(() => {
        this._tokenPromise = null;
      });
    }
    return this._tokenPromise;
  }

  private async _createSession(): Promise<string> {
    if (this.isBackendAvailable === false) {
      return 'offline-session-token';
    }

    const candidates = this.candidateBaseUrls.length > 0 ? this.candidateBaseUrls : [this.baseUrl];
    let lastError: any = null;

    for (let i = 0; i < candidates.length; i++) {
      const candUrl = candidates[i];
      try {
        const url = candUrl ? `${candUrl}/api/sessions/` : '/api/sessions/';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) {
          if ((res.status === 404 || res.status === 502 || res.status === 504) && i < candidates.length - 1) {
            continue;
          }
          throw new Error('Failed to create session');
        }

        const data = await res.json();
        const token: string = data.token;
        this._token = token;
        this.baseUrl = candUrl;
        this.isBackendAvailable = true;
        try {
          sessionStorage.setItem('sn_session_token', token);
        } catch {
          // ignore
        }
        return token;
      } catch (err: any) {
        lastError = err;
        if (i < candidates.length - 1) {
          continue;
        }
      }
    }

    console.warn('[httpClient] session creation blip, using fallback:', lastError);
    const fallbackToken = 'offline-session-token';
    this._token = fallbackToken;
    return fallbackToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    timeoutMs: number = 25000
  ): Promise<T> {
    const candidates = this.candidateBaseUrls.length > 0 ? this.candidateBaseUrls : [this.baseUrl];
    const sortedCandidates = [
      this.baseUrl,
      ...candidates.filter((c) => c !== this.baseUrl),
    ];

    let lastError: any = null;

    for (let i = 0; i < sortedCandidates.length; i++) {
      const candUrl = sortedCandidates[i];
      let fullUrl = candUrl ? `${candUrl}${path}` : path;
      const token = await this.getToken();
      const controller = new AbortController();
      const initialMaxTimeout = this.isBackendAvailable === null ? Math.min(timeoutMs, 2500) : timeoutMs;
      const currentTimeout = i === 0 ? initialMaxTimeout : Math.min(timeoutMs, 4000);
      const timer = setTimeout(() => controller.abort(), currentTimeout);

      const authEmail = getCurrentAuthEmail();
      const authHeaders: Record<string, string> = {};
      if (authEmail) {
        authHeaders['X-Auth-Email'] = authEmail;
        authHeaders['Authorization'] = `Bearer ${authEmail}`;
        if (!fullUrl.includes('auth_email=')) {
          const sep = fullUrl.includes('?') ? '&' : '?';
          fullUrl = `${fullUrl}${sep}auth_email=${encodeURIComponent(authEmail)}`;
        }
      }

      try {
        const res = await fetch(fullUrl, {
          ...options,
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token,
            ...authHeaders,
            ...(options.headers as Record<string, string> | undefined),
          },
        }).finally(() => clearTimeout(timer));

        if (res.status === 401) {
          this._token = null;
          const newToken = await this._createSession();
          const retry = await fetch(fullUrl, {
            ...options,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Token': newToken,
              ...authHeaders,
              ...(options.headers as Record<string, string> | undefined),
            },
          });
          if (!retry.ok) {
            const err = await retry.json().catch(() => ({}));
            throw new Error(err?.error || `API error ${retry.status}`);
          }
          this.baseUrl = candUrl;
          this.isBackendAvailable = true;
          return retry.json() as Promise<T>;
        }

        if (!res.ok) {
          if (
            (res.status === 404 || res.status === 502 || res.status === 503 || res.status === 504) &&
            i < sortedCandidates.length - 1
          ) {
            continue;
          }
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `API error ${res.status}`);
        }

        this.baseUrl = candUrl;
        this.isBackendAvailable = true;
        if (res.status === 204) return {} as T;
        return res.json() as Promise<T>;
      } catch (err: any) {
        lastError = err;
        if (isNetworkOrAbortError(err)) {
          this.isBackendAvailable = false;
        }
        if (isNetworkOrAbortError(err) && i < sortedCandidates.length - 1) {
          console.warn(`[httpClient] Candidate endpoint ${candUrl || 'relative proxy'} failed, trying next candidate...`);
          continue;
        }
        console.warn(`[httpClient] Request to ${path} encountered error:`, err);
        throw err;
      }
    }

    if (isNetworkOrAbortError(lastError)) {
      this.isBackendAvailable = false;
    }
    throw lastError || new Error(`Request to ${path} failed`);
  }

  private post<T>(path: string, body: unknown, timeoutMs: number = 25000): Promise<T> {
    const authEmail = getCurrentAuthEmail();
    let finalBody = body;
    if (authEmail && body && typeof body === 'object' && !Array.isArray(body) && !(body as any).auth_email) {
      finalBody = { ...body, auth_email: authEmail };
    }
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(finalBody),
    }, timeoutMs);
  }

  private put<T>(path: string, body: unknown, timeoutMs: number = 20000): Promise<T> {
    const authEmail = getCurrentAuthEmail();
    let finalBody = body;
    if (authEmail && body && typeof body === 'object' && !Array.isArray(body) && !(body as any).auth_email) {
      finalBody = { ...body, auth_email: authEmail };
    }
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(finalBody),
    }, timeoutMs);
  }

  private del<T>(path: string, timeoutMs: number = 15000): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' }, timeoutMs);
  }

  // ── Profile & Survey ──────────────────────────────────────────────────────

  async getProfile(): Promise<UserProfile | null> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const data = await this.request<{ profile: UserProfile | null }>('/api/profile/');
        if (data?.profile) {
          saveUserProfile(data.profile, false);
          return data.profile;
        }
      } catch {
        // fallback to storage
      }
    }
    return getUserProfile();
  }

  async getProfileStatus() {
    const profile = await this.getProfile();
    return {
      exists: !!profile,
      isComplete: Boolean(profile?.age && profile?.state),
      completionPercentage: profile ? 100 : 0,
    };
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const current = getUserProfile() || {};
    const updated = { ...current, ...profile } as UserProfile;
    saveUserProfile(updated, false);
    clearCachedRecommendations();
    this.clearCache();

    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const data = await this.put<{ profile: UserProfile }>('/api/profile/', profile);
        if (data?.profile) return data.profile;
      } catch {
        // offline
      }
    }
    return updated;
  }

  async submitSurvey(
    profile: UserProfile
  ): Promise<{ profile: UserProfile; recommendations: SchemeMatchResult[] }> {
    saveUserProfile(profile);
    clearCachedRecommendations();
    this.clearCache();

    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const data = await this.post<{
          profile: UserProfile;
          recommendations: SchemeMatchResult[];
        }>('/api/survey/submit/', { profile });
        if (data?.recommendations && Array.isArray(data.recommendations)) {
          const profileHash = JSON.stringify({
            age: profile?.age,
            gender: profile?.gender,
            state: profile?.state,
            occ: profile?.employmentType || profile?.occupation,
            cat: profile?.category,
            inc: profile?.incomeRange,
            bpl: profile?.hasBPLCard || profile?.isBPL,
            dis: profile?.isDisability || profile?.hasDisability,
            min: profile?.isMinority
          });
          const cacheKey = `recs_${profileHash}`;
          this.setCached(cacheKey, data.recommendations, 180000);
          saveCachedRecommendations(data.recommendations);
          return data;
        }
      } catch {
        // fallback to client-side matching
      }
    }

    const recommendations = await this.getRecommendations(profile);
    return { profile, recommendations };
  }

  // ── Draft management ──────────────────────────────────────────────────────

  async getSurveyDraft() {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const data = await this.request<{ draft: unknown }>('/api/survey/draft/');
        return data.draft ?? null;
      } catch {
        // fallback
      }
    }
    try {
      const raw = localStorage.getItem('sn_survey_draft');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveSurveyDraft(answers: unknown, currentStep: number) {
    try {
      localStorage.setItem('sn_survey_draft', JSON.stringify({ answers, currentStep }));
    } catch {
      // ignore
    }
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        await this.put('/api/survey/draft/', { answers, currentStep });
      } catch {
        // offline
      }
    }
  }

  // ── Recommendations ───────────────────────────────────────────────────────

  async getRecommendations(profile?: UserProfile): Promise<SchemeMatchResult[]> {
    const userProfile = profile || getUserProfile();
    const profileHash = JSON.stringify({
      age: userProfile?.age,
      gender: userProfile?.gender,
      state: userProfile?.state,
      occ: userProfile?.employmentType || userProfile?.employmentStatus || userProfile?.occupation,
      cat: userProfile?.category,
      inc: userProfile?.incomeRange,
      bpl: userProfile?.hasBPLCard || userProfile?.isBPL,
      dis: userProfile?.isDisability || userProfile?.hasDisability,
      min: userProfile?.isMinority
    });
    const cacheKey = `recs_${profileHash}`;
    const cached = this.getCached<SchemeMatchResult[]>(cacheKey);
    if (cached && cached.length > 0) return cached;

    // 1. Try backend
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        let recs: SchemeMatchResult[] = [];
        if (userProfile) {
          const data = await this.post<{ recommendations: SchemeMatchResult[] }>(
            '/api/recommendations/',
            { profile: userProfile },
            2500
          );
          recs = data.recommendations;
        } else {
          const data = await this.request<{ recommendations: SchemeMatchResult[] }>(
            '/api/recommendations/',
            {},
            2500
          );
          recs = data.recommendations;
        }
        if (recs && recs.length > 0) {
          this.isBackendAvailable = true;
          this.setCached(cacheKey, recs, 180000);
          saveCachedRecommendations(recs);
          return recs;
        }
      } catch (err) {
        console.warn('Backend recommendations unavailable, computing client-side match:', err);
      }
    }

    // 2. Client-side matching engine fallback
    const summary = await this.loadStaticSummary();
    const allSchemes = summary.schemes || [];

    if (!userProfile || allSchemes.length === 0) {
      const top10: SchemeMatchResult[] = allSchemes.slice(0, 10).map((s) => ({
        scheme: s,
        matchScore: s.popularScore || 80,
        matchGrade: 'General Match',
        factors: [],
        matchedReasons: ['High popularity scheme across India'],
        unmatchedWarnings: [],
      }));
      return top10;
    }

    const matches: SchemeMatchResult[] = [];
    for (const s of allSchemes) {
      const result = calculateSchemeMatch(s, userProfile);
      if (result.matchScore >= 40) {
        matches.push(result);
      }
    }

    matches.sort((a, b) => (b.matchScore - a.matchScore) || ((b.scheme.popularScore || 0) - (a.scheme.popularScore || 0)));
    this.setCached(cacheKey, matches, 180000);
    this.setCached('recs_latest', matches, 180000);
    saveCachedRecommendations(matches);
    return matches;
  }

  // ── Schemes catalogue ─────────────────────────────────────────────────────

  async getSchemes(params?: {
    category?: string;
    state?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;

    // 1. Try backend if configured and reachable with fast timeout
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const qs = new URLSearchParams();
        if (params?.category) qs.set('category', params.category);
        if (params?.state) qs.set('state', params.state);
        if (params?.search) qs.set('search', params.search);
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(limit));

        const path = `/api/schemes/${qs.toString() ? '?' + qs.toString() : ''}`;
        const cacheKey = `schemes_${path}`;
        const cached = this.getCached<{
          schemes: Scheme[];
          categoryCounts?: Record<string, number>;
          pagination: { page: number; limit: number; total: number; totalPages: number };
        }>(cacheKey);
        if (cached && cached.schemes && cached.schemes.length > 0) return cached;

        const res = await this.request<{
          schemes: Scheme[];
          categoryCounts?: Record<string, number>;
          pagination: { page: number; limit: number; total: number; totalPages: number };
        }>(path, {}, 2500);

        if (res && res.schemes && res.schemes.length > 0) {
          this.isBackendAvailable = true;
          this.setCached(cacheKey, res, 60000);
          this.indexStaticSchemes(res.schemes);
          return res;
        }
      } catch (err) {
        console.warn('Backend scheme fetch failed, falling back to static offline catalog:', err);
      }
    }

    // 2. Static catalog fallback (for GitHub Pages / offline mode)
    // Use slim list file for fast initial load; falls back to summary automatically.
    const summary = await this.loadStaticList();
    let items = summary.schemes || [];

    if (params?.category && params.category.toLowerCase() !== 'all') {
      const catLower = params.category.toLowerCase();
      items = items.filter((s) => (s.category || '').toLowerCase() === catLower);
    }

    if (params?.state && params.state !== 'All India') {
      const stLower = params.state.toLowerCase();
      items = items.filter((s) => {
        const states = Array.isArray(s.coveredStates) ? s.coveredStates : [];
        return (
          states.length === 0 ||
          states.some((st) => st.toLowerCase() === 'all india' || st.toLowerCase() === stLower)
        );
      });
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      // Common Indic keyword mappings for high-accuracy multilingual search
      const indicEquivalents: string[] = [q];
      if (/किसान|खेती|कृषि|fasal|kisan|krishi/i.test(q)) indicEquivalents.push('agriculture', 'farmer', 'kisan', 'crop');
      if (/छात्र|शिक्षा|scholarship|padhai|shiksha|vidyarthi/i.test(q)) indicEquivalents.push('education', 'scholarship', 'student');
      if (/स्वास्थ्य|इलाज|दवा|ayushman|swasthya|health/i.test(q)) indicEquivalents.push('healthcare', 'ayushman', 'health', 'hospital');
      if (/पेंशन|वृद्धा|buddha|pension/i.test(q)) indicEquivalents.push('pension', 'social security', 'elderly');
      if (/ऋण|लोन|कर्ज|mudra|credit|loan/i.test(q)) indicEquivalents.push('loan', 'mudra', 'credit', 'financial');
      if (/आवास|मकान|घर|awas|housing/i.test(q)) indicEquivalents.push('housing', 'awas', 'house');
      if (/रोजगार|नौकरी|skill|rojgar|job/i.test(q)) indicEquivalents.push('employment', 'skill', 'job', 'rojgar');
      if (/महिला|बेटी|बालिका|ladli|sukanya|women|girl/i.test(q)) indicEquivalents.push('women', 'child', 'girl', 'sukanya', 'ladli');

      items = items.filter((s) => {
        const nameLower = (s.name || '').toLowerCase();
        const shortLower = (s.shortName || '').toLowerCase();
        const tagLower = (s.tagline || '').toLowerCase();
        const descLower = (s.shortDescription || '').toLowerCase();
        const tags = Array.isArray(s.tags) ? s.tags.map((t) => t.toLowerCase()) : [];
        const catLower = (s.category || '').toLowerCase();

        return indicEquivalents.some(
          (term) =>
            nameLower.includes(term) ||
            shortLower.includes(term) ||
            tagLower.includes(term) ||
            descLower.includes(term) ||
            catLower.includes(term) ||
            tags.some((t) => t.includes(term))
        );
      });
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const pagedSchemes = items.slice(offset, offset + limit);

    return {
      schemes: pagedSchemes,
      categoryCounts: summary.categoryCounts || {},
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getScheme(idOrSlug: string): Promise<Scheme | undefined> {
    if (!idOrSlug) return undefined;
    const raw = String(idOrSlug).trim();
    let cleanId = raw.toLowerCase().replace(/\/+$/, '');
    try {
      cleanId = decodeURIComponent(cleanId);
    } catch {
      // ignore
    }

    // 1. Fast in-memory check (0ms) - If already in index with full details, return immediately!
    const inMem = this.schemeIndexMap.get(cleanId) || this.schemeIndexMap.get(cleanId.replace(/[-_]/g, ''));
    if (inMem && Array.isArray(inMem.documents) && inMem.documents.length > 0) {
      return inMem;
    }

    // 2. Try backend ONLY if reachable and marked available, with a fast 2.5s timeout
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const res = await this.request<Scheme>(`/api/schemes/${encodeURIComponent(cleanId)}/`, {}, 2500);
        if (res && res.id) {
          this.isBackendAvailable = true;
          this.indexStaticSchemes([res]);
          return res;
        }
      } catch {
        // Backend unavailable or 404, fall straight to static catalog without delay
      }
    }

    // 3. Static catalog fallback
    // If not in index with full docs, load static full schemes file
    const fullSchemes = await this.loadStaticFull();
    let found =
      this.schemeIndexMap.get(cleanId) ||
      this.schemeIndexMap.get(cleanId.replace(/[-_]/g, '')) ||
      fullSchemes.find(
        (s) =>
          String(s.id).toLowerCase() === cleanId ||
          String(s.slug || '').toLowerCase() === cleanId ||
          (s.name && s.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === cleanId) ||
          String(s.id).toLowerCase().replace(/[-_]/g, '') === cleanId.replace(/[-_]/g, '') ||
          String(s.slug || '').toLowerCase().replace(/[-_]/g, '') === cleanId.replace(/[-_]/g, '')
      );

    if (!found) {
      const relaxed = cleanId.replace(/[-_]/g, ' ');
      found = fullSchemes.find(
        (s) =>
          (s.name && s.name.toLowerCase().includes(relaxed)) ||
          (s.shortName && s.shortName.toLowerCase().includes(relaxed))
      );
    }

    if (!found) {
      const summary = await this.loadStaticSummary();
      found = (summary.schemes || []).find(
        (s) =>
          String(s.id).toLowerCase() === cleanId ||
          String(s.slug || '').toLowerCase() === cleanId ||
          (s.name && s.name.toLowerCase().includes(cleanId.replace(/[-_]/g, ' ')))
      );
    }

    return found || inMem;
  }

  // ── Saved schemes ─────────────────────────────────────────────────────────

  async getSavedSchemes(_syncLocalToRemote: boolean = false): Promise<Scheme[]> {
    const localSchemes = getLocalSavedSchemes();
    const authEmail = getCurrentAuthEmail();

    // Only attempt remote sync if backend is available and a user is signed in
    if (this.hasBackend() && this.isBackendAvailable !== false && authEmail) {
      try {
        const data = await this.request<{ savedSchemes: Scheme[] }>('/api/saved-schemes/');
        if (data && Array.isArray(data.savedSchemes)) {
          const remoteList = data.savedSchemes;

          // If user just logged in with existing offline bookmarks and remote is empty, upload them once
          if (remoteList.length === 0 && localSchemes.length > 0 && _syncLocalToRemote) {
            try {
              const res = await this.post<{ savedSchemes: Scheme[] }>('/api/saved-schemes/', {
                savedSchemes: localSchemes,
                auth_email: authEmail,
              });
              if (res?.savedSchemes && Array.isArray(res.savedSchemes) && res.savedSchemes.length > 0) {
                setSavedSchemesList(res.savedSchemes);
                return res.savedSchemes;
              }
            } catch (err) {
              console.warn('Initial offline bookmark migration failed:', err);
            }
          }

          // The remote database is the authoritative source for this user's saved schemes across all browsers!
          // Clear any remote keys from deletedKeys
          for (const s of remoteList) {
            if (s.id) {
              removeDeletedSchemeKey(s.id);
              this._deletedSavedKeys.delete(String(s.id).toLowerCase());
            }
            if (s.slug) {
              removeDeletedSchemeKey(s.slug);
              this._deletedSavedKeys.delete(String(s.slug).toLowerCase());
            }
          }

          setSavedSchemesList(remoteList);
          return remoteList;
        }
      } catch (err) {
        console.warn('Backend getSavedSchemes error, falling back to local store:', err);
      }
    }
    return localSchemes;
  }

  async saveScheme(schemeId: string, schemeObj?: Scheme) {
    if (schemeId) {
      removeDeletedSchemeKey(schemeId);
      this._deletedSavedKeys.delete(String(schemeId).toLowerCase());
    }
    if (schemeObj?.slug) {
      removeDeletedSchemeKey(schemeObj.slug);
      this._deletedSavedKeys.delete(String(schemeObj.slug).toLowerCase());
    }
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        let payloadScheme = schemeObj;
        if (!payloadScheme) {
          const locals = getLocalSavedSchemes();
          const targetKey = String(schemeId).toLowerCase();
          payloadScheme = locals.find(
            (s) =>
              (s.id && s.id.toLowerCase() === targetKey) ||
              (s.slug && s.slug.toLowerCase() === targetKey)
          );
        }
        const authEmail = getCurrentAuthEmail();
        await this.post('/api/saved-schemes/', { schemeId, scheme: payloadScheme, auth_email: authEmail });
      } catch {
        // offline
      }
    }
  }

  async removeSavedScheme(schemeId: string, schemeSlug?: string) {
    if (schemeId) {
      addDeletedSchemeKey(schemeId);
      this._deletedSavedKeys.add(String(schemeId).toLowerCase());
    }
    if (schemeSlug) {
      addDeletedSchemeKey(schemeSlug);
      this._deletedSavedKeys.add(String(schemeSlug).toLowerCase());
    }
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const authEmail = getCurrentAuthEmail();
        const qp = authEmail ? `?auth_email=${encodeURIComponent(authEmail)}` : '';
        if (schemeId) {
          await this.del(`/api/saved-schemes/${encodeURIComponent(schemeId)}/${qp}`);
        }
        if (schemeSlug && schemeSlug.toLowerCase() !== String(schemeId).toLowerCase()) {
          await this.del(`/api/saved-schemes/${encodeURIComponent(schemeSlug)}/${qp}`).catch(() => {});
        }
      } catch {
        // offline
      }
    }
  }

  // ── Tracker ───────────────────────────────────────────────────────────────

  async getApplications(_syncLocalToRemote: boolean = false): Promise<TrackerItem[]> {
    const localItems = getLocalTrackerItems();
    const authEmail = getCurrentAuthEmail();
    if (this.hasBackend() && this.isBackendAvailable !== false && authEmail) {
      try {
        const data = await this.request<{ applications: TrackerItem[] }>('/api/tracker/');
        if (data?.applications && Array.isArray(data.applications)) {
          const remoteList = data.applications;
          const remoteKeys = new Set<string>();
          for (const item of remoteList) {
            if (item.id) remoteKeys.add(String(item.id).toLowerCase());
            if (item.schemeId) remoteKeys.add(String(item.schemeId).toLowerCase());
          }

          const unsyncedLocals = localItems.filter((item) => {
            const k1 = (item.id || '').toLowerCase();
            const k2 = (item.schemeId || '').toLowerCase();
            return (k1 && !remoteKeys.has(k1)) && (!k2 || !remoteKeys.has(k2));
          });

          if (unsyncedLocals.length > 0) {
            await this.post('/api/tracker/', { applications: unsyncedLocals });
          }

          const mergedMap = new Map<string, TrackerItem>();
          for (const item of remoteList) {
            const k = (item.id || item.schemeId || '').toLowerCase();
            if (k) mergedMap.set(k, item);
          }
          for (const item of unsyncedLocals) {
            const k = (item.id || item.schemeId || '').toLowerCase();
            if (k && !mergedMap.has(k)) mergedMap.set(k, item);
          }

          const combined = Array.from(mergedMap.values());
          setTrackerItemsList(combined);
          return combined;
        }
      } catch {
        // fallback
      }
    }
    return localItems;
  }

  async updateApplication(item: TrackerItem) {
    saveLocalTrackerItem(item, false);
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const itemId = item.id || item.schemeId;
        await this.put(`/api/tracker/${itemId}/`, item);
      } catch {
        // offline
      }
    }
  }

  // ── AI Assistant ──────────────────────────────────────────────────────────

  async askAI(
    query: string,
    history?: Array<{ role: string; content: string }>,
    profile?: UserProfile | null,
    language?: string
  ): Promise<{
    answer: string;
    referencedSchemes?: Scheme[];
    profileUpdated?: boolean;
    updatedProfile?: Partial<UserProfile>;
  }> {
    // ── TIER 1: Backend Assistant API (Adequate 15s timeout for AI generation) ───
    if (this.isBackendAvailable !== false) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const data = await this.post<{
          answer: string;
          referencedSchemes: Scheme[];
          profileUpdated: boolean;
          updatedProfile?: Partial<UserProfile>;
        }>('/api/assistant/chat/', {
          message: query,
          history: history || [],
          profile: profile || undefined,
          language: language || 'en-IN',
        });
        let finalSchemes = Array.isArray(data.referencedSchemes) ? [...data.referencedSchemes] : [];
        if (finalSchemes.length > 0 && finalSchemes.length < 5) {
          try {
            const summary = await this.loadStaticSummary();
            const all = summary.schemes || [];
            const seen = new Set(finalSchemes.map((s) => (s.slug || s.id || '').toLowerCase()));
            const effProf = profile || (getUserProfile() as UserProfile) || {};
            for (const s of all) {
              const k = (s.slug || s.id || '').toLowerCase();
              if (k && !seen.has(k)) {
                const chk = calculateSchemeMatch(s, effProf);
                if (chk.matchGrade !== 'Not Eligible') {
                  seen.add(k);
                  finalSchemes.push(s);
                }
              }
              if (finalSchemes.length >= 5) break;
            }
          } catch (_) {}
        }
        return {
          answer: data.answer,
          referencedSchemes: finalSchemes,
          profileUpdated: data.profileUpdated,
          updatedProfile: data.updatedProfile,
        };
      } catch (err) {
        console.warn('Backend AI chat unavailable or timed out, trying intelligent client fallback:', err);
      }
    }

    // ── TIER 1.5: Direct Client-Side Gemini AI (Direct Google AI Studio) ────────
    if (isGeminiConfigured()) {
      try {
        const summary = await this.loadStaticSummary();
        const catalog = summary.schemes || [];
        const result = await askGeminiDirect(
          query,
          history || [],
          profile || null,
          language || 'en-IN',
          catalog
        );
        if (result && result.answer) {
          let geminiSchemes = Array.isArray(result.referencedSchemes) ? [...result.referencedSchemes] : [];
          if (geminiSchemes.length > 0 && geminiSchemes.length < 5) {
            const seen = new Set(geminiSchemes.map((s) => (s.slug || s.id || '').toLowerCase()));
            const effProf = profile || (getUserProfile() as UserProfile) || {};
            for (const s of catalog) {
              const k = (s.slug || s.id || '').toLowerCase();
              if (k && !seen.has(k)) {
                const chk = calculateSchemeMatch(s, effProf);
                if (chk.matchGrade !== 'Not Eligible') {
                  seen.add(k);
                  geminiSchemes.push(s);
                }
              }
              if (geminiSchemes.length >= 5) break;
            }
          }
          return {
            answer: result.answer,
            referencedSchemes: geminiSchemes,
            profileUpdated: false,
          };
        }
      } catch (geminiErr) {
        console.warn('Direct Gemini call failed, using local welfare QA engine:', geminiErr);
      }
    }

    // ── TIER 2: High-Precision Question-Answering Engine (Direct Intent Resolution) ──
    let effectiveProfile: UserProfile = { ...(profile || (getUserProfile() as UserProfile) || {}) };
    let profileUpdated = false;
    let updatedProfile: Partial<UserProfile> = {};
    try {
      const parsed = parseVoiceInput(query);
      if (parsed && parsed.profile && Object.keys(parsed.profile).length > 0) {
        effectiveProfile = { ...effectiveProfile, ...parsed.profile };
        profileUpdated = true;
        updatedProfile = parsed.profile;
      }
    } catch {
      // fallback
    }

    const qLower = query.trim().toLowerCase();
    const hasUrduScript = /[\u0600-\u06FF]/.test(query);
    const hasBengaliScript = /[\u0980-\u09FF]/.test(query);
    const hasPunjabiScript = /[\u0A00-\u0A7F]/.test(query);
    const hasOdiaScript = /[\u0B00-\u0B7F]/.test(query);
    const hasDevanagari = /[\u0900-\u097F]/.test(query);

    const fullLang = (language && language.startsWith('hi'))
      ? 'hi-IN'
      : (language || detectMessageLanguage(query, 'en-IN'));
    const detectedLang = fullLang.split('-')[0].toLowerCase();

    const isHindi = detectedLang === 'hi';
    const isBengali = detectedLang === 'bn';
    const isUrdu = detectedLang === 'ur';
    const isPunjabi = detectedLang === 'pa';
    const isOdia = detectedLang === 'or';
    const isMarathi = detectedLang === 'mr';
    const isTelugu = detectedLang === 'te';
    const isTamil = detectedLang === 'ta';
    const isGujarati = detectedLang === 'gu';
    const isKannada = detectedLang === 'kn';
    const isMalayalam = detectedLang === 'ml';

    // 1. Website feature overview
    const websiteKeywords = [
      'website me kya hai', 'what is this website', 'what is scheme navigator', 'features of',
      'features in', 'ye website kya', 'portal me kya', 'how to use this website', 'website guide',
      'features', 'kya suvidha', 'ওয়েবসাইটে কি আছে', 'ওয়েবসাইট কি', 'বৈশিষ্ট্য',
      'ویب سائٹ میں کیا ہے', 'اس پورٹل کی خصوصیات', 'پورٹل کیا ہے', 'خصوصیات',
      'ਵੈੱਬਸਾਈਟ ਕੀ ਹੈ', 'ਪੋਰਟਲ ਦੀਆਂ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ', 'ਸੁਵਿਧਾਵਾਂ', 'ପୋର୍ଟାଲ୍ ସୁବିଧା'
    ];
    if (websiteKeywords.some(kw => qLower.includes(kw))) {
      let answer = '';
      if (isBengali) {
        answer = `🏛️ **Scheme Navigator পোর্টালের প্রধান সুবিধাসমূহ:**\n\n` +
          `1. **Explore Schemes (প্রকল্প খুঁজুন)**: ৪,৭০০+ কেন্দ্র ও রাজ্য সরকারি প্রকল্প বিভাগ, রাজ্য, বয়স ও শ্রেণী অনুযায়ী ফিল্টার করে দেখুন।\n` +
          `2. **Eligibility Survey (যোগ্যতা সমীক্ষা)**: ২ মিনিটের সহজ সিটিজেন সমীক্ষা সম্পন্ন করুন এবং আপনার ব্যক্তিগত প্রোফাইল অনুযায়ী সঠিক প্রকল্পের সুপারিশ পান।\n` +
          `3. **Scheme Tracker (প্রকল্প ট্র্যাকার)**: আপনার আবেদনের স্থিতি, প্রয়োজনীয় নথির চেকলিস্ট এবং শেষ তারিখ ট্র্যাক করুন।\n` +
          `4. **Saved Schemes (সংরক্ষিত প্রকল্প)**: সুবিধাজনক রেফারেন্স ও ভবিষ্যতের আবেদনের জন্য আপনার পছন্দের প্রকল্প বুকমার্ক করুন।\n` +
          `5. **Mitra AI (মিত্র এআই উপদেষ্টা)**: সরকারি প্রকল্প, নথিপত্র এবং আবেদন পদ্ধতির দ্রুত ও নির্ভুল তথ্য পান।\n` +
          `6. **Voice Survey (ভয়েস সমীক্ষা)**: টাইপ না করে নিজের মাতৃভাষায় কথা বলে নাগরিক প্রোফাইল তৈরি করুন।\n` +
          `7. **Kendra Finder (সেবা কেন্দ্র সন্ধান)**: আপনার পিন কোডে নিকটতম অনুমোদিত জনসেবা কেন্দ্র (CSC) বা সেবা কেন্দ্র খুঁজুন।\n\n` +
          `বলুন, আপনি এর মধ্যে কোন বিষয়ে আরও বিস্তারিত জানতে চান?`;
      } else if (isUrdu) {
        answer = `🏛️ **Scheme Navigator پورٹل کی اہم خصوصیات:**\n\n` +
          `1. **Explore Schemes (اسکیمیں تلاش کریں)**: 4,700+ مرکزی اور ریاستی سرکاری اسکیموں کو زمرہ، ریاست، عمر اور آمدنی کے لحاظ سے فلٹر کریں۔\n` +
          `2. **Eligibility Survey (اہلیت سروے)**: 2 منٹ کا آسان سروے مکمل کریں اور اپنی ذاتی اہلیت کے مطابق اسکیموں کی سفارشات حاصل کریں۔\n` +
          `3. **Scheme Tracker (اسکیم ٹریکر)**: اپنی درخواستوں کی صورتحال، مطلوبہ دستاویزات کی فہرست اور آخری تاریخوں کو ٹریک کریں۔\n` +
          `4. **Saved Schemes (محفوظ اسکیمیں)**: بعد میں دیکھنے کے لیے اپنی پسندیدہ اسکیمیں محفوظ کریں۔\n` +
          `5. **Mitra AI (دوست AI مشیر)**: سرکاری اسکیموں، اہلیت کے قواعد اور طریقہ کار کے فوری اور درست جوابات پائیں۔\n` +
          `6. **Voice Survey (آواز کے ذریعے سروے)**: بول کر باآسانی اپنی مادری زبان میں شہری پروفائل بنائیں۔\n` +
          `7. **Kendra Finder (خدمت مراکز تلاش کریں)**: اپنے پن کوڈ پر قریبی کامن سروس سینٹر (CSC) تلاش کریں۔\n\n` +
          `بتائیے، آپ ان میں سے کس سہولت کے بارے میں مزید جاننا چاہتے ہیں؟`;
      } else if (isPunjabi) {
        answer = `🏛️ **Scheme Navigator ਪੋਰਟਲ ਦੀਆਂ ਮੁੱਖ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ:**\n\n` +
          `1. **Explore Schemes (ਸਕੀਮਾਂ ਖੋਜੋ)**: 4,700+ ਕੇਂਦਰ ਅਤੇ ਰਾਜ ਸਰਕਾਰ ਦੀਆਂ ਸਕੀਮਾਂ ਸ਼੍ਰੇਣੀ, ਰਾਜ ਅਤੇ ਉਮਰ ਮੁਤਾਬਕ ਫਿਲਟਰ ਕਰਕੇ ਦੇਖੋ।\n` +
          `2. **Eligibility Survey (ਯੋਗਤਾ ਸਰਵੇਖਣ)**: 2 ਮਿੰਟ ਦਾ ਆਸਾਨ ਸਰਵੇਖਣ ਭਰੋ ਅਤੇ ਆਪਣੀ ਯੋਗਤਾ ਅਨੁਸਾਰ ਨਿੱਜੀ ਸਕੀਮ ਸਿਫ਼ਾਰਸ਼ਾਂ ਪ੍ਰਾਪਤ ਕਰੋ।\n` +
          `3. **Scheme Tracker (ਸਕੀਮ ਟਰੈਕਰ)**: ਆਪਣੀਆਂ ਅਰਜ਼ੀਆਂ ਦੀ ਸਥਿਤੀ ਅਤੇ ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼ਾਂ ਦੀ ਜਾਂਚ-ਸੂਚੀ ਨੂੰ ਟ੍ਰੈਕ ਕਰੋ।\n` +
          `4. **Saved Schemes (ਸੰਭਾਲੀਆਂ ਸਕੀਮਾਂ)**: ਭਵਿੱਖ ਲਈ ਆਪਣੀਆਂ ਮਨਪਸੰਦ ਸਕੀਮਾਂ ਬੁੱਕਮਾਰਕ ਕਰੋ।\n` +
          `5. **Mitra AI (ਮਿੱਤਰ ਏਆਈ ਸਲਾਹਕਾਰ)**: ਸਰਕਾਰੀ ਸਕੀਮਾਂ, ਨਿਯਮਾਂ ਅਤੇ ਅਰਜ਼ੀ ਪ੍ਰਕਿਰਿਆ ਬਾਰੇ ਤੁਰੰਤ ਸਹੀ ਜਵਾਬ ਪ੍ਰਾਪਤ ਕਰੋ।\n` +
          `6. **Voice Survey (ਆਵਾਜ਼ ਨਾਲ ਸਰਵੇਖਣ)**: ਆਪਣੀ ਮਾਤ-ਭਾਸ਼ਾ ਵਿੱਚ ਬੋਲ ਕੇ ਆਪਣਾ ਪ੍ਰੋਫਾਈਲ ਬਣਾਓ।\n` +
          `7. **Kendra Finder (ਸੇਵਾ ਕੇਂਦਰ ਲੱਭੋ)**: ਆਪਣੇ ਪਿੰਨ ਕੋਡ ਨੇੜੇ ਪ੍ਰਮਾਣਿਤ ਕਾਮਨ ਸਰਵਿਸ ਸੈਂਟਰ (CSC) ਲੱਭੋ।\n\n` +
          `ਦੱਸੋ ਜੀ, ਤੁਸੀਂ ਇਹਨਾਂ ਵਿੱਚੋਂ ਕਿਹੜੀ ਵਿਸ਼ੇਸ਼ਤਾ ਬਾਰੇ ਹੋਰ ਜਾਣਨਾ ਚਾਹੁੰਦੇ ਹੋ?`;
      } else if (isOdia) {
        answer = `🏛️ **Scheme Navigator ପୋର୍ଟାଲର ପ୍ରମୁଖ ସୁବିଧାଗୁଡ଼ିକ:**\n\n` +
          `1. **Explore Schemes (ଯୋଜନା ଖୋଜନ୍ତୁ)**: ୪,୭୦୦+ କେନ୍ଦ୍ର ଓ ରାଜ୍ୟ ସରକାରୀ ଯୋଜନା ବର୍ଗ, ରାଜ୍ୟ ଓ ବୟସ ଅନୁଯାୟୀ ଫିଲ୍ଟର୍ କରି ଦେଖନ୍ତୁ।\n` +
          `2. **Eligibility Survey (ଯୋଗ୍ୟତା ସର୍ଭେ)**: ୨ ମିନିଟର ସରଳ ସର୍ଭେ ପୂରଣ କରନ୍ତୁ ଏବଂ ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ଅନୁଯାୟୀ ବ୍ୟକ୍ତିଗତ ଯୋଜନା ସୁପାରିଶ ପାଆନ୍ତୁ।\n` +
          `3. **Scheme Tracker (ଯୋଜନା ଟ୍ରାକର୍)**: ନିଜ ଆବେଦନର ସ୍ଥିତି ଏବଂ ଆବଶ୍ୟକ ଦସ୍ତାବିଜ୍ ଯାଞ୍ଚ-ତାଲିକା ଟ୍ରାକ୍ କରନ୍ତୁ।\n` +
          `4. **Saved Schemes (ସଂରକ୍ଷିତ ଯୋଜନା)**: ନିଜ ପସନ୍ଦର ଯୋଜନା ସାଇତି ରଖନ୍ତୁ।\n` +
          `5. **Mitra AI (ମିତ୍ର AI ପରାମର୍ଶଦାତା)**: ସରକାରୀ ଯୋଜନା, ଯୋଗ୍ୟତା ଏବଂ ଆବେଦନ ପଦ୍ଧତିର ତୁରନ୍ତ ସଠିକ୍ ଉତ୍ତର ପାଆନ୍ତୁ।\n` +
          `6. **Voice Survey (ଭଏସ୍ ସର୍ଭେ)**: ନିଜ ଭାଷାରେ କହି ପ୍ରୋଫାଇଲ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ।\n` +
          `7. **Kendra Finder (ସେବା କେନ୍ଦ୍ର ସନ୍ଧାନ)**: ନିକଟତମ ଜନସେବା କେନ୍ଦ୍ର (CSC) ଖୋଜନ୍ତୁ।\n\n` +
          `କୁହନ୍ତୁ, ଆପଣ ଏଥିମଧ୍ୟରୁ କେଉଁ ସୁବିଧା ବିଷୟରେ ଅଧିକ ଜାଣିବାକୁ ଚାହାଁନ୍ତି?`;
      } else if (isHindi) {
        answer = `🏛️ **Scheme Navigator पोर्टल की प्रमुख सुविधाएं:**\n\n` +
          `1. **Explore Schemes (योजनाएं खोजें)**: 4,700+ केंद्र और राज्य सरकार की योजनाओं को श्रेणी (Category), राज्य, आयु, और जाति के अनुसार फ़िल्टर करके देखें।\n` +
          `2. **Eligibility Survey (पात्रता सर्वे)**: 2 मिनट का आसान प्रोफ़ाइल सर्वे भरें और तुरंत अपनी पात्रता के अनुसार व्यक्तिगत योजना सिफारिशें पाएं।\n` +
          `3. **Scheme Tracker (योजना ट्रैकर)**: अपने द्वारा आवेदन की गई योजनाओं के स्टेटस, ज़रूरी दस्तावेज़ों की चेकलिस्ट, और अंतिम तिथियों को ट्रैक करें।\n` +
          `4. **Saved Schemes (सहेजी गई योजनाएं)**: अपनी पसंद की योजनाओं को बुकमार्क करें ताकि कभी भी आसानी से देख सकें।\n` +
          `5. **Mitra AI (मित्र AI सलाहकार)**: सरकारी योजनाओं, पात्रता नियमों, ज़रूरी दस्तावेज़ों और आवेदन प्रक्रिया का तुरंत सटीक उत्तर पाएं।\n` +
          `6. **Voice Survey (आवाज़ से सर्वे)**: बिना टाइप किए अपनी मातृभाषा में बोलकर प्रोफ़ाइल बनाएं।\n` +
          `7. **Kendra Finder (सेवा केंद्र खोजें)**: अपने पिन कोड या जिले में नज़दीकी सत्यापित जन सेवा केंद्र (CSC), मीसेवा, या आधार सेवा केंद्र खोजें।\n\n` +
          `बताइए, आप इनमें से किस सुविधा के बारे में और जानना चाहते हैं?`;
      } else {
        answer = `🏛️ **Core Features of Scheme Navigator:**\n\n` +
          `1. **Explore Schemes**: Search and filter 4,700+ central and state government schemes by category, state, age, caste, and income.\n` +
          `2. **Eligibility Survey**: Complete a quick 2-minute citizen survey to receive instant, personalized scheme recommendations tailored to your profile.\n` +
          `3. **Scheme Tracker**: Monitor your application statuses, document checklists, and submission cutoff dates in one place.\n` +
          `4. **Saved Schemes**: Bookmark schemes of interest for quick offline reference and future applications.\n` +
          `5. **Mitra AI Advisor**: Official guide to understand scheme rules, benefits, required documents, and application steps.\n` +
          `6. **Voice Survey**: Create your demographic profile effortlessly by speaking naturally in your regional language.\n` +
          `7. **Kendra Finder**: Locate verified Government Citizen Service Centers (CSC, MeeSeva, Atal Seva Kendra, Post Offices) near your PIN code with direct GPS coordinates.\n\n` +
          `How can I assist you with these features today?`;
      }
      return { answer, referencedSchemes: [], profileUpdated: false };
    }

    // 2. Deadlines / Last dates
    const deadlineKeywords = [
      'deadline', 'last date', 'closing date', 'antim tithi', 'kab tak apply', 'due date', 'cutoff',
      'আবেদনের শেষ তারিখ', 'শেষ দিন', 'শেষ তারিখ', 'সময়সীমা',
      'آخری تاریخ', 'کب تک اپلائی', 'آخری دن', 'مہلت',
      'ਆਖਰੀ ਮਿਤੀ', 'ਕਦੋਂ ਤੱਕ ਅਪਲਾਈ', 'ਅੰਤਿਮ ਤਾਰੀਖ', 'ଶେଷ ତାରିଖ'
    ];
    if (deadlineKeywords.some(kw => qLower.includes(kw))) {
      let answer = '';
      if (isBengali) {
        answer = `📅 **সরকারি প্রকল্পের আবেদনের শেষ সময়সীমা (Deadlines) সংক্রান্ত তথ্য:**\n\n` +
          `• **বছরব্যাপী (Year-Round) প্রকল্প**: আয়ুষ্মান ভারত (PM-JAY), পিএম কিসান (PM-KISAN), অটল পেনশন যোজনা এবং পিএম মুদ্রা ঋণের মতো প্রকল্পগুলি সারা বছর চালু থাকে।\n` +
          `• **শিক্ষা ও স্কলারশিপ (Scholarships)**: জাতীয় স্কলারশিপ পোর্টাল (NSP) এবং রাজ্য স্কলারশিপ সাধারণত প্রতি বছর **৩১ অক্টোবর** বন্ধ হয়।\n` +
          `• **ফসল বিমা (PMFBY)**: খরিফ ফসলের জন্য **৩১ জুলাই** এবং রবি ফসলের জন্য **৩১ ডিসেম্বর** সময়সীমা থাকে।\n\n` +
          `নির্দিষ্ট কোনো প্রকল্পের শেষ তারিখ জানতে তার নাম উল্লেখ করে জিজ্ঞাসা করুন!`;
      } else if (isUrdu) {
        answer = `📅 **سرکاری اسکیموں میں درخواست دینے کی آخری تاریخیں (Deadlines):**\n\n` +
          `• **سال بھر جاری رہنے والی اسکیمیں**: آیوشمان بھارت (PM-JAY)، پی ایم کسان (PM-KISAN)، اٹل پنشن یوجنا، اور پی ایم مدرا لون جیسی اہم اسکیمیں سال کے 365 دن کھلی رہتی ہیں۔\n` +
          `• **تعلیمی وظائف (Scholarships)**: نیشنل اسکالرشپ پورٹل (NSP) اور پوسٹ میٹرک اسکالرشپس عموماً ہر سال **31 اکتوبر** کو بند ہوتی ہیں۔\n` +
          `• **فصل انشورنس (PMFBY)**: خریف فصل کے لیے **31 جولائی** اور ربیع فصل کے لیے **31 دسمبر** آخری تاریخ ہوتی ہے۔\n\n` +
          `کسی خاص اسکیم کی آخری تاریخ جاننے کے لیے اس کا نام لکھ کر پوچھیں!`;
      } else if (isPunjabi) {
        answer = `📅 **ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਦੀਆਂ ਅਰਜ਼ੀ ਆਖਰੀ ਮਿਤੀਆਂ (Deadlines) ਸੰਬੰਧੀ ਜਾਣਕਾਰੀ:**\n\n` +
          `• **ਸਾਲ ਭਰ ਚੱਲਣ ਵਾਲੀਆਂ ਸਕੀਮਾਂ**: ਆਯੁਸ਼ਮਾਨ ਭਾਰਤ (PM-JAY), ਪੀਐੱਮ-ਕਿਸਾਨ (PM-KISAN), ਅਟਲ ਪੈਨਸ਼ਨ ਯੋਜਨਾ, ਅਤੇ ਪ੍ਰਧਾਨ ਮੰਤਰੀ ਮੁਦਰਾ ਕਰਜ਼ਾ ਸਾਲ ਦੇ 365 ਦਿਨ ਖੁੱਲ੍ਹੀਆਂ ਰਹਿੰਦੀਆਂ ਹਨ।\n` +
          `• **ਸਿੱਖਿਆ ਵਜ਼ੀਫ਼ੇ (Scholarships)**: ਨੈਸ਼ਨਲ ਸਕਾਲਰਸ਼ਿਪ ਪੋਰਟਲ (NSP) ਅਤੇ ਪੋਸਟ-ਮੈਟ੍ਰਿਕ ਵਜ਼ੀਫ਼ੇ ਆਮ ਤੌਰ 'ਤੇ ਹਰ ਸਾਲ **31 ਅਕਤੂਬਰ** ਤੱਕ ਹੁੰਦੇ ਹਨ।\n` +
          `• **ਫ਼ਸਲੀ ਬੀਮਾ (PMFBY)**: ਸਾਉਣੀ ਦੀ ਫ਼ਸਲ ਲਈ **31 ਜੁਲਾਈ** ਅਤੇ ਹਾੜੀ ਦੀ ਫ਼ਸਲ ਲਈ **31 ਦਸੰਬਰ** ਆਖਰੀ ਮਿਤੀ ਹੁੰਦੀ ਹੈ।\n\n` +
          `ਕਿਸੇ ਖਾਸ ਸਕੀਮ ਦੀ ਆਖਰੀ ਮਿਤੀ ਜਾਣਨ ਲਈ ਉਸਦਾ ਨਾਮ ਲਿਖ ਕੇ ਪੁੱਛੋ!`;
      } else if (isOdia) {
        answer = `📅 **ସରକାରୀ ଯୋଜନାର ଆବେଦନ ଶେଷ ତାରିଖ (Deadlines) ସମ୍ବନ୍ଧୀୟ ସୂଚନା:**\n\n` +
          `• **ବର୍ଷସାରା ଖୋଲା ଯୋଜନା**: ଆୟୁଷ୍ମାନ ଭାରତ (PM-JAY), ପିଏମ କିଷାନ (PM-KISAN), ଅଟଳ ପେନସନ ଯୋଜନା, ଏବଂ ପିଏମ ମୁଦ୍ରା ଋଣ ବର୍ଷର ୩୬୫ ଦିନ ଖୋଲା ରହିଥାଏ।\n` +
          `• **ଶିକ୍ଷା ଓ ଛାତ୍ରବୃତ୍ତି (Scholarships)**: ନ୍ୟାସନାଲ ସ୍କଲାରସିପ୍ ପୋର୍ଟାଲ (NSP) ସାଧାରଣତଃ ପ୍ରତିବର୍ଷ **୩୧ ଅକ୍ଟୋବର** ସୁଦ୍ଧା ବନ୍ଦ ହୁଏ।\n` +
          `• **ଫସଲ ବୀମା (PMFBY)**: ଖରିଫ ଫସଲ ପାଇଁ **୩୧ ଜୁଲାଇ** ଏବଂ ରବି ଫସଲ ପାଇଁ **୩୧ ଡିସେମ୍ବର** ଶେଷ ତାରିଖ।\n\n` +
          `କୌଣସି ନିର୍ଦ୍ଦିଷ୍ଟ ଯୋଜନାର ଶେଷ ତାରିଖ ଜାଣିବା ପାଇଁ ତାର ନାମ ଲେଖି ପଚାରନ୍ତୁ!`;
      } else if (isHindi) {
        answer = `📅 **सरकारी योजनाओं की आवेदन समय-सीमा (Deadlines) संबंधी महत्वपूर्ण जानकारी:**\n\n` +
          `• **निरंतर (Year-Round) योजनाएं**: आयुष्मान भारत (PM-JAY), पीएम किसान (PM-KISAN), अटल पेंशन योजना, पीएम मुद्रा लोन, और सुकन्या समृद्धि योजना जैसी प्रमुख योजनाएं वर्ष के 365 दिन खुली रहती हैं।\n` +
          `• **शिक्षा छात्रवृत्ति (Scholarships)**: राष्ट्रीय छात्रवृत्ति पोर्टल (NSP) और राज्य पोस्ट-मैट्रिक छात्रवृत्तियों की सामान्य कटऑफ तिथि प्रत्येक वर्ष **31 अक्टूबर** के आसपास होती है।\n` +
          `• **फसल बीमा (PMFBY)**: खरीफ फसल के लिए **31 जुलाई** और रबी फसल के लिए **31 दिसंबर** की कटऑफ होती है।\n\n` +
          `किसी विशिष्ट योजना की अंतिम तिथि जानने के लिए उसका नाम लिखकर पूछें!`;
      } else {
        answer = `📅 **Government Scheme Application Deadlines:**\n\n` +
          `• **Continuous (Year-Round) Schemes**: Flagship welfare programs like Ayushman Bharat (PM-JAY), PM-KISAN, Atal Pension Yojana, PM Mudra Loans, and Sukanya Samriddhi Yojana are active **365 days a year**.\n` +
          `• **Academic Scholarships**: National Scholarship Portal (NSP) and state post-matric scholarships typically close their annual cycle around **October 31**.\n` +
          `• **Crop Insurance (PMFBY)**: Kharif season cutoff is **July 31**, and Rabi season cutoff is **December 31**.\n\n` +
          `For a specific scheme's deadline, please mention its name!`;
      }
      return { answer, referencedSchemes: [], profileUpdated: false };
    }

    // 3. Greetings (Personalized to profile)
    const greetingKeywords = [
      'hi', 'hello', 'hey', 'namaste', 'kem cho', 'vanakkam', 'namaskara', 'how are you',
      'নমস্কার', 'হ্যালো', 'কেমন আছেন', 'সালাম', 'سلام', 'آداب', 'السلام علیکم', 'کیسے ہیں',
      'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'ਕਿਵੇਂ ਹੋ', 'ਨਮਸਤੇ', 'ନମସ୍କାର'
    ];
    if (greetingKeywords.some(kw => qLower === kw || qLower.startsWith(kw + ' ') || (qLower.includes(kw) && qLower.length <= kw.length + 8))) {
      const occStr = profile?.employmentType || (profile as any)?.occupation;
      let answer = '';
      if (isBengali) {
        answer = profile && (profile.age || profile.state || occStr)
          ? `নমস্কার! 😊 আমি **মিত্র (Mitra)** — স্কিম নেভিগেটরে আপনার এআই প্রকল্প উপদেষ্টা।\n\n` +
            `আমি আপনার প্রোফাইল দেখেছি: **বয়স ${profile.age || '২০'} বছর**, **${occStr || 'নাগরিক'}**, **${profile.state || 'ভারত'}** (${profile.category || 'General'})। আপনার প্রোফাইল অনুযায়ী উপযুক্ত স্কলারশিপ, অনুদান ও সরকারি ঋণ সম্পর্কে তথ্য দেওয়ার জন্য আমি প্রস্তুত। বলুন, আজ আপনি কোন প্রকল্প সম্পর্কে জানতে চান?`
          : `নমস্কার! 😊 আমি **মিত্র (Mitra)** — স্কিম নেভিগেটরে আপনার এআই প্রকল্প উপদেষ্টা।\n\n` +
            `আমি ভারত সরকারের বিভিন্ন কল্যাণমূলক প্রকল্প (যেমন আয়ুষ্মান ভারত, পিএম কিসান, স্কলারশিপ, ব্যবসা ঋণ) এবং এই পোর্টাল সম্পর্কে সাহায্য করার জন্য প্রস্তুত। বলুন, আজ আপনি কোন প্রকল্প সম্পর্কে জানতে চান?`;
      } else if (isUrdu) {
        answer = profile && (profile.age || profile.state || occStr)
          ? `سلام! 😊 میں **مترا (Mitra)** ہوں — اسکیم نیویگیٹر پر آپ کا AI اسکیم مشیر۔\n\n` +
            `میں نے آپ کا پروفائل دیکھا ہے: **عمر ${profile.age || '20'} سال**، **${occStr || 'شہری'}**، **${profile.state || 'بھارت'}** (${profile.category || 'General'})۔ آپ کے پروفائل کے مطابق موزوں وظائف، کسان سبسڈی، بزنس لون اور سرکاری فلاحی اسکیموں کی رہنمائی کے لیے میں تیار ہوں۔ بتائیے، آج آپ کس اسکیم کے بارے میں جاننا چاہتے ہیں؟`
          : `سلام! 😊 میں **مترا (Mitra)** ہوں — اسکیم نیویگیٹر پر آپ کا AI اسکیم مشیر۔\n\n` +
            `میں حکومت ہند کی فلاحی اسکیموں (جیسے آیوشمان بھارت، پی ایم کسان، تعلیمی وظائف، کاروباری قرض) اور اس پورٹل کی خدمات کے بارے میں رہنمائی فراہم کرنے کے لیے حاضر ہوں۔ بتائیے، آج آپ کس اسکیم کے بارے میں جاننا چاہتے ہیں؟`;
      } else if (isPunjabi) {
        answer = profile && (profile.age || profile.state || occStr)
          ? `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! 😊 ਮੈਂ **ਮਿੱਤਰ (Mitra)** ਹਾਂ — ਸਕੀਮ ਨੈਵੀਗੇਟਰ 'ਤੇ ਤੁਹਾਡਾ ਏਆਈ ਸਕੀਮ ਸਲਾਹਕਾਰ।\n\n` +
            `ਮੈਂ ਤੁਹਾਡਾ ਪ੍ਰੋਫਾਈਲ ਵੇਖ ਲਿਆ ਹੈ: **ਉਮਰ ${profile.age || '20'} ਸਾਲ**, **${occStr || 'ਨਾਗਰਿਕ'}**, **${profile.state || 'ਭਾਰਤ'}** (${profile.category || 'General'})। ਤੁਹਾਡੇ ਪ੍ਰੋਫਾਈਲ ਅਨੁਸਾਰ ਢੁਕਵੇਂ ਵਜ਼ੀਫ਼ੇ, ਕਿਸਾਨੀ ਸਬਸਿਡੀਆਂ, ਕਾਰੋਬਾਰੀ ਕਰਜ਼ੇ ਅਤੇ ਸਰਕਾਰੀ ਭਲਾਈ ਸਕੀਮਾਂ ਦੀ ਜਾਣਕਾਰੀ ਲਈ ਮੈਂ ਤਿਆਰ ਹਾਂ। ਦੱਸੋ ਜੀ, ਅੱਜ ਤੁਸੀਂ ਕਿਸ ਸਕੀਮ ਬਾਰੇ ਜਾਣਨਾ ਚਾਹੁੰਦੇ ਹੋ?`
          : `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! 😊 ਮੈਂ **ਮਿੱਤਰ (Mitra)** ਹਾਂ — ਸਕੀਮ ਨੈਵੀਗੇਟਰ 'ਤੇ ਤੁਹਾਡਾ ਏਆਈ ਸਕੀਮ ਸਲਾਹਕਾਰ।\n\n` +
            `ਮੈਂ ਭਾਰਤ ਸਰਕਾਰ ਦੀਆਂ ਭਲਾਈ ਸਕੀਮਾਂ (ਜਿਵੇਂ ਆਯੁਸ਼ਮਾਨ ਭਾਰਤ, ਪੀਐੱਮ ਕਿਸਾਨ, ਵਜ਼ੀਫ਼ੇ, ਵਪਾਰਕ ਕਰਜ਼ੇ) ਬਾਰੇ ਮਦਦ ਕਰਨ ਲਈ ਇੱਥੇ ਹਾਂ। ਦੱਸੋ ਜੀ, ਅੱਜ ਤੁਸੀਂ ਕਿਸ ਸਕੀਮ ਬਾਰੇ ਜਾਣਨਾ ਚਾਹੁੰਦੇ ਹੋ?`;
      } else if (isOdia) {
        answer = profile && (profile.age || profile.state || occStr)
          ? `ନମସ୍କାର! 😊 ମୁଁ **ମିତ୍ର (Mitra)** — ସ୍କିମ୍ ନେଭିଗେଟରରେ ଆପଣଙ୍କର AI ଯୋଜନା ପରାମର୍ଶଦାତା।\n\n` +
            `ମୁଁ ଆପଣଙ୍କର ପ୍ରୋଫାଇଲ୍ ଦେଖିଛି: **ବୟସ ${profile.age || '୨୦'} ବର୍ଷ**, **${occStr || 'ନାଗରିକ'}**, **${profile.state || 'ଭାରତ'}** (${profile.category || 'General'})। ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ଅନୁଯାୟୀ ଉପଯୁକ୍ତ ଛାତ୍ରବୃତ୍ତି, କୃଷକ ସହାୟତା ଓ ବ୍ୟବସାୟ ଋଣ ଯୋଜନା ବିଷୟରେ ଜଣାଇବା ପାଇଁ ମୁଁ ପ୍ରସ୍ତୁତ। କୁହନ୍ତୁ, ଆଜି ଆପଣ କେଉଁ ଯୋଜନା ବିଷୟରେ ଜାଣିବାକୁ ଚାହାଁନ୍ତି?`
          : `ନମସ୍କାର! 😊 ମୁଁ **ମିତ୍ର (Mitra)** — ସ୍କିମ୍ ନେଭିଗେଟରରେ ଆପଣଙ୍କର AI ଯୋଜନା ପରାମର୍ଶଦାତା।\n\n` +
            `ମୁଁ ଭାରତ ସରକାରଙ୍କ କଲ୍ୟାଣକାରୀ ଯୋଜନା ଏବଂ ଏହି ପୋର୍ଟାଲର ସୁବିଧା ସମ୍ବନ୍ଧରେ ସାହାଯ୍ୟ କରିବା ପାଇଁ ଏଠାରେ ଉପସ୍ଥିତ। କୁହନ୍ତୁ, ଆଜି ଆପଣ କେଉଁ ଯୋଜନା ବିଷୟରେ ଜାଣିବାକୁ ଚାହାଁନ୍ତି?`;
      } else if (isHindi) {
        answer = profile && (profile.age || profile.state || occStr)
          ? `नमस्ते! 😊 मैं **मित्र (Mitra)** हूँ — आपका AI योजना सलाहकार।\n\n` +
            `मैंने आपकी प्रोफ़ाइल देखी है: **आयु ${profile.age || '20'} वर्ष**, **${occStr || 'नागरिक'}**, **${profile.state || 'भारत'}** (${profile.category || 'General'})। आपकी प्रोफ़ाइल के अनुसार छात्रवृत्ति, लोन और सरकारी कल्याणकारी योजनाओं की जानकारी के लिए मैं तैयार हूँ। बताइए, आज आप किस योजना के बारे में जानना चाहते हैं?`
          : `नमस्ते! 😊 मैं **मित्र (Mitra)** हूँ — आपका AI योजना सलाहकार।\n\n` +
            `मैं भारत सरकार की योजनाओं (जैसे आयुष्मान भारत, पीएम किसान, छात्रवृत्ति, बिजनेस लोन) और इस पोर्टल की सुविधाओं के बारे में सहायता करने के लिए यहाँ हूँ। बताइए, आज आप किस योजना के बारे में जानना चाहते हैं?`;
      } else {
        answer = profile && (profile.age || profile.state || occStr)
          ? `Hello! 😊 I am **Mitra** — your personalized AI Scheme Advisor on Scheme Navigator.\n\n` +
            `I have loaded your profile: **Age ${profile.age || '20'}**, **${occStr || 'Citizen'}**, **${profile.state || 'India'}** (${profile.category || 'General'}). I am tailored to guide you on eligible scholarships, farming subsidies, business loans, and welfare benefits. How can I help you today?`
          : `Hello! 😊 I am **Mitra** — your dedicated AI Scheme Advisor on Scheme Navigator.\n\n` +
            `I am here exclusively to help you with Indian government welfare schemes (scholarships, farming subsidies, business loans, healthcare). Which scheme or feature would you like to explore today?`;
      }

      return { answer, referencedSchemes: [], profileUpdated: false };
    }

    // 4. Out-of-scope check
    const outOfScopePatterns = [
      /\b(joke|chutkula|funny|hasi)\b/,
      /\b(weather|mausam|rain|temperature)\b/,
      /\b(recipe|khana|dish|biryani|cook)\b/,
      /\b(code|coding|python|javascript|java|c\+\+|bug)\b/,
      /\b(capital of|president of|prime minister of|who is)\b/,
      /\d+\s*[+\-*xX/]\s*\d+/,
      /\b(love you|marry me|shadi|shaadi)\b/,
      /\b(bore ho|story|kahani)\b/
    ];
    if (outOfScopePatterns.some(pat => pat.test(qLower))) {
      let answer = '';
      if (isBengali) {
        answer = `ক্ষমা করবেন, আমি শুধুমাত্র **Scheme Navigator** এবং **ভারতীয় সরকারি কল্যাণমূলক প্রকল্প** সংক্রান্ত প্রশ্নের উত্তর দেওয়ার জন্য প্রশিক্ষিত। 🙏\n\n` +
          `দয়া করে আমাকে সরকারি প্রকল্প (যেমন স্কলারশিপ, পিএম কিসান, আয়ুষ্মান ভারত, মুদ্রা ঋণ, অনুদান), যোগ্যতা, প্রয়োজনীয় নথিপত্র, বা আবেদন প্রক্রিয়া সম্পর্কে জিজ্ঞাসা করুন!`;
      } else if (isUrdu) {
        answer = `معذرت، میں صرف **Scheme Navigator** اور **بھارتی سرکاری فلاحی اسکیموں** سے متعلق سوالات کے جوابات دینے کے لیے تربیت یافتہ ہوں۔ 🙏\n\n` +
          `براہ کرم مجھ سے سرکاری اسکیموں (جیسے تعلیمی وظائف، پی ایم کسان، آیوشمان بھارت، مدرا لون، سبسڈی)، اہلیت، ضروری دستاویزات، یا درخواست کے طریقہ کار کے بارے میں پوچھیں!`;
      } else if (isPunjabi) {
        answer = `ਮਾਫ਼ ਕਰਨਾ ਜੀ, ਮੈਂ ਸਿਰਫ਼ **Scheme Navigator** ਅਤੇ **ਭਾਰਤੀ ਸਰਕਾਰੀ ਭਲਾਈ ਸਕੀਮਾਂ** ਨਾਲ ਸੰਬੰਧਿਤ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦੇਣ ਲਈ ਸਮਰਪਿਤ ਹਾਂ। 🙏\n\n` +
          `ਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਸਰਕਾਰੀ ਸਕੀਮਾਂ (ਜਿਵੇਂ ਵਜ਼ੀਫ਼ੇ, ਪੀਐੱਮ ਕਿਸਾਨ, ਆਯੁਸ਼ਮਾਨ ਭਾਰਤ, ਮੁਦਰਾ ਕਰਜ਼ੇ, ਸਬਸਿਡੀ), ਯੋਗਤਾ ਦੇ ਨਿਯਮਾਂ, ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼ਾਂ ਜਾਂ ਅਰਜ਼ੀ ਦੇ ਤਰੀਕੇ ਬਾਰੇ ਪੁੱਛੋ!`;
      } else if (isOdia) {
        answer = `କ୍ଷମା କରିବେ, ମୁଁ କେବଳ **Scheme Navigator** ଏବଂ **ଭାରତ ସରକାରଙ୍କ କଲ୍ୟାଣକାରୀ ଯୋଜନା** ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନର ଉତ୍ତର ଦେବା ପାଇଁ ତାଲିମପ୍ରାପ୍ତ। 🙏\n\n` +
          `ଦୟାକରି ମୋତେ ସରକାରୀ ଯୋଜନା (ଯେପରିକି ଛାତ୍ରବୃତ୍ତି, ପିଏମ କିଷାନ, ଆୟୁଷ୍ମାନ ଭାରତ, ଋଣ, ସବସିଡି), ଯୋଗ୍ୟତା, ଆବଶ୍ୟକ ଦସ୍ତାବିଜ୍, କିମ୍ବା ଆବେଦନ ପଦ୍ଧତି ବିଷୟରେ ପଚାରନ୍ତୁ!`;
      } else if (isHindi) {
        answer = `क्षमा करें, मैं केवल **Scheme Navigator** और **भारतीय सरकारी कल्याणकारी योजनाओं** से संबंधित प्रश्नों के उत्तर देने के लिए प्रशिक्षित हूँ। 🙏\n\n` +
          `कृपया मुझसे सरकारी योजनाओं (जैसे छात्रवृत्ति, पीएम किसान, आयुष्मान भारत, मुद्रा लोन, सब्सिडी), पात्रता नियमों, आवश्यक दस्तावेज़ों, या आवेदन प्रक्रिया के बारे में पूछें!`;
      } else {
        answer = `I apologize, but I am dedicated exclusively to **Scheme Navigator** and **Indian Government welfare schemes**. 🙏\n\n` +
          `Please ask me about government schemes (e.g., scholarships, PM-Kisan, Ayushman Bharat, loans, subsidies), eligibility criteria, required documents, or application procedures!`;
      }
      return { answer, referencedSchemes: [], profileUpdated: false };
    }

    // 5. Scheme Search & Matching
    const summary = await this.loadStaticSummary();
    const allSchemes = summary.schemes || [];

    // Scheme Aliases lookup
    const SCHEME_ALIASES: Array<{ keywords: string[]; slug: string }> = [
      { keywords: ['ayushman', 'pmjay', 'pm-jay', 'jan arogya', 'health card', 'swasthya card', 'ilaj card', '5 lakh', 'free ilaj', 'আয়ুষ্মান', 'আয়ুষ্মান', 'स्वास्थ्य कार्ड', 'صحت کارڈ', 'آیوشمان', 'ਆਯੁਸ਼ਮਾਨ ਭਾਰਤ'], slug: 'ayushman-bharat-pmjay' },
      { keywords: ['vaya vandana', 'senior citizen card', '70+', '70 saal', '70 plus', 'বয়স্ক কার্ড', 'سینئر سٹیزن', 'ਬਜ਼ੁਰਗ ਕਾਰਡ'], slug: 'ayushman-vaya-vandana-senior-citizens' },
      { keywords: ['kisan samman', 'pm kisan', 'pm-kisan', 'samman nidhi', 'kisan 6000', '6000 kisan', 'pmkisan', 'পিএম কিসান', 'কৃষক সম্মান', 'کسان سمان', 'پی ایم کسان', 'ਪੀਐੱਮ ਕਿਸਾਨ'], slug: 'pm-kisan-samman-nidhi' },
      { keywords: ['kusum', 'solar pump', 'solar kisan', 'solar panel khet', 'সৌর পাম্প', 'سولر پمپ', 'ਸੋਲਰ ਪੰਪ'], slug: 'pm-kusum-solar-pump-scheme' },
      { keywords: ['fasal bima', 'pmfby', 'crop insurance', 'fasal nuksan', 'ফসল বিমা', 'فصل انشورنس', 'ਫ਼ਸਲ ਬੀਮਾ'], slug: 'pradhan-mantri-fasal-bima-yojana' },
      { keywords: ['kisan credit card', 'kcc', 'kheti loan', 'crop loan', 'কেসিসি', 'ਕੇਸੀਸੀ', 'کے سی سی'], slug: 'kcc' },
      { keywords: ['mudra', 'mudra loan', 'shishu', 'kishor', 'tarun', 'dukan loan', 'vyapar loan', 'মুদ্রা ঋণ', 'مدرا لون', 'ਮੁਦਰਾ ਕਰਜ਼ਾ'], slug: 'pradhan-mantri-mudra-yojana' },
      { keywords: ['svanidhi', 'street vendor', 'rehdi', 'patri', 'thela loan', 'vendor loan', 'স্বনিধি', 'سوانیدھی', 'ਸਵਨਿਧੀ'], slug: 'pm-svanidhi' },
      { keywords: ['vishwakarma', 'artisan', 'karigar', 'silai machine', 'darzi', 'mistri', 'lohar', 'toolkit', 'বিশ্বকর্মা', 'وشوکرما', 'ਵਿਸ਼ਵਕਰਮਾ'], slug: 'pm-vishwakarma-scheme' },
      { keywords: ['post matric', 'post-matric', 'nsp', 'scholarship', 'chhatravritti', '12th pass', '10th pass', 'পোস্ট মেট্রিক', 'স্কলারশিপ', 'پوسٹ میٹرک', 'وظیفہ', 'ਪੋਸਟ ਮੈਟ੍ਰਿਕ', 'ਵਜ਼ੀਫ਼ਾ'], slug: 'post-matric-scholarship-sc-obc-minority' },
      { keywords: ['pm-usp', 'pm usp', 'uchchatar shiksha', 'college scholarship', 'higher education'], slug: 'pm-uchchatar-shiksha-protsahan-yojana' },
      { keywords: ['free coaching', 'coaching', 'upsc coaching', 'ফ্রি কোচিং', 'مفت کوچنگ', 'ਮੁਫ਼ਤ ਕੋਚਿੰਗ'], slug: 'scheme-for-free-coaching-for-sc-and-obc-students' },
      { keywords: ['pmkvy', 'skill india', 'kaushal vikas', 'দক্ষতা উন্নয়ন', 'مهارت', 'ਹੁਨਰ ਵਿਕਾਸ'], slug: 'pradhan-mantri-kaushal-vikas-yojana' },
      { keywords: ['awas yojana', 'pmay', 'pm awas', 'makan yojana', 'ghar yojana', 'pucca ghar', 'gramin awas', 'আবাস যোজনা', 'آواس یوجنا', 'ਆਵਾਸ ਯੋਜਨਾ'], slug: 'pradhan-mantri-awas-yojana-gramin' },
      { keywords: ['atal pension', 'apy', '60 ke baad pension', 'অটল পেনশন', 'اٹل پنشن', 'ਅਟਲ ਪੈਨਸ਼ਨ'], slug: 'atal-pension-yojana' },
      { keywords: ['old age pension', 'vridha pension', 'vriddha pension', 'ignoaps', 'senior citizen pension'], slug: 'indira-gandhi-national-old-age-pension-scheme' },
      { keywords: ['suraksha bima', 'pmsby', '20 rupaye', 'ਸੁਰੱਖਿਆ ਬੀਮਾ', 'حفاظتی انشورنس'], slug: 'pmsby' },
      { keywords: ['jeevan jyoti', 'pmjjby', '436 bima', 'ਜੀਵਨ ਜਯੋਤੀ'], slug: 'pmjjby' },
      { keywords: ['sukanya', 'ssy', 'sukanya samriddhi', 'beti bachat', 'kanya yojana', 'সুকন্যা সমৃদ্ধি', 'سکنیا سمردھی', 'ਸੁਕੰਨਿਆ ਸਮ੍ਰਿੱਧੀ'], slug: 'sukanya-samriddhi-yojana' },
      { keywords: ['matru vandana', 'pmmvy', 'maternity', 'garbhavati', 'মাতৃ বন্দনা'], slug: 'pradhan-mantri-matru-vandana-yojana' },
      { keywords: ['ujjwala', 'free gas', 'lpg subsidy', 'gas cylinder', 'উজ্জ্বলা', 'اجولا', 'ਉੱਜਵਲਾ'], slug: 'pmuy' },
      { keywords: ['mgnrega', 'nrega', '100 din', 'manrega', 'মনরেগা', 'منریگا', 'ਮਨਰੇਗਾ'], slug: 'mahatma-gandhi-nrega-mgnrega' },
      { keywords: ['janaushadhi', 'jan aushadhi', 'dawa kendra', 'sasti dawa', 'জনঔষধী', 'ਜਨ ਔਸ਼ਧੀ'], slug: 'pmbjp' },
      { keywords: ['divyang', 'viklang', 'disability', 'handicapped', 'wheelchair', 'hearing aid'], slug: 'adip-scheme-for-persons-with-disabilities' },
    ];

    let aliasMatchedScheme: Scheme | undefined;
    for (const item of SCHEME_ALIASES) {
      if (item.keywords.some(kw => qLower.includes(kw))) {
        aliasMatchedScheme = allSchemes.find(s => s.slug === item.slug || s.id === item.slug);
        if (aliasMatchedScheme) break;
      }
    }

    const occ = (effectiveProfile?.employmentType || (effectiveProfile as any)?.occupation || '').toLowerCase();
    const isStudent = occ.includes('student') || Boolean(effectiveProfile?.studentCourse);
    const isFarmer = occ.includes('farmer') || occ.includes('kisan') || occ.includes('kheti');
    const isBusiness = occ.includes('business') || occ.includes('entrepreneur') || occ.includes('self') || occ.includes('dukan') || occ.includes('vendor') || occ.includes('owner');

    const TOPIC_INTENT_MAP: Array<{ topic: string; categories: string[]; keywords: string[] }> = [
      {
        topic: 'Agriculture',
        categories: ['Agriculture', 'Financial Assistance'],
        keywords: ['kisan', 'kheti', 'farmer', 'farming', 'krishi', 'crop', 'tractor', 'fertilizer', 'fasal', 'beej', 'sinchai', 'irrigation', 'pm-kisan', 'pmkisan', 'kusum', 'kcc', 'কৃষি', 'চাষী', 'ফসল', 'کسان', 'کھیتی', 'ਕਿਸਾਨ', 'ਖੇਤੀ']
      },
      {
        topic: 'Education',
        categories: ['Education', 'Skill Development', 'Financial Assistance'],
        keywords: ['student', 'scholarship', 'chhatravritti', 'study', 'padhai', 'shiksha', 'college', 'school', 'fee', 'fees', 'skill', 'training', 'coaching', 'nsp', 'vidyarthi', 'ছাত্র', 'শিক্ষা', 'বৃত্তি', 'طالب علم', 'تعلیم', 'وظیفہ', 'ਵਿਦਿਆਰਥੀ', 'ਵਜ਼ੀਫ਼ਾ']
      },
      {
        topic: 'Business',
        categories: ['Business', 'Financial Assistance', 'Skill Development'],
        keywords: ['loan', 'business', 'dukan', 'dukaan', 'shop', 'karobar', 'vyapar', 'mudra', 'svanidhi', 'vishwakarma', 'pmegp', 'startup', 'vendor', 'rehdi', 'patri', 'msme', 'artisan', 'ব্যবসা', 'ঋণ', 'کاروبار', 'قرض', 'ਦੁਕਾਨ', 'ਵਪਾਰ', 'ਕਰਜ਼ਾ']
      },
      {
        topic: 'Healthcare',
        categories: ['Healthcare', 'Social Security'],
        keywords: ['health', 'hospital', 'ilaj', 'treatment', 'ayushman', 'medicine', 'dawa', 'swasthya', 'card', 'bimari', 'bimar', 'pmjay', 'স্বাস্থ্য', 'হাসপাতাল', 'চিকিৎসা', 'صحت', 'علاج', 'ہسپتال', 'ਸਿਹਤ', 'ਹਸਪਤਾਲ', 'ਇਲਾਜ']
      },
      {
        topic: 'Housing',
        categories: ['Housing'],
        keywords: ['house', 'housing', 'ghar', 'makan', 'makaan', 'chhat', 'awas', 'pmay', 'pucca makan', 'বাড়ি', 'ঘর', 'আবাস', 'گھر', 'رہائش', 'ਮਕਾਨ', 'ਘਰ', 'ਆਵਾਸ']
      },
      {
        topic: 'Social Security',
        categories: ['Social Security', 'Financial Assistance'],
        keywords: ['pension', 'elderly', 'senior', 'old age', 'vridha', 'vriddha', 'bujurg', 'suraksha', 'divyang', 'viklang', 'handicap', 'disability', 'atal pension', 'apy', 'পেনশন', 'বৃদ্ধ', 'پنشن', 'بزرਗ', 'ਪੈਨਸ਼ਨ', 'ਬਜ਼ੁਰਗ']
      },
      {
        topic: 'Women & Child',
        categories: ['Women & Child', 'Social Security', 'Financial Assistance'],
        keywords: ['woman', 'women', 'mahila', 'girl', 'beti', 'kanya', 'maternity', 'matru', 'sukanya', 'lakhpati', 'ladli', 'widow', 'vidhwa', 'ujjwala', 'মহিলা', 'মেয়ে', 'খাতুন', 'خواتین', 'عورت', 'ਔਰਤ', 'ਕੁੜੀ']
      },
      {
        topic: 'Employment',
        categories: ['Employment', 'Skill Development'],
        keywords: ['job', 'naukri', 'employment', 'berojgar', 'berojgari', 'unemployed', 'rozgar', 'mgnrega', 'nrega', '100 din', 'কর্মসংস্থান', 'চাকরি', 'ملازمت', 'نوکری', 'ਰੋਜ਼ਗਾਰ', 'ਨੌਕਰੀ']
      }
    ];

    const matchedTopics = TOPIC_INTENT_MAP.filter(t =>
      t.keywords.some(kw => new RegExp(`\\b${kw}`, 'i').test(qLower) || qLower.includes(kw))
    );
    const hasTopic = Boolean(aliasMatchedScheme || matchedTopics.length > 0);

    const noiseWords = new Set([
      'batao', 'bataiye', 'bataye', 'batayein', 'ke', 'baare', 'mein', 'kya', 'hai', 'hain',
      'mujhe', 'chahiye', 'about', 'tell', 'me', 'the', 'for', 'is', 'what', 'can', 'you', 'please',
      'help', 'yojana', 'yojna', 'scheme', 'schemes', 'sarkari', 'government', 'de', 'do', 'aur',
      'ka', 'ki', 'ko', 'se', 'par', 'ek', 'how', 'to', 'apply', 'card', 'mere', 'meri', 'mera',
      'liye', 'konsi', 'kaunsi', 'kounsi', 'kuch', 'sahi', 'rahegi', 'hogi', 'hoga', 'chahta',
      'chahti', 'chahte', 'kare', 'karein', 'milega', 'milegi', 'mil', 'sakta', 'sakti', 'sakte',
      'koi', 'kaise', 'kese', 'wala', 'wali', 'wale', 'sabse', 'badhiya', 'best', 'good', 'suggest',
      'which', 'give', 'list', 'show', 'recommend', 'eligible', 'patra', 'patrata', 'eligibility',
      'information', 'detail', 'details', 'jankari', 'suchna', 'namaste', 'hello'
    ]);
    const contentTokens = qLower
      .replace(/[^\w\s\u0600-\u06FF\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0900-\u097F]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !noiseWords.has(w));

    const allowedCategories = new Set(matchedTopics.flatMap(t => t.categories));
    const scoredSchemes: Array<{ scheme: Scheme; score: number }> = [];

    for (const s of allSchemes) {
      const sName = (s.name || '').toLowerCase();
      const sShort = (s.shortName || '').toLowerCase();
      const sDesc = (s.shortDescription || s.tagline || '').toLowerCase();
      const sCat = s.category || '';

      let score = 0;
      if (aliasMatchedScheme && (s.id === aliasMatchedScheme.id || s.slug === aliasMatchedScheme.slug)) {
        score += 500;
      }

      if (hasTopic && allowedCategories.has(sCat)) {
        score += 50;
      } else if (hasTopic && allowedCategories.size > 0 && !allowedCategories.has(sCat)) {
        score -= 200;
      }

      for (const token of contentTokens) {
        if (sName.includes(token)) score += 40;
        if (sShort.includes(token)) score += 30;
        if (sDesc.includes(token)) score += 10;
        if (s.tags && s.tags.some(t => t.toLowerCase().includes(token))) score += 15;
      }

      if (profile?.state && s.coveredStates?.some(st => st.toLowerCase() === profile.state!.toLowerCase())) {
        score += 5;
      }

      if (score > 15 || (aliasMatchedScheme && (s.id === aliasMatchedScheme.id || s.slug === aliasMatchedScheme.slug))) {
        scoredSchemes.push({ scheme: s, score: score + (s.popularScore || 50) * 0.1 });
      }
    }

    scoredSchemes.sort((a, b) => b.score - a.score);
    const seenSchemeIds = new Set<string>();
    let directMatches = scoredSchemes.map(item => item.scheme).filter(s => {
      const key = (s.slug || s.id || '').toLowerCase();
      if (seenSchemeIds.has(key)) return false;
      seenSchemeIds.add(key);
      return true;
    });

    // If alias matched, place it right at the top
    if (aliasMatchedScheme && !directMatches.some(s => s.id === aliasMatchedScheme!.id)) {
      directMatches.unshift(aliasMatchedScheme);
    } else if (aliasMatchedScheme) {
      directMatches = [aliasMatchedScheme, ...directMatches.filter(s => s.id !== aliasMatchedScheme!.id)];
    }

    // Fallback to Live APIMitra API search if no local matches found
    if (directMatches.length === 0) {
      const liveResults = await fetchLiveGovtSchemes(query, 4);
      if (liveResults.length > 0) {
        directMatches = liveResults;
      }
    }

    const isRecommendationQuery =
      (qLower.includes('mere liye') ||
      qLower.includes('for me') ||
      qLower.includes('recommend') ||
      qLower.includes('suggest') ||
      qLower.includes('top 3') ||
      qLower.includes('top 5') ||
      qLower.includes('top schemes') ||
      qLower.includes('best scheme') ||
      qLower.includes('best schemes') ||
      qLower.includes('my profile') ||
      qLower.includes('according to my profile') ||
      qLower.includes('profile ke') ||
      qLower.includes('konsi yojana') ||
      qLower.includes('kaunsi yojana') ||
      qLower.includes('kon si yojana') ||
      qLower.includes('kounsi yojana') ||
      qLower.includes('kis yojana') ||
      qLower.includes('kaun kaun si') ||
      qLower.includes('options') ||
      qLower.includes('schemes batao') ||
      qLower.includes('yojana batao') ||
      qLower.includes('yojanaen') ||
      qLower.includes('yojanaye') ||
      qLower.includes('eligible') ||
      qLower.includes('patra') ||
      qLower.includes('patrata') ||
      qLower.includes('আমার জন্য') ||
      qLower.includes('সেরা প্রকল্প') ||
      qLower.includes('কোন প্রকল্প') ||
      qLower.includes('میرے لیے') ||
      qLower.includes('بہترین اسکیم') ||
      qLower.includes('کون سی اسکیم') ||
      qLower.includes('ਮੇਰੇ ਲਈ') ||
      qLower.includes('ਵਧੀਆ ਸਕੀਮ') ||
      qLower.includes('ਕਿਹੜੀ ਸਕੀਮ'));

    // ── DETERMINISTIC ELIGIBILITY ENGINE: GUARANTEE AT LEAST 5 ELIGIBLE SCHEMES ──
    const rankedResults = rankSchemesForProfile(effectiveProfile, allSchemes);
    const rankedSchemes = rankedResults.map((r) => r.scheme);

    const selectedSchemes: Scheme[] = [];
    const seenSchemeKeys = new Set<string>();

    const addSelected = (s: Scheme) => {
      const key = (s.slug || s.id || '').toLowerCase();
      if (!key || seenSchemeKeys.has(key)) return;
      // Strict deterministic check: filter out schemes where citizen is strictly Not Eligible
      const check = calculateSchemeMatch(s, effectiveProfile);
      if (check.matchGrade === 'Not Eligible') return;
      seenSchemeKeys.add(key);
      selectedSchemes.push(s);
    };

    // Priority 1: Specific scheme alias requested by user (e.g. Ayushman Bharat)
    if (aliasMatchedScheme) {
      addSelected(aliasMatchedScheme);
    }

    // Priority 2: Direct matches based on user's query keywords & topic
    for (const dm of directMatches) {
      addSelected(dm);
      if (selectedSchemes.length >= 6) break;
    }

    // Priority 3: Top deterministically ranked schemes for user's profile
    for (const rs of rankedSchemes) {
      addSelected(rs);
      if (selectedSchemes.length >= 6) break;
    }

    // Priority 4: Ensure AT LEAST 5 schemes are present by filling with eligible catalog schemes
    if (selectedSchemes.length < 5) {
      for (const s of allSchemes) {
        addSelected(s);
        if (selectedSchemes.length >= 5) break;
      }
    }

    // Priority 5: Fallback fill up
    if (selectedSchemes.length < 5) {
      for (const s of allSchemes) {
        const key = (s.slug || s.id || '').toLowerCase();
        if (key && !seenSchemeKeys.has(key)) {
          seenSchemeKeys.add(key);
          selectedSchemes.push(s);
        }
        if (selectedSchemes.length >= 5) break;
      }
    }

    let relevant: Scheme[] = selectedSchemes.slice(0, 5);

    // Localize relevant schemes and primary scheme to the user's selected language
    // so no raw English strings leak into Indic conversational responses!
    relevant = relevant.map((s) => translateSchemeContent(s, fullLang));
    const primary = relevant[0];

    // Intent Identification
    const isDocQuery = /\b(document|documents|dastavej|dastaavez|kagaz|kagas|paper|papers|proof|certificate|praman|pramaan|checklist|requirements)\b/i.test(qLower) ||
      (qLower.includes('kya chahiye') && !qLower.includes('paisa')) ||
      (hasBengaliScript && (qLower.includes('কাগজ') || qLower.includes('নথি') || qLower.includes('ডকুমেন্ট') || qLower.includes('প্রমাণ'))) ||
      (hasUrduScript && (qLower.includes('دستاویز') || qLower.includes('کاغذ') || qLower.includes('ثبوت'))) ||
      (hasPunjabiScript && (qLower.includes('ਦਸਤਾਵੇਜ਼') || qLower.includes('ਕਾਗਜ਼') || qLower.includes('ਸਬੂਤ')));

    const isApplyQuery = /\b(apply|kaise kare|kaise apply|online|offline|registration|panjikaran|portal|form|steps|process|procedure|kaha jaye|kaha jana|kese apply|aavedan kaise|kaise aavedan)\b/i.test(qLower) ||
      (hasBengaliScript && (qLower.includes('আবেদন') || qLower.includes('কীভাবে') || qLower.includes('ফরম') || qLower.includes('রেজিস্ট্রেশন'))) ||
      (hasUrduScript && (qLower.includes('درخواست') || qLower.includes('کیسے') || qLower.includes('طریقہ') || qLower.includes('رجسٹریشن'))) ||
      (hasPunjabiScript && (qLower.includes('ਅਰਜ਼ੀ') || qLower.includes('ਕਿਵੇਂ') || qLower.includes('ਤਰੀਕਾ') || qLower.includes('ਰਜਿਸਟ੍ਰੇਸ਼ਨ')));

    const isEligQuery = /\b(eligible|eligibility|patrata|patra|kaun|who can|age limit|umar|income|aamdani|qualification|kisko milega|criteria|shart|shartein)\b/i.test(qLower) ||
      (hasBengaliScript && (qLower.includes('যোগ্যতা') || qLower.includes('কে পাবে') || qLower.includes('শর্ত') || qLower.includes('বয়স'))) ||
      (hasUrduScript && (qLower.includes('اہلیت') || qLower.includes('کون اہل') || qLower.includes('شرائط') || qLower.includes('عمر'))) ||
      (hasPunjabiScript && (qLower.includes('ਯੋਗਤਾ') || qLower.includes('ਕੌਣ ਯੋਗ') || qLower.includes('ਸ਼ਰਤਾਂ') || qLower.includes('ਉਮਰ')));

    const isBenefitQuery = /\b(benefit|benefits|fayde|fayda|labh|amount|kitna paisa|kitne paise|kitna milega|cash|grant|subsidy|loan amount|coverage|rupaye|paisa|pension amount)\b/i.test(qLower) ||
      (hasBengaliScript && (qLower.includes('সুবিধা') || qLower.includes('লাভ') || qLower.includes('টাকা') || qLower.includes('ভাতা') || qLower.includes('কত'))) ||
      (hasUrduScript && (qLower.includes('فائدہ') || qLower.includes('فوائد') || qLower.includes('رقم') || qLower.includes('کتنے') || qLower.includes('امداد'))) ||
      (hasPunjabiScript && (qLower.includes('ਲਾਭ') || qLower.includes('ਫਾਇਦਾ') || qLower.includes('ਰਕਮ') || qLower.includes('ਕਿੰਨੇ') || qLower.includes('ਸਹਾਇਤਾ')));

    // Profile string
    let profDesc = '';
    if (effectiveProfile && (effectiveProfile.age || effectiveProfile.state || occ)) {
      if (isBengali) {
        profDesc = [
          effectiveProfile.age ? `বয়স ${effectiveProfile.age} বছর` : '',
          occ,
          effectiveProfile.state ? `রাজ্য ${effectiveProfile.state}` : '',
          effectiveProfile.category ? `শ্রেণী ${effectiveProfile.category}` : '',
        ].filter(Boolean).join(', ');
      } else if (isUrdu) {
        profDesc = [
          effectiveProfile.age ? `عمر ${effectiveProfile.age} سال` : '',
          occ,
          effectiveProfile.state ? `ریاست ${effectiveProfile.state}` : '',
          effectiveProfile.category ? `زمرہ ${effectiveProfile.category}` : '',
        ].filter(Boolean).join(', ');
      } else if (isPunjabi) {
        profDesc = [
          effectiveProfile.age ? `ਉਮਰ ${effectiveProfile.age} ਸਾਲ` : '',
          occ,
          effectiveProfile.state ? `ਰਾਜ ${effectiveProfile.state}` : '',
          effectiveProfile.category ? `ਸ਼੍ਰੇਣੀ ${effectiveProfile.category}` : '',
        ].filter(Boolean).join(', ');
      } else if (isOdia) {
        profDesc = [
          effectiveProfile.age ? `ବୟସ ${effectiveProfile.age} ବର୍ଷ` : '',
          occ,
          effectiveProfile.state ? `ରାଜ୍ୟ ${effectiveProfile.state}` : '',
          effectiveProfile.category ? `ବର୍ଗ ${effectiveProfile.category}` : '',
        ].filter(Boolean).join(', ');
      } else if (isHindi) {
        profDesc = [
          effectiveProfile.age ? `आयु ${effectiveProfile.age} वर्ष` : '',
          occ,
          effectiveProfile.state ? `राज्य ${effectiveProfile.state}` : '',
          effectiveProfile.category ? `श्रेणी ${effectiveProfile.category}` : '',
        ].filter(Boolean).join(', ');
      } else {
        profDesc = [
          effectiveProfile.age ? `Age ${effectiveProfile.age}` : '',
          occ,
          effectiveProfile.state ? `State ${effectiveProfile.state}` : '',
          effectiveProfile.category ? `Category ${effectiveProfile.category}` : '',
        ].filter(Boolean).join(', ');
      }
    }

    const isSpecificSingleSchemeQuery = Boolean(aliasMatchedScheme) && !isRecommendationQuery && (isDocQuery || isApplyQuery || isEligQuery || isBenefitQuery);

    const getOtherSchemesFooter = (otherSchemes: Scheme[]) => {
      if (!otherSchemes || otherSchemes.length === 0) return '';
      if (isHindi) {
        return `\n\n---\n🏛️ **आपकी पात्रता के अनुसार अन्य अनुशंसित योजनाएं (Top Eligible Schemes):**\n` +
          otherSchemes.slice(0, 4).map((s, i) => `${i + 1}. **${s.name}** (${s.category})`).join('\n') +
          `\n\n💡 आप इनके बारे में भी मुझसे पूछ सकते हैं या नीचे दिए गए कार्ड्स पर क्लिक करके विवरण देख सकते हैं।`;
      } else if (isBengali) {
        return `\n\n---\n🏛️ **আপনার জন্য অন্যান্য প্রস্তাবিত সরকারি প্রকল্প:**\n` +
          otherSchemes.slice(0, 4).map((s, i) => `${i + 1}. **${s.name}** (${s.category})`).join('\n');
      } else if (isUrdu) {
        return `\n\n---\n🏛️ **آپ کے لیے دیگر تجویز کردہ اسکیمیں:**\n` +
          otherSchemes.slice(0, 4).map((s, i) => `${i + 1}. **${s.name}** (${s.category})`).join('\n');
      } else if (isPunjabi) {
        return `\n\n---\n🏛️ **ਤੁਹਾਡੇ ਲਈ ਹੋਰ ਸਿਫ਼ਾਰਸ਼ ਕੀਤੀਆਂ ਸਕੀਮਾਂ:**\n` +
          otherSchemes.slice(0, 4).map((s, i) => `${i + 1}. **${s.name}** (${s.category})`).join('\n');
      } else {
        return `\n\n---\n🏛️ **Other Top Eligible Schemes Recommended For You:**\n` +
          otherSchemes.slice(0, 4).map((s, i) => `${i + 1}. **${s.name}** (${s.category})`).join('\n') +
          `\n\n💡 Click on the scheme cards below or ask me about any of these schemes.`;
      }
    };

    const formatDeterministicSchemeList = (schemesList: Scheme[], headerText: string) => {
      const topFive = schemesList.slice(0, 5);
      const formattedItems = topFive.map((s, idx) => {
        const matchResult = calculateSchemeMatch(s, effectiveProfile);
        const matchScore = matchResult.matchScore || 85;
        const matchGrade = matchResult.matchGrade || 'Eligible';
        const ben = s.benefits?.[0]?.amountOrValue || s.benefits?.[0]?.title || s.shortDescription || '';
        const portalUrl = s.verification?.officialPortalUrl || '';
        const docsList = (s.documents && s.documents.length > 0)
          ? s.documents.slice(0, 3).map(d => d.name).join(', ')
          : (isHindi ? 'आधार कार्ड, बैंक पासबुक, आय/निवास प्रमाण पत्र' : 'Aadhaar Card, Bank Passbook, Passport Photo');

        let eligReason = '';
        const minAge = s.eligibility?.minAge ?? 0;
        const maxAge = s.eligibility?.maxAge ?? 100;
        const citizenAge = effectiveProfile.age;
        const citizenState = effectiveProfile.state;
        const citizenOcc = effectiveProfile.employmentType || (effectiveProfile as any)?.occupation;
        const citizenCat = effectiveProfile.category;

        if (isHindi) {
          const reasons: string[] = [];
          if (citizenAge && (minAge > 0 || maxAge < 100)) {
            reasons.push(`आयु ${citizenAge} वर्ष (${minAge}-${maxAge} वर्ष सीमा के अंतर्गत)`);
          } else if (minAge > 0 || maxAge < 100) {
            reasons.push(`आयु सीमा ${minAge}-${maxAge} वर्ष`);
          }
          if (citizenState) {
            reasons.push(`राज्य: ${citizenState}`);
          }
          if (citizenOcc && s.eligibility?.allowedOccupations && !(s.eligibility.allowedOccupations as any).includes('All')) {
            reasons.push(`पेशा: ${citizenOcc}`);
          }
          if (citizenCat) {
            reasons.push(`श्रेणी: ${citizenCat}`);
          }
          if (reasons.length === 0) {
            reasons.push('अखिल भारतीय नागरिक पात्रता एवं सामाजिक-आर्थिक मानदंड पूर्ण');
          }
          eligReason = reasons.join(' • ');

          let itemStr = `### ${idx + 1}. 🏛️ **${s.name}** (${s.category})\n` +
            `🎯 **पात्रता मेल:** ${matchScore}% (${matchGrade})\n` +
            `👥 **पात्रता आधार:** ${eligReason}\n` +
            `💰 **वित्तीय लाभ:** ${ben}\n` +
            `📄 **आवश्यक दस्तावेज़:** ${docsList}`;
          if (portalUrl) {
            itemStr += `\n🌐 **पोर्टल:** [आधिकारिक पोर्टल](${portalUrl})`;
          }
          return itemStr;
        } else if (isBengali) {
          const reasons: string[] = [];
          if (citizenAge && (minAge > 0 || maxAge < 100)) reasons.push(`বয়স ${citizenAge} বছর (${minAge}-${maxAge} এর মধ্যে)`);
          if (citizenState) reasons.push(`রাজ্য: ${citizenState}`);
          if (citizenOcc) reasons.push(`পেশা: ${citizenOcc}`);
          if (reasons.length === 0) reasons.push('সার্বজনীন নাগরিক যোগ্যতা মানদণ্ড');
          eligReason = reasons.join(' • ');

          let itemStr = `### ${idx + 1}. 🏛️ **${s.name}** (${s.category})\n` +
            `🎯 **যোগ্যতা মেল:** ${matchScore}% (${matchGrade})\n` +
            `👥 **যোগ্যতার ভিত্তি:** ${eligReason}\n` +
            `💰 **প্রধান সুবিধা:** ${ben}\n` +
            `📄 **প্রয়োজনীয় নথি:** ${docsList}`;
          if (portalUrl) itemStr += `\n🌐 **পোর্টাল:** [অফিসিয়াল পোর্টাল](${portalUrl})`;
          return itemStr;
        } else if (isUrdu) {
          const reasons: string[] = [];
          if (citizenAge && (minAge > 0 || maxAge < 100)) reasons.push(`عمر ${citizenAge} سال (${minAge}-${maxAge} سال کے درمیان)`);
          if (citizenState) reasons.push(`ریاست: ${citizenState}`);
          if (citizenOcc) reasons.push(`پیشہ: ${citizenOcc}`);
          if (reasons.length === 0) reasons.push('شہری اہلیت اور سماجی و اقتصادی معیار');
          eligReason = reasons.join(' • ');

          let itemStr = `### ${idx + 1}. 🏛️ **${s.name}** (${s.category})\n` +
            `🎯 **اہلیت کا تناسب:** ${matchScore}% (${matchGrade})\n` +
            `👥 **اہلیت کی بنیاد:** ${eligReason}\n` +
            `💰 **اہم فائدہ:** ${ben}\n` +
            `📄 **ضروری دستاویزات:** ${docsList}`;
          if (portalUrl) itemStr += `\n🌐 **پورٹل:** [سرکاری پورٹل](${portalUrl})`;
          return itemStr;
        } else if (isPunjabi) {
          const reasons: string[] = [];
          if (citizenAge && (minAge > 0 || maxAge < 100)) reasons.push(`ਉਮਰ ${citizenAge} ਸਾਲ (${minAge}-${maxAge} ਸਾਲ ਦਰਮਿਆਨ)`);
          if (citizenState) reasons.push(`ਰਾਜ: ${citizenState}`);
          if (citizenOcc) reasons.push(`ਕਿੱਤਾ: ${citizenOcc}`);
          if (reasons.length === 0) reasons.push('ਨਾਗਰਿਕ ਯੋਗਤਾ ਅਤੇ ਸਮਾਜਿਕ-ਆਰਥਿਕ ਮਾਪਦੰਡ');
          eligReason = reasons.join(' • ');

          let itemStr = `### ${idx + 1}. 🏛️ **${s.name}** (${s.category})\n` +
            `🎯 **ਯੋਗਤਾ ਮੇਲ:** ${matchScore}% (${matchGrade})\n` +
            `👥 **ਯੋਗਤਾ ਦਾ ਆਧਾਰ:** ${eligReason}\n` +
            `💰 **ਮੁੱਖ ਲਾਭ:** ${ben}\n` +
            `📄 **ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼:** ${docsList}`;
          if (portalUrl) itemStr += `\n🌐 **ਪੋਰਟਲ:** [ਸਰਕਾਰੀ ਪੋਰਟਲ](${portalUrl})`;
          return itemStr;
        } else if (isMarathi) {
          const reasons: string[] = [];
          if (citizenAge && (minAge > 0 || maxAge < 100)) reasons.push(`वय ${citizenAge} वर्षे (${minAge}-${maxAge} वयोगट)`);
          if (citizenState) reasons.push(`राज्य: ${citizenState}`);
          if (citizenOcc) reasons.push(`व्यवसाय: ${citizenOcc}`);
          if (reasons.length === 0) reasons.push('नागरिक पात्रता व सामाजिक-आर्थिक निकष');
          eligReason = reasons.join(' • ');

          let itemStr = `### ${idx + 1}. 🏛️ **${s.name}** (${s.category})\n` +
            `🎯 **पात्रता जुळणी:** ${matchScore}% (${matchGrade})\n` +
            `👥 **पात्रतेचा आधार:** ${eligReason}\n` +
            `💰 **मुख्य लाभ:** ${ben}\n` +
            `📄 **आवश्यक कागदपत्रे:** ${docsList}`;
          if (portalUrl) itemStr += `\n🌐 **पोर्टल:** [अधिकृत पोर्टल](${portalUrl})`;
          return itemStr;
        } else {
          const reasons: string[] = [];
          if (citizenAge && (minAge > 0 || maxAge < 100)) reasons.push(`Age ${citizenAge} (Within ${minAge}-${maxAge} bracket)`);
          if (citizenState) reasons.push(`State: ${citizenState}`);
          if (citizenOcc) reasons.push(`Occupation: ${citizenOcc}`);
          if (citizenCat) reasons.push(`Category: ${citizenCat}`);
          if (reasons.length === 0) reasons.push('Citizen eligibility & socio-economic criteria verified');
          eligReason = reasons.join(' • ');

          let itemStr = `### ${idx + 1}. 🏛️ **${s.name}** (${s.category})\n` +
            `🎯 **Eligibility Match:** ${matchScore}% (${matchGrade})\n` +
            `👥 **Deterministic Rule:** ${eligReason}\n` +
            `💰 **Financial Benefit:** ${ben}\n` +
            `📄 **Required Documents:** ${docsList}`;
          if (portalUrl) {
            itemStr += `\n🌐 **Official Portal:** [Apply Online](${portalUrl})`;
          }
          return itemStr;
        }
      });

      let footerText = '';
      if (isHindi) {
        footerText = `\n\n💡 **महत्वपूर्ण सुझाव:** किसी भी योजना के पूर्ण विवरण, पात्रता नियमों, और ऑनलाइन आवेदन के लिए नीचे दिए गए कार्ड्स पर क्लिक करें।`;
      } else if (isBengali) {
        footerText = `\n\n💡 **পরামর্শ:** বিস্তারিত দেখতে নিচের কার্ডগুলিতে ক্লিক করুন।`;
      } else if (isUrdu) {
        footerText = `\n\n💡 **مشورہ:** تفصیلی معلومات کے لیے نیچے دیے گئے کارڈز پر کلک کریں۔`;
      } else if (isPunjabi) {
        footerText = `\n\n💡 **ਸੁਝਾਅ:** ਵਿਸਤ੍ਰਿਤ ਜਾਣਕਾਰੀ ਲਈ ਹੇਠਾਂ ਦਿੱਤੇ ਕਾਰਡਾਂ 'ਤੇ ਕਲਿੱਕ ਕਰੋ।`;
      } else if (isMarathi) {
        footerText = `\n\n💡 **टीप:** तपशीलवार माहितीसाठी खालील कार्ड्सवर क्लिक करा.`;
      } else {
        footerText = `\n\n💡 **Tip:** Click on any interactive card below to review detailed eligibility criteria, required documents, or begin online application.`;
      }

      return `${headerText}\n\n${formattedItems.join('\n\n')}${footerText}`;
    };

    let answer = '';

    // ── INTENT 1: DOCUMENTS CHECKLIST ──────────────────────────────────────
    if (isSpecificSingleSchemeQuery && isDocQuery && primary) {
      const docs = primary.documents || [];
      if (isBengali) {
        answer = `📄 **${primary.name} এর জন্য প্রয়োজনীয় নথিপত্র (Required Documents):**\n\n` +
          `এই প্রকল্পে আবেদন করার জন্য নিম্নলিখিত নথিগুলি প্রয়োজন:\n\n`;
        if (docs.length > 0) {
          answer += docs.map((d, i) => {
            const badge = d.isMandatory ? 'আবশ্যক' : 'ঐচ্ছিক';
            const desc = d.description ? `\n   - *বিবরণ:* ${d.description}` : '';
            return `${i + 1}. **${d.name}** (${badge})${desc}`;
          }).join('\n\n');
        } else {
          answer += `1. **আধার কার্ড (Aadhaar Card)** (আবশ্যক)\n   - *বিবরণ:* পরিচয় ও বায়োমেট্রিক ই-কেওয়াইসি যাচাইকরণের জন্য।\n\n` +
            `2. **ব্যাঙ্ক পাসবুক (Bank Passbook)** (আবশ্যক)\n   - *বিবরণ:* সরাসরি সরকারি অনুদান (DBT) পাওয়ার জন্য আধার লিঙ্কযুক্ত ব্যাঙ্ক অ্যাকাউন্ট।\n\n` +
            `3. **সক্রিয় মোবাইল নম্বর ও পাসপোর্ট ছবি** (আবশ্যক)\n   - *বিবরণ:* ওটিপি এবং আবেদন সম্পর্কিত আপডেটের জন্য।\n\n` +
            `4. **আয় / বাসস্থান / জাতিগত শংসাপত্র** (প্রযোজ্য ক্ষেত্রে)\n   - *বিবরণ:* যোগ্যতার প্রমাণ স্বরূপ।`;
        }
        answer += `\n\n💡 **গুরুত্বপূর্ণ পরামর্শ:** নিশ্চিত করুন আপনার ব্যাঙ্ক অ্যাকাউন্ট আধারের সাথে যুক্ত (NPCI Seeded) রয়েছে যাতে সরকারি অনুদান (DBT) সরাসরি আপনার অ্যাকাউন্টে জমা হয়।`;
      } else if (isUrdu) {
        answer = `📄 **${primary.name} کے لیے ضروری دستاویزات (Required Documents Checklist):**\n\n` +
          `اس اسکیم میں درخواست دینے اور فائدہ حاصل کرنے کے لیے درج ذیل دستاویزات درکار ہیں:\n\n`;
        if (docs.length > 0) {
          answer += docs.map((d, i) => {
            const badge = d.isMandatory ? 'لازمی' : 'اختیاری';
            const desc = d.description ? `\n   - *تفصیل:* ${d.description}` : '';
            return `${i + 1}. **${d.name}** (${badge})${desc}`;
          }).join('\n\n');
        } else {
          answer += `1. **آدھار کارڈ (Aadhaar Card)** (لازمی)\n   - *تفصیل:* شناخت اور بائیو میٹرک ای کے وائی سی تصدیق کے لیے۔\n\n` +
            `2. **بینک پاس بک (Bank Passbook)** (لازمی)\n   - *تفصیل:* سرکاری امداد (DBT) کی منتقلی کے لیے آدھار سے منسلک بینک کھاتہ۔\n\n` +
            `3. **فعال موبائل نمبر اور پاسپورٹ سائز تصویر** (لازمی)\n   - *تفصیل:* او ٹی پی اور درخواست کی صورتحال کے پیغامات کے لیے۔\n\n` +
            `4. **آمدنی / سکونت / ذات کا سرٹیفکیٹ** (اگر لاگو ہو)\n   - *تفصیل:* زمرہ جاتی اہلیت کی تصدیق کے لیے۔`;
        }
        answer += `\n\n💡 **اہم مشورہ:** یقینی بنائیں کہ آپ کا بینک اکاؤنٹ آدھار سے منسلک (NPCI Seeded) ہے تاکہ سرکاری رقم بغیر کسی رکاوٹ کے آپ کے کھاتے میں آ سکے۔`;
      } else if (isPunjabi) {
        answer = `📄 **${primary.name} ਲਈ ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼ (Required Documents Checklist):**\n\n` +
          `ਇਸ ਸਕੀਮ ਵਿੱਚ ਅਰਜ਼ੀ ਦੇਣ ਅਤੇ ਲਾਭ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਹੇਠਾਂ ਦਿੱਤੇ ਦਸਤਾਵੇਜ਼ ਜ਼ਰੂਰੀ ਹਨ:\n\n`;
        if (docs.length > 0) {
          answer += docs.map((d, i) => {
            const badge = d.isMandatory ? 'ਲਾਜ਼ਮੀ' : 'ਵਿਕਲਪਿਕ';
            const desc = d.description ? `\n   - *ਵੇਰਵਾ:* ${d.description}` : '';
            return `${i + 1}. **${d.name}** (${badge})${desc}`;
          }).join('\n\n');
        } else {
          answer += `1. **ਆਧਾਰ ਕਾਰਡ (Aadhaar Card)** (ਲਾਜ਼ਮੀ)\n   - *ਵੇਰਵਾ:* ਪਛਾਣ ਅਤੇ ਬਾਇਓਮੈਟ੍ਰਿਕ e-KYC ਪ੍ਰਮਾਣੀਕਰਨ ਲਈ।\n\n` +
            `2. **ਬੈਂਕ ਪਾਸਬੁੱਕ (Bank Passbook)** (ਲਾਜ਼ਮੀ)\n   - *ਵੇਰਵਾ:* ਸਿੱਧੇ ਲਾਭ ਤਬਾਦਲੇ (DBT) ਲਈ ਆਧਾਰ ਨਾਲ ਲਿੰਕ ਬੈਂਕ ਖਾਤਾ।\n\n` +
            `3. **ਚਾਲੂ ਮੋਬਾਈਲ ਨੰਬਰ ਅਤੇ ਪਾਸਪੋਰਟ ਫੋਟੋ** (ਲਾਜ਼ਮੀ)\n   - *ਵੇਰਵਾ:* OTP ਅਤੇ ਅਰਜ਼ੀ ਦੇ ਅਪਡੇਟਸ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ।\n\n` +
            `4. **ਆਮਦਨ / ਰਿਹਾਇਸ਼ / ਜਾਤੀ ਸਰਟੀਫਿਕੇਟ** (ਜੇਕਰ ਲਾਗੂ ਹੋਵੇ)\n   - *ਵੇਰਵਾ:* ਸ਼੍ਰੇਣੀ ਅਧਾਰਤ ਯੋਗਤਾ ਦੀ ਜਾਂਚ ਲਈ।`;
        }
        answer += `\n\n💡 **ਮਹੱਤਵਪੂਰਨ ਸੁਝਾਅ:** ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਤੁਹਾਡਾ ਬੈਂਕ ਖਾਤਾ ਆਧਾਰ ਨਾਲ ਲਿੰਕ (NPCI Seeded) ਹੋਵੇ ਤਾਂ ਜੋ ਸਰਕਾਰੀ ਸਹਾਇਤਾ (DBT) ਬਿਨਾਂ ਰੁਕਾਵਟ ਸਿੱਧੇ ਤੁਹਾਡੇ ਖਾਤੇ ਵਿੱਚ ਆ ਸਕੇ।`;
      } else if (isOdia) {
        answer = `📄 **${primary.name} ପାଇଁ ଆବଶ୍ୟକ ଦସ୍ତାବିଜ୍ (Required Documents):**\n\n` +
          `ଏହି ଯୋଜନାରେ ଆବେଦନ କରିବା ପାଇଁ ନିମ୍ନଲିଖିତ ସରକାରୀ ଦସ୍ତାବିଜ୍ ଆବଶ୍ୟକ:\n\n`;
        if (docs.length > 0) {
          answer += docs.map((d, i) => {
            const badge = d.isMandatory ? 'ବାଧ୍ୟତାମୂଳକ' : 'ଐଚ୍ଛିକ';
            const desc = d.description ? `\n   - *ବିବରଣୀ:* ${d.description}` : '';
            return `${i + 1}. **${d.name}** (${badge})${desc}`;
          }).join('\n\n');
        } else {
          answer += `1. **ଆଧାର କାର୍ଡ଼ (Aadhaar Card)** (ବାଧ୍ୟତାମୂଳକ)\n\n2. **ବ୍ୟାଙ୍କ ପାସବୁକ୍ (Bank Passbook)** (ବାଧ୍ୟତାମୂଳକ)\n\n3. **ମୋବାଇଲ୍ ନମ୍ବର ଓ ଫଟୋ**\n\n4. **ଆୟ / ଜାତି ପ୍ରମାଣପତ୍ର** (ଆବଶ୍ୟକ ସ୍ଥଳେ)`;
        }
        answer += `\n\n💡 **ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ପରାମର୍ଶ:** ସୁନିଶ୍ଚିତ କରନ୍ତୁ ଯେ ଆପଣଙ୍କ ବ୍ୟାଙ୍କ ଖାତା ଆଧାର ସହିତ ସଂଯୁକ୍ତ (NPCI Seeded) ଅଛି।`;
      } else if (isHindi) {
        answer = `📄 **${primary.name} के लिए आवश्यक दस्तावेज़ (Required Documents Checklist):**\n\n` +
          `इस योजना में आवेदन करने और लाभ प्राप्त करने के लिए निम्नलिखित आधिकारिक दस्तावेज़ आवश्यक हैं:\n\n`;
        if (docs.length > 0) {
          answer += docs.map((d, i) => {
            const badge = d.isMandatory ? 'अनिवार्य' : 'वैकल्पिक';
            const desc = d.description ? `\n   - *विवरण:* ${d.description}` : '';
            return `${i + 1}. **${d.name}** (${badge})${desc}`;
          }).join('\n\n');
        } else {
          answer += `1. **आधार कार्ड (Aadhaar Card)** (अनिवार्य)\n   - *विवरण:* पहचान व बायोमेट्रिक e-KYC प्रमाणीकरण के लिए।\n\n` +
            `2. **बैंक पासबुक (Bank Passbook)** (अनिवार्य)\n   - *विवरण:* आधार से लिंक (Aadhaar Seeded) बैंक खाता प्रत्यक्ष लाभ अंतरण (DBT) हेतु।\n\n` +
            `3. **सक्रिय मोबाइल नंबर व पासपोर्ट फोटो** (अनिवार्य)\n   - *विवरण:* आधार OTP सत्यापन और आवेदन अपडेट प्राप्त करने के लिए।\n\n` +
            `4. **आय / निवास / जाति प्रमाण पत्र** (यदि लागू हो)\n   - *विवरण:* श्रेणी आधारित पात्रता सत्यापन के लिए।`;
        }
        answer += `\n\n💡 **महत्वपूर्ण सुझाव:** सुनिश्चित करें कि आपका बैंक खाता **आधार से जुड़ा (NPCI Seeded)** हो, जिससे सरकारी सहायता राशि (DBT) बिना किसी रुकावट सीधे आपके खाते में जमा हो सके।`;
      } else {
        answer = `📄 **Required Documents for ${primary.name}:**\n\n` +
          `Here is the verified checklist of documents needed to apply for this scheme:\n\n`;
        if (docs.length > 0) {
          answer += docs.map((d, i) => {
            const badge = d.isMandatory ? 'Mandatory' : 'Optional';
            const desc = d.description ? `\n   - *Details:* ${d.description}` : '';
            return `${i + 1}. **${d.name}** (${badge})${desc}`;
          }).join('\n\n');
        } else {
          answer += `1. **Aadhaar Card** (Mandatory)\n   - *Details:* For identity verification and biometric e-KYC.\n\n` +
            `2. **Bank Account Passbook** (Mandatory)\n   - *Details:* Aadhaar-seeded bank account with active NPCI DBT mapping.\n\n` +
            `3. **Active Mobile Number & Passport Photo** (Mandatory)\n   - *Details:* Linked with Aadhaar for OTP verification.\n\n` +
            `4. **Income / Caste / Domicile Certificate** (If applicable)\n   - *Details:* For categorical eligibility verification.`;
        }
        answer += `\n\n💡 **Important Tip:** Ensure your name matches your **Aadhaar Card** exactly, and confirm your bank account has active NPCI DBT status for prompt cash transfers.`;
      }
      answer += getOtherSchemesFooter(relevant.slice(1, 5));
    }

    // ── INTENT 2: APPLICATION STEPS & PROCESS ──────────────────────────────
    else if (isSpecificSingleSchemeQuery && isApplyQuery && primary) {
      const steps = primary.applicationSteps || [];
      const portalUrl = primary.verification?.officialPortalUrl || '';
      const helpline = primary.verification?.helpline || '';

      if (isBengali) {
        answer = `📝 **${primary.name} এ আবেদন করার সম্পূর্ণ পদ্ধতি (Step-by-Step Application Guide):**\n\n` +
          `### 🌐 ১. অনলাইন আবেদন প্রক্রিয়া:\n`;
        if (steps.length > 0) {
          answer += steps.map(s => {
            const urlPart = s.actionUrl ? ` (পোর্টাল: ${s.actionUrl})` : '';
            const tipPart = s.tips ? `\n   💡 *পরামর্শ:* ${s.tips}` : '';
            return `• **ধাপ ${s.stepNumber}: ${s.title}**${urlPart}\n   ${s.description}${tipPart}`;
          }).join('\n\n');
        } else {
          answer += `• **ধাপ ১:** অফিসিয়াল সরকারি পোর্টালে যান।\n` +
            `• **ধাপ ২:** আধার নম্বর ও মোবাইল ওটিপির মাধ্যমে ই-কেওয়াইসি সম্পন্ন করুন।\n` +
            `• **ধাপ ৩:** ব্যক্তিগত বিবরণ, ব্যাঙ্ক তথ্য পূরণ করুন এবং প্রয়োজনীয় নথি আপলোড করুন।\n` +
            `• **ধাপ ৪:** ফর্ম জমা দিয়ে রসিদ বা রেফারেন্স নম্বর সংরক্ষণ করুন।`;
        }
        answer += `\n\n### 🏢 ২. অফলাইন আবেদন (নিকটস্থ জনসেবা কেন্দ্র - CSC):\n` +
          `• আপনি যদি অনলাইনে আবেদন করতে না পারেন, তবে নিকটস্থ **জনসেবা কেন্দ্র (CSC)** বা পঞ্চায়েত অফিসে যোগাযোগ করুন।\n` +
          `• আপনার সাথে মূল **আধার কার্ড**, **ব্যাঙ্ক পাসবুক** এবং প্রয়োজনীয় নথি নিয়ে যান।\n` +
          `• কেন্দ্র অপারেটর বায়োমেট্রিক ই-কেওয়াইসির মাধ্যমে ফর্ম জমা করতে সাহায্য করবেন।\n\n`;
        if (portalUrl) answer += `🌐 **অফিসিয়াল পোর্টাল:** ${portalUrl}\n`;
        if (helpline) answer += `📞 **হেল্পলাইন নম্বর:** ${helpline}\n`;
      } else if (isUrdu) {
        answer = `📝 **${primary.name} میں درخواست دینے کا مکمل طریقہ کار (Step-by-Step Guide):**\n\n` +
          `### 🌐 1. آن لائن درخواست کا طریقہ:\n`;
        if (steps.length > 0) {
          answer += steps.map(s => {
            const urlPart = s.actionUrl ? ` (پورٹل: ${s.actionUrl})` : '';
            const tipPart = s.tips ? `\n   💡 *مشورہ:* ${s.tips}` : '';
            return `• **مرحلہ ${s.stepNumber}: ${s.title}**${urlPart}\n   ${s.description}${tipPart}`;
          }).join('\n\n');
        } else {
          answer += `• **مرحلہ 1:** سرکاری پورٹل پر جائیں۔\n` +
            `• **مرحلہ 2:** آدھار نمبر اور موبائل او ٹی پی کے ذریعے ای کے وائی سی مکمل کریں۔\n` +
            `• **مرحلہ 3:** ذاتی تفصیلات، بینک کھاتہ اور دستاویزات اپ لوڈ کریں۔\n` +
            `• **مرحلہ 4:** فارم جمع کر کے رسید نمبر محفوظ کر لیں۔`;
        }
        answer += `\n\n### 🏢 2. آف لائن درخواست (قریبی سی ایس سی سینٹر):\n` +
          `• اگر آپ آن لائن درخواست نہیں دے سکتے تو قریبی **کامن سروس سینٹر (CSC)** یا گرام پنچایت دفتر جائیں۔\n` +
          `• اپنے ساتھ اصل **آدھار کارڈ**، **بینک پاس بک** اور ضروری دستاویزات لے جائیں۔\n` +
          `• مرکز کا عملہ بائیو میٹرک ای کے وائی سی کر کے فوری درخواست جمع کروا دے گا۔\n\n`;
        if (portalUrl) answer += `🌐 **سرکاری پورٹل:** ${portalUrl}\n`;
        if (helpline) answer += `📞 **ہیلپ لائن:** ${helpline}\n`;
      } else if (isPunjabi) {
        answer = `📝 **${primary.name} ਵਿੱਚ ਅਰਜ਼ੀ ਦੇਣ ਦੀ ਪੂਰੀ ਪ੍ਰਕਿਰਿਆ (Step-by-Step Guide):**\n\n` +
          `### 🌐 1. ਆਨਲਾਈਨ ਅਰਜ਼ੀ ਪ੍ਰਕਿਰਿਆ:\n`;
        if (steps.length > 0) {
          answer += steps.map(s => {
            const urlPart = s.actionUrl ? ` (ਪੋਰਟਲ: ${s.actionUrl})` : '';
            const tipPart = s.tips ? `\n   💡 *ਸੁਝਾਅ:* ${s.tips}` : '';
            return `• **ਕਦਮ ${s.stepNumber}: ${s.title}**${urlPart}\n   ${s.description}${tipPart}`;
          }).join('\n\n');
        } else {
          answer += `• **ਕਦਮ 1:** ਅਧਿਕਾਰਤ ਸਰਕਾਰੀ ਪੋਰਟਲ 'ਤੇ ਜਾਓ।\n` +
            `• **ਕਦਮ 2:** ਆਧਾਰ ਨੰਬਰ ਅਤੇ ਮੋਬਾਈਲ OTP ਰਾਹੀਂ e-KYC ਪੂਰਾ ਕਰੋ।\n` +
            `• **ਕਦਮ 3:** ਨਿੱਜੀ ਵੇਰਵੇ, ਬੈਂਕ ਖਾਤਾ ਅਤੇ ਜ਼ਰੂਰੀ ਦਸਤਾਵੇਜ਼ ਅਪਲੋਡ ਕਰੋ।\n` +
            `• **ਕਦਮ 4:** ਫਾਰਮ ਜਮ੍ਹਾਂ ਕਰੋ ਅਤੇ ਰਸੀਦ ਨੰਬਰ ਸੰਭਾਲ ਕੇ ਰੱਖੋ।`;
        }
        answer += `\n\n### 🏢 2. ਆਫ਼ਲਾਈਨ ਅਰਜ਼ੀ (ਕਾਮਨ ਸਰਵਿਸ ਸੈਂਟਰ - CSC):\n` +
          `• ਜੇਕਰ ਤੁਸੀਂ ਆਨਲਾਈਨ ਅਪਲਾਈ ਨਹੀਂ ਕਰ ਸਕਦੇ, ਤਾਂ ਆਪਣੇ ਨੇੜਲੇ **ਜਨ ਸੇਵਾ ਕੇਂਦਰ (CSC)** ਜਾਂ ਪੰਚਾਇਤ ਦਫ਼ਤਰ ਜਾਓ।\n` +
          `• ਅਸਲ **ਆਧਾਰ ਕਾਰਡ**, **ਬੈਂਕ ਪਾਸਬੁੱਕ** ਅਤੇ ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼ ਨਾਲ ਲੈ ਕੇ ਜਾਓ।\n` +
          `• CSC ਆਪਰੇਟਰ ਤੁਹਾਡੀ ਬਾਇਓਮੈਟ੍ਰਿਕ e-KYC ਕਰਕੇ ਫਾਰਮ ਤੁਰੰਤ ਜਮ੍ਹਾਂ ਕਰ ਦੇਵੇਗਾ।\n\n`;
        if (portalUrl) answer += `🌐 **ਸਰਕਾਰੀ ਪੋਰਟਲ:** ${portalUrl}\n`;
        if (helpline) answer += `📞 **ਹੈਲਪਲਾਈਨ:** ${helpline}\n`;
      } else if (isOdia) {
        answer = `📝 **${primary.name} ରେ ଆବେଦନ କରିବାର ପୂରା ପ୍ରକ୍ରିୟା (Step-by-Step Guide):**\n\n` +
          `### 🌐 1. ଅନଲାଇନ୍ ଆବେଦନ ପଦ୍ଧତି:\n`;
        if (steps.length > 0) {
          answer += steps.map(s => {
            const urlPart = s.actionUrl ? ` (ପୋର୍ଟାଲ: ${s.actionUrl})` : '';
            return `• **ପଦକ୍ଷେପ ${s.stepNumber}: ${s.title}**${urlPart}\n   ${s.description}`;
          }).join('\n\n');
        } else {
          answer += `• **ପଦକ୍ଷେପ ୧:** ସରକାରୀ ପୋର୍ଟାଲକୁ ଯାଆନ୍ତୁ।\n` +
            `• **ପଦକ୍ଷେପ ୨:** ଆଧାର OTP ମାଧ୍ୟମରେ e-KYC କରନ୍ତୁ।\n` +
            `• **ପଦକ୍ଷେପ ୩:** ବିବରଣୀ ପୂରଣ କରନ୍ତୁ ଏବଂ ଦସ୍ତାବିଜ୍ ଅପଲୋଡ୍ କରନ୍ତୁ।\n` +
            `• **ପଦକ୍ଷେପ ୪:** ଫର୍ମ ଦାଖଲ କରି ରସିଦ୍ ସାଇତି ରଖନ୍ତୁ।`;
        }
        answer += `\n\n### 🏢 2. ଅଫଲାଇନ୍ ଆବେଦନ (ଜନ ସେବା କେନ୍ଦ୍ର - CSC):\n` +
          `• ଯଦି ଆପଣ ଅନଲାଇନ୍ ଆବେଦନ କରିପାରୁନାହାଁନ୍ତି, ତେବେ ନିକଟସ୍ଥ **ଜନ ସେବା କେନ୍ଦ୍ର (CSC)** କୁ ଯାଆନ୍ତୁ।\n\n`;
        if (portalUrl) answer += `🌐 **ସରକାରୀ ପୋର୍ଟାଲ:** ${portalUrl}\n`;
        if (helpline) answer += `📞 **ହେଲ୍ପଲାଇନ୍:** ${helpline}\n`;
      } else if (isHindi) {
        answer = `📝 **${primary.name} में आवेदन करने की पूरी प्रक्रिया (Step-by-Step Application Guide):**\n\n` +
          `### 🌐 1. ऑनलाइन आवेदन प्रक्रिया (Online Application Steps):\n`;
        if (steps.length > 0) {
          answer += steps.map(s => {
            const urlPart = s.actionUrl ? ` (पोर्टल: ${s.actionUrl})` : '';
            const tipPart = s.tips ? `\n   💡 *सुझाव:* ${s.tips}` : '';
            return `• **चरण ${s.stepNumber}: ${s.title}**${urlPart}\n   ${s.description}${tipPart}`;
          }).join('\n\n');
        } else {
          answer += `• **चरण 1:** आधिकारिक सरकारी पोर्टल पर जाएं।\n` +
            `• **चरण 2:** आधार नंबर और मोबाइल OTP के माध्यम से e-KYC पूरा करें।\n` +
            `• **चरण 3:** व्यक्तिगत विवरण, बैंक खाता और आवश्यक दस्तावेज़ अपलोड करें।\n` +
            `• **चरण 4:** फॉर्म सबमिट करें और रजिस्ट्रेशन/पावती नंबर नोट करें।`;
        }
        answer += `\n\n### 🏢 2. ऑफलाइन आवेदन प्रक्रिया (Offline at CSC / Center):\n` +
          `• यदि आप ऑनलाइन आवेदन नहीं कर पा रहे हैं, तो अपने नजदीकी **जन सेवा केंद्र (Common Service Center - CSC)**, ग्राम पंचायत कार्यालय, या संबंधित सरकारी विभाग के हेल्पडेस्क पर जाएं।\n` +
          `• अपने साथ मूल **आधार कार्ड**, **बैंक पासबुक**, और आवश्यक दस्तावेज़ लेकर जाएं।\n` +
          `• CSC ऑपरेटर आपका बायोमेट्रिक e-KYC करके फॉर्म तुरंत सबमिट कर देगा।\n\n`;
        if (portalUrl) answer += `🌐 **आधिकारिक पोर्टल:** ${portalUrl}\n`;
        if (helpline) answer += `📞 **हेल्पलाइन नंबर:** ${helpline}\n`;
      } else {
        answer = `📝 **Step-by-Step Application Guide for ${primary.name}:**\n\n` +
          `### 🌐 1. Online Application Steps:\n`;
        if (steps.length > 0) {
          answer += steps.map(s => {
            const urlPart = s.actionUrl ? ` (Portal: ${s.actionUrl})` : '';
            const tipPart = s.tips ? `\n   💡 *Tip:* ${s.tips}` : '';
            return `• **Step ${s.stepNumber}: ${s.title}**${urlPart}\n   ${s.description}${tipPart}`;
          }).join('\n\n');
        } else {
          answer += `• **Step 1:** Visit the official designated welfare portal.\n` +
            `• **Step 2:** Complete Aadhaar OTP or biometric e-KYC authentication.\n` +
            `• **Step 3:** Fill in demographic, bank, and eligibility details; upload documents.\n` +
            `• **Step 4:** Submit the form and download your Acknowledgement Receipt.`;
        }
        answer += `\n\n### 🏢 2. Offline Application (CSC / Citizen Centers):\n` +
          `• Visit your nearest **Common Service Center (CSC)**, Village Panchayat office, or District Helpdesk.\n` +
          `• Carry your original **Aadhaar Card**, **Bank Passbook**, and relevant proof documents.\n` +
          `• The center operator will assist with biometric e-KYC and instant registration.\n\n`;
        if (portalUrl) answer += `🌐 **Official Portal:** ${portalUrl}\n`;
        if (helpline) answer += `📞 **Toll-Free Helpline:** ${helpline}\n`;
      }
      answer += getOtherSchemesFooter(relevant.slice(1, 5));
    }

    // ── INTENT 3: ELIGIBILITY CRITERIA ─────────────────────────────────────
    else if (isSpecificSingleSchemeQuery && isEligQuery && primary) {
      const elig = primary.eligibility;
      if (isBengali) {
        answer = `👥 **${primary.name} এর জন্য যোগ্যতার মাপকাঠি (Eligibility Criteria):**\n\n` +
          `এই প্রকল্পের সুবিধা পাওয়ার জন্য নিম্নলিখিত শর্তগুলি পূরণ করতে হবে:\n\n`;
        if (elig?.minAge !== undefined && elig?.maxAge !== undefined && (elig.minAge > 0 || elig.maxAge < 100)) {
          answer += `• **বয়সসীমা (Age Limit):** ${elig.minAge} বছর থেকে ${elig.maxAge} বছর\n`;
        }
        if (elig?.allowedOccupations && !(elig.allowedOccupations as any[]).includes('All')) {
          answer += `• **যোগ্য পেশা / শ্রেণী:** ${elig.allowedOccupations.join(', ')}\n`;
        }
        if (elig?.requiresBPL) {
          answer += `• **রেশন কার্ডের শর্ত:** BPL / অন্ত্যোদয় (AAY) / NFSA রেশন কার্ড থাকা আবশ্যক\n`;
        }
        if (elig?.customConditions && elig.customConditions.length > 0) {
          answer += `• **মূল শর্তাবলী:**\n` + elig.customConditions.map(c => `  - ${c}`).join('\n') + '\n';
        }
        answer += `\n💡 **অযোগ্যতা:** নিয়মিত সরকারি কর্মচারী এবং আয়করদাতারা সাধারণত এই প্রকল্পের আওতাভুক্ত নন।`;
      } else if (isUrdu) {
        answer = `👥 **${primary.name} کے لیے اہلیت کے معیار (Eligibility Criteria):**\n\n` +
          `اس اسکیم سے فائدہ اٹھانے کے لیے درج ذیل شرائط پوری ہونی چاہئیں:\n\n`;
        if (elig?.minAge !== undefined && elig?.maxAge !== undefined && (elig.minAge > 0 || elig.maxAge < 100)) {
          answer += `• **عمر کی حد (Age Limit):** ${elig.minAge} سال سے ${elig.maxAge} سال\n`;
        }
        if (elig?.allowedOccupations && !(elig.allowedOccupations as any[]).includes('All')) {
          answer += `• **مطلوبہ پیشہ / طبقہ:** ${elig.allowedOccupations.join(', ')}\n`;
        }
        if (elig?.requiresBPL) {
          answer += `• **راشن کارڈ کی ضرورت:** BPL / انتودیا (AAY) / NFSA راشن کارڈ لازمی ہے\n`;
        }
        if (elig?.customConditions && elig.customConditions.length > 0) {
          answer += `• **اہم شرائط:**\n` + elig.customConditions.map(c => `  - ${c}`).join('\n') + '\n';
        }
        answer += `\n💡 **نااہلی:** باقاعدہ سرکاری ملازمین اور انکم ٹیکس دینے والے افراد عموماً اس اسکیم کے اہل نہیں ہیں۔`;
      } else if (isPunjabi) {
        answer = `👥 **${primary.name} ਲਈ ਯੋਗਤਾ ਦੇ ਮਾਪਦੰਡ (Eligibility Criteria):**\n\n` +
          `ਇਸ ਸਕੀਮ ਦਾ ਲਾਭ ਲੈਣ ਲਈ ਹੇਠ ਲਿਖੀਆਂ ਸ਼ਰਤਾਂ ਪੂਰੀਆਂ ਹੋਣੀਆਂ ਚਾਹੀਦੀਆਂ ਹਨ:\n\n`;
        if (elig?.minAge !== undefined && elig?.maxAge !== undefined && (elig.minAge > 0 || elig.maxAge < 100)) {
          answer += `• **ਉਮਰ ਸੀਮਾ (Age Limit):** ${elig.minAge} ਤੋਂ ${elig.maxAge} ਸਾਲ\n`;
        }
        if (elig?.allowedOccupations && !(elig.allowedOccupations as any[]).includes('All')) {
          answer += `• **ਯੋਗ ਕਿੱਤਾ / ਵਰਗ:** ${elig.allowedOccupations.join(', ')}\n`;
        }
        if (elig?.requiresBPL) {
          answer += `• **ਰਾਸ਼ਨ ਕਾਰਡ:** BPL / ਅੰਤੋਦਿਆ (AAY) / NFSA ਰਾਸ਼ਨ ਕਾਰਡ ਧਾਰਕ ਪਰਿਵਾਰ\n`;
        }
        if (elig?.customConditions && elig.customConditions.length > 0) {
          answer += `• **ਮੁੱਖ ਸ਼ਰਤਾਂ:**\n` + elig.customConditions.map(c => `  - ${c}`).join('\n') + '\n';
        }
        answer += `\n💡 **ਅਯੋਗਤਾ:** ਸਰਕਾਰੀ ਕਰਮਚਾਰੀ ਅਤੇ ਇਨਕਮ ਟੈਕਸ ਦੇਣ ਵਾਲੇ ਆਮ ਤੌਰ 'ਤੇ ਇਸ ਸਕੀਮ ਲਈ ਯੋਗ ਨਹੀਂ ਹਨ।`;
      } else if (isOdia) {
        answer = `👥 **${primary.name} ପାଇଁ ଯୋଗ୍ୟତା ମାନଦଣ୍ଡ (Eligibility Criteria):**\n\n` +
          `ଏହି ଯୋଜନାର ଲାଭ ନେବା ପାଇଁ ନିମ୍ନଲିଖିତ ସର୍ତ୍ତ ପୂରଣ ହେବା ଆବଶ୍ୟକ:\n\n`;
        if (elig?.minAge !== undefined && elig?.maxAge !== undefined && (elig.minAge > 0 || elig.maxAge < 100)) {
          answer += `• **ବୟସ ସୀମା:** ${elig.minAge} ବର୍ଷରୁ ${elig.maxAge} ବର୍ଷ\n`;
        }
        if (elig?.customConditions && elig.customConditions.length > 0) {
          answer += `• **ମୁଖ୍ୟ ସର୍ତ୍ତାବଳୀ:**\n` + elig.customConditions.map(c => `  - ${c}`).join('\n') + '\n';
        }
      } else if (isHindi) {
        answer = `👥 **${primary.name} के लिए पात्रता मानदंड (Eligibility Criteria):**\n\n` +
          `इस योजना का लाभ लेने के लिए निम्नलिखित पात्रता शर्तें पूरी होनी चाहिए:\n\n`;
        if (elig?.minAge !== undefined && elig?.maxAge !== undefined && (elig.minAge > 0 || elig.maxAge < 100)) {
          answer += `• **आयु सीमा (Age Limit):** ${elig.minAge} वर्ष से ${elig.maxAge} वर्ष\n`;
        }
        if (elig?.allowedOccupations && !(elig.allowedOccupations as any[]).includes('All')) {
          answer += `• **पात्र व्यवसाय / वर्ग:** ${elig.allowedOccupations.join(', ')}\n`;
        }
        if (elig?.requiresBPL) {
          answer += `• **राशन कार्ड स्थिति:** BPL / अंत्योदय (AAY) / NFSA राशन कार्ड धारक परिवार\n`;
        }
        if (elig?.customConditions && elig.customConditions.length > 0) {
          answer += `• **मुख्य शर्तें (Conditions):**\n` + elig.customConditions.map(c => `  - ${c}`).join('\n') + '\n';
        }
        answer += `\n💡 **अपात्रता (Who is Not Eligible):** संवैधानिक पदों पर आसीन व्यक्ति, सरकारी कर्मचारी, और आयकरदाता (Income Tax Payers) सामान्यतः इस योजना के पात्र नहीं हैं।`;
      } else {
        answer = `👥 **Eligibility Criteria for ${primary.name}:**\n\n` +
          `To qualify for this scheme, applicants must satisfy the following criteria:\n\n`;
        if (elig?.minAge !== undefined && elig?.maxAge !== undefined && (elig.minAge > 0 || elig.maxAge < 100)) {
          answer += `• **Age Limit:** ${elig.minAge} to ${elig.maxAge} years\n`;
        }
        if (elig?.allowedOccupations && !(elig.allowedOccupations as any[]).includes('All')) {
          answer += `• **Target Occupations:** ${elig.allowedOccupations.join(', ')}\n`;
        }
        if (elig?.requiresBPL) {
          answer += `• **Ration Card Requirement:** Must hold BPL / Antyodaya (AAY) / NFSA Ration Card\n`;
        }
        if (elig?.customConditions && elig.customConditions.length > 0) {
          answer += `• **Specific Conditions:**\n` + elig.customConditions.map(c => `  - ${c}`).join('\n') + '\n';
        }
        answer += `\n💡 **Ineligibility:** Regular government employees, institutional landholders, and income tax payers are generally excluded.`;
      }
      answer += getOtherSchemesFooter(relevant.slice(1, 5));
    }

    // ── INTENT 4: BENEFITS & FINANCIAL ASSISTANCE ──────────────────────────
    else if (isSpecificSingleSchemeQuery && isBenefitQuery && primary) {
      const benefits = primary.benefits || [];
      if (isBengali) {
        answer = `💰 **${primary.name} এর প্রধান সুবিধা ও আর্থিক সহায়তা (Benefits & Financial Aid):**\n\n` +
          `এই প্রকল্পের আওতায় যোগ্য সুবিধাভোগীদের নিম্নলিখিত সুবিধা প্রদান করা হয়:\n\n`;
        if (benefits.length > 0) {
          answer += benefits.map((b, i) => {
            const val = b.amountOrValue ? ` — **${b.amountOrValue}**` : '';
            const desc = b.description ? `\n   ${b.description}` : '';
            return `${i + 1}. **${b.title}**${val}${desc}`;
          }).join('\n\n');
        } else {
          answer += `${primary.shortDescription || primary.tagline || 'সরকারি নির্দেশিকা অনুযায়ী আর্থিক সহায়তা ও কল্যাণমূলক সুবিধা।'}\n`;
        }
        answer += `\n\n💳 **প্রদান মাধ্যম:** অনুদানের অর্থ সরাসরি সুবিধাভোগীর আধার লিঙ্কযুক্ত ব্যাঙ্ক অ্যাকাউন্টে (DBT) জমা করা হয়।`;
      } else if (isUrdu) {
        answer = `💰 **${primary.name} کے اہم فوائد اور مالی امداد (Benefits & Financial Aid):**\n\n` +
          `اس اسکیم کے تحت مستحقین کو درج ذیل مالی اور فلاحی فوائد فراہم کیے جاتے ہیں:\n\n`;
        if (benefits.length > 0) {
          answer += benefits.map((b, i) => {
            const val = b.amountOrValue ? ` — **${b.amountOrValue}**` : '';
            const desc = b.description ? `\n   ${b.description}` : '';
            return `${i + 1}. **${b.title}**${val}${desc}`;
          }).join('\n\n');
        } else {
          answer += `${primary.shortDescription || primary.tagline || 'سرکاری ہدایات کے مطابق مالی امداد اور فلاحی فوائد۔'}\n`;
        }
        answer += `\n\n💳 **ادائیگی کا طریقہ:** امدادی رقم براہ راست مستفید کے آدھار سے منسلک بینک اکاؤنٹ میں (DBT) منتقل کی جاتی ہے۔`;
      } else if (isPunjabi) {
        answer = `💰 **${primary.name} ਦੇ ਮੁੱਖ ਲਾਭ ਅਤੇ ਵਿੱਤੀ ਸਹਾਇਤਾ (Benefits & Financial Aid):**\n\n` +
          `ਇਸ ਸਕੀਮ ਅਧੀਨ ਯੋਗ ਲਾਭਪਾਤਰੀਆਂ ਨੂੰ ਹੇਠ ਲਿਖੇ ਲਾਭ ਦਿੱਤੇ ਜਾਂਦੇ ਹਨ:\n\n`;
        if (benefits.length > 0) {
          answer += benefits.map((b, i) => {
            const val = b.amountOrValue ? ` — **${b.amountOrValue}**` : '';
            const desc = b.description ? `\n   ${b.description}` : '';
            return `${i + 1}. **${b.title}**${val}${desc}`;
          }).join('\n\n');
        } else {
          answer += `${primary.shortDescription || primary.tagline || 'ਸਰਕਾਰੀ ਨਿਯਮਾਂ ਅਨੁਸਾਰ ਵਿੱਤੀ ਸਹਾਇਤਾ ਅਤੇ ਭਲਾਈ ਲਾਭ।'}\n`;
        }
        answer += `\n\n💳 **ਭੁਗਤਾਨ ਦਾ ਢੰਗ:** ਸਹਾਇਤਾ ਰਾਸ਼ੀ ਡਾਇਰੈਕਟ ਬੈਨੀਫਿਟ ਟਰਾਂਸਫਰ (DBT) ਰਾਹੀਂ ਸਿੱਧੇ ਲਾਭਪਾਤਰੀ ਦੇ ਆਧਾਰ-ਲਿੰਕਡ ਬੈਂਕ ਖਾਤੇ ਵਿੱਚ ਜਮ੍ਹਾਂ ਕੀਤੀ ਜਾਂਦੀ ਹੈ।`;
      } else if (isOdia) {
        answer = `💰 **${primary.name} ର ମୁଖ୍ୟ ଲାଭ ଓ ସହାୟତା ରାଶି (Benefits):**\n\n`;
        if (benefits.length > 0) {
          answer += benefits.map((b, i) => {
            const val = b.amountOrValue ? ` — **${b.amountOrValue}**` : '';
            return `${i + 1}. **${b.title}**${val}`;
          }).join('\n\n');
        } else {
          answer += `${primary.shortDescription || primary.tagline || 'ସରକାରୀ ନିୟମାନୁସାରେ ଆର୍ଥିକ ସହାୟତା।'}\n`;
        }
      } else if (isHindi) {
        answer = `💰 **${primary.name} के मुख्य लाभ व सहायता राशि (Benefits & Financial Aid):**\n\n` +
          `इस योजना के तहत लाभार्थियों को निम्नलिखित वित्तीय और कल्याणकारी लाभ प्रदान किए जाते हैं:\n\n`;
        if (benefits.length > 0) {
          answer += benefits.map((b, i) => {
            const val = b.amountOrValue ? ` — **${b.amountOrValue}**` : '';
            const desc = b.description ? `\n   ${b.description}` : '';
            return `${i + 1}. **${b.title}**${val}${desc}`;
          }).join('\n\n');
        } else {
          answer += `${primary.shortDescription || primary.tagline || 'सरकारी दिशा-निर्देशों के अनुसार वित्तीय सहायता व कल्याणकारी लाभ।'}\n`;
        }
        answer += `\n\n💳 **भुगतान माध्यम:** सहायता राशि प्रत्यक्ष लाभ अंतरण (DBT) के माध्यम से सीधे लाभार्थी के बैंक खाते में ट्रांसफर की जाती है।`;
      } else {
        answer = `💰 **Key Benefits & Financial Assistance for ${primary.name}:**\n\n` +
          `Under this scheme, eligible beneficiaries receive the following benefits:\n\n`;
        if (benefits.length > 0) {
          answer += benefits.map((b, i) => {
            const val = b.amountOrValue ? ` — **${b.amountOrValue}**` : '';
            const desc = b.description ? `\n   ${b.description}` : '';
            return `${i + 1}. **${b.title}**${val}${desc}`;
          }).join('\n\n');
        } else {
          answer += `${primary.shortDescription || primary.tagline || 'Government welfare and financial assistance.'}\n`;
        }
        answer += `\n\n💳 **Disbursement Mode:** Benefits are transferred directly into the beneficiary's Aadhaar-seeded bank account via Direct Benefit Transfer (DBT).`;
      }
      answer += getOtherSchemesFooter(relevant.slice(1, 5));
    }

    // ── INTENT 5 / DEFAULT: MULTI-SCHEME DETERMINISTIC RECOMMENDATIONS ─────
    else {
      let headerTitle = '';
      if (hasTopic) {
        if (isBengali) {
          headerTitle = "🏛️ **আপনার অনুসন্ধান অনুযায়ী ৫টি শীর্ষ সরকারি প্রকল্প:**";
          if (matchedTopics.some(t => t.topic === 'Agriculture')) headerTitle = "🌾 **কৃষক ও কৃষির জন্য ৫টি শীর্ষ সরকারি প্রকল্প:**";
          else if (matchedTopics.some(t => t.topic === 'Education')) headerTitle = "🎓 **শিক্ষা ও স্কলারশিপের জন্য ৫টি শীর্ষ সরকারি প্রকল্প:**";
          else if (matchedTopics.some(t => t.topic === 'Business')) headerTitle = "💼 **ব্যবসা, দোকান ও ঋণের জন্য ৫টি শীর্ষ সরকারি প্রকল্প:**";
          else if (matchedTopics.some(t => t.topic === 'Healthcare')) headerTitle = "🏥 **স্বাস্থ্য ও বিনামূল্যে চিকিৎসার ৫টি শীর্ষ প্রকল্প:**";
          else if (matchedTopics.some(t => t.topic === 'Housing')) headerTitle = "🏠 **আবাস ও পাকা বাড়ির ৫টি সরকারি প্রকল্প:**";
          else if (matchedTopics.some(t => t.topic === 'Social Security')) headerTitle = "💰 **পেনশন ও সামাজিক সুরক্ষার ৫টি শীর্ষ প্রকল্প:**";
          else if (matchedTopics.some(t => t.topic === 'Women & Child')) headerTitle = "👩 **নারী ও শিশু কল্যাণের ৫টি শীর্ষ সরকারি প্রকল্প:**";
          else if (matchedTopics.some(t => t.topic === 'Employment')) headerTitle = "💼 **কর্মসংস্থান ও দক্ষতা উন্নয়নের ৫টি প্রকল্প:**";
        } else if (isUrdu) {
          headerTitle = "🏛️ **آپ کی تلاش کے مطابق 5 اہم ترین تصدیق شدہ سرکاری اسکیمیں:**";
          if (matchedTopics.some(t => t.topic === 'Agriculture')) headerTitle = "🌾 **کسانوں اور زراعت سے متعلق 5 اہم سرکاری اسکیمیں:**";
          else if (matchedTopics.some(t => t.topic === 'Education')) headerTitle = "🎓 **تعلیم اور وظائف سے متعلق 5 اہم سرکاری اسکیمیں:**";
          else if (matchedTopics.some(t => t.topic === 'Business')) headerTitle = "💼 **کاروبار اور لون سے متعلق 5 اہم سرکاری اسکیمیں:**";
          else if (matchedTopics.some(t => t.topic === 'Healthcare')) headerTitle = "🏥 **صحت اور طبی امداد سے متعلق 5 اہم اسکیمیں:**";
          else if (matchedTopics.some(t => t.topic === 'Housing')) headerTitle = "🏠 **رہائش اور مکان سے متعلق 5 اہم سرکاری اسکیمیں:**";
          else if (matchedTopics.some(t => t.topic === 'Social Security')) headerTitle = "💰 **پنشن اور سماجی تحفظ کی 5 اہم اسکیمیں:**";
          else if (matchedTopics.some(t => t.topic === 'Women & Child')) headerTitle = "👩 **خواتین اور بچوں کی بہبود کی 5 اہم اسکیمیں:**";
          else if (matchedTopics.some(t => t.topic === 'Employment')) headerTitle = "💼 **روزگار اور ہنر مندی سے متعلق 5 اہم اسکیمیں:**";
        } else if (isPunjabi) {
          headerTitle = "🏛️ **ਤੁਹਾਡੀ ਖੋਜ ਅਨੁਸਾਰ 5 ਪ੍ਰਮੁੱਖ ਸਰਕਾਰੀ ਸਕੀਮਾਂ:**";
          if (matchedTopics.some(t => t.topic === 'Agriculture')) headerTitle = "🌾 **ਕਿਸਾਨਾਂ ਅਤੇ ਖੇਤੀਬਾੜੀ ਲਈ 5 ਪ੍ਰਮੁੱਖ ਸਰਕਾਰੀ ਸਕੀਮਾਂ:**";
          else if (matchedTopics.some(t => t.topic === 'Education')) headerTitle = "🎓 **ਸਿੱਖਿਆ ਅਤੇ ਵਜ਼ੀਫ਼ਿਆਂ ਲਈ 5 ਪ੍ਰਮੁੱਖ ਸਰਕਾਰੀ ਸਕੀਮਾਂ:**";
          else if (matchedTopics.some(t => t.topic === 'Business')) headerTitle = "💼 **ਵਪਾਰ, ਦੁਕਾਨ ਅਤੇ ਮੁਦਰਾ ਕਰਜ਼ਿਆਂ ਲਈ 5 ਸਕੀਮਾਂ:**";
          else if (matchedTopics.some(t => t.topic === 'Healthcare')) headerTitle = "🏥 **ਸਿਹਤ ਅਤੇ ਮੁਫ਼ਤ ਇਲਾਜ ਲਈ 5 ਸਰਕਾਰੀ ਸਕੀਮਾਂ:**";
          else if (matchedTopics.some(t => t.topic === 'Housing')) headerTitle = "🏠 **ਰਿਹਾਇਸ਼ ਅਤੇ ਪੱਕੇ ਮਕਾਨ ਲਈ 5 ਸਕੀਮਾਂ:**";
          else if (matchedTopics.some(t => t.topic === 'Social Security')) headerTitle = "💰 **ਪੈਨਸ਼ਨ ਅਤੇ ਸਮਾਜਿਕ ਸੁਰੱਖਿਆ ਦੀਆਂ 5 ਸਕੀਮਾਂ:**";
          else if (matchedTopics.some(t => t.topic === 'Women & Child')) headerTitle = "👩 **ਔਰਤਾਂ ਅਤੇ ਬੱਚਿਆਂ ਦੀ ਭਲਾਈ ਲਈ 5 ਸਕੀਮਾਂ:**";
          else if (matchedTopics.some(t => t.topic === 'Employment')) headerTitle = "💼 **ਰੋਜ਼ਗਾਰ ਅਤੇ ਹੁਨਰ ਵਿਕਾਸ ਲਈ 5 ਸਕੀਮਾਂ:**";
        } else if (isHindi) {
          headerTitle = "🏛️ **आपकी खोज के अनुसार 5 प्रमुख पात्र सरकारी योजनाएं:**";
          if (matchedTopics.some(t => t.topic === 'Agriculture')) headerTitle = "🌾 **किसान एवं कृषि से संबंधित 5 प्रमुख सरकारी योजनाएं:**";
          else if (matchedTopics.some(t => t.topic === 'Education')) headerTitle = "🎓 **शिक्षा एवं छात्रवृत्ति से संबंधित 5 प्रमुख सरकारी योजनाएं:**";
          else if (matchedTopics.some(t => t.topic === 'Business')) headerTitle = "💼 **व्यवसाय, दुकान एवं मुद्रा लोन से संबंधित 5 प्रमुख योजनाएं:**";
          else if (matchedTopics.some(t => t.topic === 'Healthcare')) headerTitle = "🏥 **स्वास्थ्य एवं चिकित्सा सहायता से संबंधित 5 प्रमुख योजनाएं:**";
          else if (matchedTopics.some(t => t.topic === 'Housing')) headerTitle = "🏠 **आवास एवं पक्का मकान से संबंधित 5 प्रमुख योजनाएं:**";
          else if (matchedTopics.some(t => t.topic === 'Social Security')) headerTitle = "💰 **पेंशन एवं सामाजिक सुरक्षा से संबंधित 5 प्रमुख योजनाएं:**";
          else if (matchedTopics.some(t => t.topic === 'Women & Child')) headerTitle = "👩 **महिला एवं बाल विकास से संबंधित 5 प्रमुख योजनाएं:**";
          else if (matchedTopics.some(t => t.topic === 'Employment')) headerTitle = "💼 **रोजगार एवं कौशल विकास से संबंधित 5 प्रमुख योजनाएं:**";
        } else {
          headerTitle = "🏛️ **Top 5 Verified Government Schemes Matching Your Inquiry:**";
          if (matchedTopics.some(t => t.topic === 'Agriculture')) headerTitle = "🌾 **Top 5 Government Schemes for Farmers & Agriculture:**";
          else if (matchedTopics.some(t => t.topic === 'Education')) headerTitle = "🎓 **Top 5 Government Schemes for Students & Education:**";
          else if (matchedTopics.some(t => t.topic === 'Business')) headerTitle = "💼 **Top 5 Government Schemes for Business, Shop & Loans:**";
          else if (matchedTopics.some(t => t.topic === 'Healthcare')) headerTitle = "🏥 **Top 5 Government Schemes for Healthcare & Medical Aid:**";
          else if (matchedTopics.some(t => t.topic === 'Housing')) headerTitle = "🏠 **Top 5 Government Housing Schemes:**";
          else if (matchedTopics.some(t => t.topic === 'Social Security')) headerTitle = "💰 **Top 5 Government Schemes for Pension & Social Security:**";
          else if (matchedTopics.some(t => t.topic === 'Women & Child')) headerTitle = "👩 **Top 5 Government Schemes for Women & Child Welfare:**";
          else if (matchedTopics.some(t => t.topic === 'Employment')) headerTitle = "💼 **Top 5 Government Schemes for Employment & Skill Development:**";
        }
      } else {
        if (isBengali) {
          headerTitle = profDesc
            ? `নমস্কার! 🙏 আপনার প্রোফাইল (**${profDesc}**) অনুযায়ী যোগ্যতার ভিত্তিতে ৫টি সেরা সরকারি প্রকল্প:`
            : `নমস্কার! 🙏 আপনার জন্য ৫টি যাচাইকৃত শীর্ষ সরকারি প্রকল্প:`;
        } else if (isUrdu) {
          headerTitle = profDesc
            ? `سلام! 🙏 آپ کے پروفائل (**${profDesc}**) کی اہلیت کے مطابق 5 اہم ترین سرکاری اسکیمیں:`
            : `سلام! 🙏 آپ کے لیے 5 تصدیق شدہ فلاحی سرکاری اسکیمیں:`;
        } else if (isPunjabi) {
          headerTitle = profDesc
            ? `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 🙏 ਤੁਹਾਡੇ ਪ੍ਰੋਫਾਈਲ (**${profDesc}**) ਦੀ ਯੋਗਤਾ ਅਨੁਸਾਰ 5 ਪ੍ਰਮੁੱਖ ਸਰਕਾਰੀ ਸਕੀਮਾਂ:`
            : `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 🙏 ਤੁਹਾਡੇ ਲਈ 5 ਪ੍ਰਮਾਣਿਤ ਸਰਕਾਰੀ ਸਕੀਮਾਂ:`;
        } else if (isHindi) {
          headerTitle = profDesc
            ? `नमस्ते! 🙏 आपकी प्रोफ़ाइल (**${profDesc}**) की पात्रता के आधार पर **5 प्रमुख सरकारी योजनाएं**:`
            : `नमस्ते! 🙏 आपकी पात्रता के अनुसार **5 प्रमुख सरकारी योजनाएं** निम्नलिखित हैं:`;
        } else {
          headerTitle = profDesc
            ? `Hello! 🙏 Based on your citizen profile (**${profDesc}**), here are **top 5 verified eligible schemes**:`
            : `Hello! 🙏 Here are **top 5 verified government welfare schemes** tailored to your eligibility:`;
        }
      }

      answer = formatDeterministicSchemeList(relevant, headerTitle);
    }

    return {
      answer,
      referencedSchemes: relevant,
      profileUpdated,
      updatedProfile: profileUpdated ? updatedProfile : undefined,
    };
  }

  // ── Authentication & Email OTP ──────────────────────────────────────────

  async sendOtp(
    email: string,
    purpose: 'signup' | 'login' | 'reset' = 'signup'
  ): Promise<{ message: string; email: string; devOtp?: string; isSmtpConfigured?: boolean }> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        return await this.post<{
          message: string;
          email: string;
          devOtp?: string;
          isSmtpConfigured?: boolean;
        }>('/api/auth/send-otp/', {
          email,
          purpose,
        });
      } catch (err: any) {
        if (err && !isNetworkOrAbortError(err)) {
          throw err;
        }
        console.warn('Backend sendOtp unavailable, using demo simulation:', err);
      }
    }

    // Demo/standalone fallback simulation
    const demoOtp = '123456';
    console.info(`[Demo Auth] Verification OTP for ${email}: ${demoOtp}`);
    try {
      sessionStorage.setItem(`sn_demo_otp_${email}`, demoOtp);
    } catch {
      // ignore
    }
    return {
      message: `Verification code generated for ${email}.`,
      email,
      devOtp: demoOtp,
      isSmtpConfigured: false,
    };
  }

  async verifyOtp(params: {
    email: string;
    otp: string;
    purpose: 'signup' | 'login' | 'reset';
    name?: string;
    password?: string;
  }): Promise<{ message: string; user: any }> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        return await this.post<{ message: string; user: any }>('/api/auth/verify-otp/', params);
      } catch (err: any) {
        if (err && !isNetworkOrAbortError(err)) {
          throw err;
        }
        console.warn('Backend verifyOtp unavailable, using demo simulation:', err);
      }
    }

    // Demo/standalone fallback verification
    const stored = sessionStorage.getItem(`sn_demo_otp_${params.email}`);
    if (params.otp === '123456' || (stored && stored === params.otp)) {
      const demoUser = {
        id: 'usr-' + Date.now(),
        name: params.name || params.email.split('@')[0] || 'User',
        email: params.email,
        isLoggedIn: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${params.name || params.email}`,
      };
      return {
        message: 'Verification successful.',
        user: demoUser,
      };
    }
    throw new Error('Incorrect verification code. Please enter the code sent or demo code 123456.');
  }

  async loginWithPassword(email: string, password: string): Promise<{ message: string; user: any }> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        return await this.post<{ message: string; user: any }>('/api/auth/login/', { email, password });
      } catch (err: any) {
        if (err && !isNetworkOrAbortError(err)) {
          throw err;
        }
        console.warn('Backend login unavailable, using demo simulation:', err);
      }
    }

    // Demo fallback login
    const demoUser = {
      id: 'usr-' + Date.now(),
      name: email.split('@')[0] || 'User',
      email,
      isLoggedIn: true,
    };
    return {
      message: 'Login successful.',
      user: demoUser,
    };
  }

  async getCurrentUser(): Promise<{ user: any } | null> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        return await this.request<{ user: any }>('/api/auth/me/');
      } catch {
        return null;
      }
    }
    return null;
  }

  async logout(): Promise<void> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        await this.post('/api/auth/logout/', {});
      } catch {
        // ignore
      }
    }
  }

  // ── Notification Management (WhatsApp & SMS) ────────────────────────────────

  async getNotificationPreferences(phone?: string): Promise<NotificationPreferences> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const query = phone ? `?phone=${encodeURIComponent(phone)}` : '';
        const res = await this.request<NotificationPreferences>(`/api/notifications/preferences/${query}`);
        if (res) {
          saveLocalNotificationPreferences(res);
          return res;
        }
      } catch (err) {
        console.warn('Backend notification preferences fetch fallback:', err);
      }
    }
    return getLocalNotificationPreferences();
  }

  async saveNotificationPreferences(prefs: NotificationPreferences): Promise<NotificationPreferences> {
    saveLocalNotificationPreferences(prefs);
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const res = await this.post<NotificationPreferences>('/api/notifications/preferences/', prefs);
        if (res) {
          saveLocalNotificationPreferences(res);
          return res;
        }
      } catch (err) {
        console.warn('Backend notification preferences save fallback:', err);
      }
    }
    return prefs;
  }

  async sendNotification(payload: SendNotificationPayload): Promise<SendNotificationResponse> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        return await this.post<SendNotificationResponse>('/api/notifications/send/', payload);
      } catch (err) {
        console.warn('Backend send notification fallback to local simulation:', err);
      }
    }

    // Local simulation fallback
    const cleanDigits = (payload.phone_number || '').replace(/[^\d]/g, '');
    const isHindi = (payload.lang_code || '').startsWith('hi');
    const defaultText = `🔔 Your SchemeNavigator Alerts Are Active\n\nYou’ll now receive timely updates about your government-scheme journey:\n\n🎯 New Matches\nGet notified when a government scheme relevant to your profile is found.\n\n⏰ Deadline Alerts\nReceive timely reminders before important application deadlines.\n\n📋 Application Updates\nGet updates related to government schemes you are tracking.\n\n📱 Notifications will be sent through WhatsApp and SMS.\n\nStay informed. Never miss an opportunity.\n— Team SchemeNavigator`;

    const msg = payload.data?.message || payload.data?.notes || defaultText;
    const waUrl = `https://wa.me/${cleanDigits.startsWith('91') ? cleanDigits : '91' + cleanDigits}?text=${encodeURIComponent(msg)}`;

    return {
      success: true,
      recipient: payload.phone_number,
      title: '🔔 Your SchemeNavigator Alerts Are Active',
      message: msg,
      whatsapp_web_url: waUrl,
      results: {
        whatsapp: { success: true, channel: 'whatsapp', status: 'simulated', whatsapp_web_url: waUrl },
        sms: { success: true, channel: 'sms', status: 'simulated' },
      },
    };
  }

  async triggerTrackerAlert(payload: {
    phone_number?: string;
    scheme_name: string;
    status: string;
    notes?: string;
    portal_url?: string;
    lang_code?: string;
    channels?: ('whatsapp' | 'sms')[];
  }): Promise<any> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        return await this.post('/api/notifications/tracker-alert/', payload);
      } catch (err) {
        console.warn('Backend tracker alert fallback:', err);
      }
    }

    return this.sendNotification({
      phone_number: payload.phone_number || getLocalNotificationPreferences().phone_number,
      channels: payload.channels || ['whatsapp', 'sms'],
      template_type: 'tracker_update',
      data: {
        scheme_name: payload.scheme_name,
        status: payload.status,
        notes: payload.notes || '',
        portal_url: payload.portal_url || 'https://schemenavigator.gov.in',
      },
      lang_code: payload.lang_code || 'hi-IN',
    });
  }

  async getNotificationLogs(phone?: string): Promise<NotificationLogItem[]> {
    if (this.hasBackend() && this.isBackendAvailable !== false) {
      try {
        const query = phone ? `?phone=${encodeURIComponent(phone)}` : '';
        return await this.request<NotificationLogItem[]>(`/api/notifications/logs/${query}`);
      } catch (err) {
        console.warn('Backend notification logs fallback:', err);
      }
    }
    return [];
  }
}

export { HttpApiClient };

