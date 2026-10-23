import {
  UserProfile,
  TrackerItem,
  ApplicationStatus,
  SchemeCategory,
  Scheme,
  SchemeMatchResult,
  NotificationPreferences,
} from '../types';
import { getSafeOfficialUrl, extractCleanPortalUrl } from '../utils/portalUrls';

const STORAGE_KEYS = {
  PROFILE: 'sn_user_profile_v2',
  SAVED_SCHEMES: 'sn_saved_schemes_v2',
  SAVED_SCHEME_OBJS: 'sn_saved_scheme_objs_v2',
  SAVED_SCHEMES_BACKUP: 'sn_saved_schemes_backup_v2',
  DELETED_SCHEMES: 'sn_deleted_schemes_v2',
  TRACKER: 'sn_tracker_items_v2',
  AUTH: 'sn_auth_user_v2',
  RECOMMENDATIONS: 'sn_cached_recommendations_v2',
};

const LEGACY_SAVED_KEYS = [
  'sn_saved_scheme_objs_v2',
  'sn_saved_schemes_v2',
  'sn_saved_schemes_backup_v2',
  'sn_saved_scheme_objs',
  'sn_saved_schemes',
  'saved_schemes',
  'saved_schemes_v2',
  'savedSchemes',
  'savedSchemes_v2',
  'sn_saved_backup',
];

const WELL_KNOWN_SCHEMES: Record<string, { name: string; category: SchemeCategory; level: string; desc?: string; portal?: string }> = {
  'pm-kisan': { name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)', category: 'Agriculture', level: 'Central', desc: 'Direct income support of ₹6,000 per year for farmer families.', portal: 'https://pmkisan.gov.in' },
  'pm-kisan-samman-nidhi': { name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)', category: 'Agriculture', level: 'Central', desc: 'Direct income support of ₹6,000 per year for farmer families.', portal: 'https://pmkisan.gov.in' },
  'ayushman-bharat-pmjay': { name: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY)', category: 'Healthcare', level: 'Central', desc: 'Cashless hospital cover of ₹5 Lakh per family per year.', portal: 'https://beneficiary.nha.gov.in' },
  'ayushman-vaya-vandana-senior-citizens': { name: 'Ayushman Bharat Vaya Vandana Card (For All 70+ Seniors)', category: 'Healthcare', level: 'Central', desc: '₹5 Lakh annual cashless healthcare cover for seniors aged 70+.', portal: 'https://beneficiary.nha.gov.in' },
  'pradhan-mantri-mudra-yojana': { name: 'Pradhan Mantri Mudra Yojana (PMMY)', category: 'Business', level: 'Central', desc: 'Collateral-free business loans up to ₹20 Lakh for micro enterprises.', portal: 'https://www.udyamimitra.in' },
  'pm-mudra': { name: 'Pradhan Mantri Mudra Yojana (PMMY)', category: 'Business', level: 'Central', desc: 'Collateral-free business loans up to ₹20 Lakh for micro enterprises.', portal: 'https://www.udyamimitra.in' },
  'atal-pension-yojana': { name: 'Atal Pension Yojana (APY)', category: 'Social Security', level: 'Central', desc: 'Guaranteed monthly pension of ₹1,000 to ₹5,000 after age 60.', portal: 'https://enps.nsdl.com' },
  'sukanya-samriddhi-yojana': { name: 'Sukanya Samriddhi Yojana (SSY)', category: 'Women & Child', level: 'Central', desc: 'High-interest sovereign savings scheme for girl children under 10 years.', portal: 'https://www.indiapost.gov.in' },
  'pm-vishwakarma-scheme': { name: 'PM Vishwakarma Scheme', category: 'Skill Development', level: 'Central', desc: 'Loans up to ₹3 Lakh @ 5% + ₹15,000 toolkit voucher for artisans.', portal: 'https://pmvishwakarma.gov.in' },
  'post-matric-scholarship-sc-obc-minority': { name: 'Post-Matric Scholarship Scheme for Students', category: 'Education', level: 'Central', desc: 'Tuition fee reimbursement and monthly allowance for higher education.', portal: 'https://scholarships.gov.in' },
  'pradhan-mantri-awas-yojana-gramin': { name: 'Pradhan Mantri Awaas Yojana - Gramin (PMAY-G)', category: 'Housing', level: 'Central', desc: 'Financial assistance of up to ₹1.30 Lakh for building a pucca house.', portal: 'https://pmayg.nic.in' },
  'pm-awas-yojana-urban': { name: 'Pradhan Mantri Awas Yojana - Urban (PMAY-U)', category: 'Housing', level: 'Central', desc: 'Interest subsidy on home loans for affordable urban housing.', portal: 'https://pmaymis.gov.in' },
  'pm-kusum-solar-pump-scheme': { name: 'PM-KUSUM Solar Pump Scheme', category: 'Agriculture', level: 'Central', desc: 'Up to 60% capital subsidy for solar agricultural water pumps.', portal: 'https://pmkusum.mnre.gov.in' },
};

// Safe helper to read JSON from localStorage
function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return fallback;
}

// Safe helper to write JSON to localStorage
function writeToStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

// ── In-memory & Persistent Store ─────────────────────────────────────────────

let _profile: UserProfile | null = readFromStorage<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
let _savedSchemeIds: string[] = readFromStorage<string[]>(STORAGE_KEYS.SAVED_SCHEMES, []);
let _savedSchemes: Scheme[] = readFromStorage<Scheme[]>(STORAGE_KEYS.SAVED_SCHEME_OBJS, []);
let _trackerItems: TrackerItem[] = readFromStorage<TrackerItem[]>(STORAGE_KEYS.TRACKER, []);
let _authUser: AuthUser | null = readFromStorage<AuthUser | null>(STORAGE_KEYS.AUTH, null);

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isLoggedIn: boolean;
  avatarUrl?: string;
}

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'deserted';

export const DEFAULT_DEMO_PROFILE: UserProfile = {
  age: 20,
  gender: 'male',
  state: 'Haryana',
  district: 'Gurugram',
  areaType: 'Urban',
  category: 'General',
  isDisability: false,
  isMinority: false,
  hasBPLCard: false,
  employmentType: 'Student',
  studentCourse: 'Bachelor of Technology (B.Tech)',
  incomeRange: '₹1–2.5 lakh',
  completedAt: new Date().toISOString(),
};

// ── User Profile ─────────────────────────────────────────────────────────────

export function getSavedProfile(): UserProfile | null {
  if (!_profile) {
    _profile = readFromStorage<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  }
  return _profile;
}

let _profileChangeListeners: Array<(profile: UserProfile) => void> = [];
export function registerProfileChangeListener(fn: (profile: UserProfile) => void) {
  _profileChangeListeners.push(fn);
  return () => {
    _profileChangeListeners = _profileChangeListeners.filter((l) => l !== fn);
  };
}

export function saveUserProfile(profile: UserProfile, emitEvent: boolean = true): void {
  _profile = { ...profile, completedAt: new Date().toISOString() };
  writeToStorage(STORAGE_KEYS.PROFILE, _profile);
  try {
    localStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('sn_profile_updated'));
  if (emitEvent) {
    _profileChangeListeners.forEach((fn) => {
      try {
        fn(_profile!);
      } catch {}
    });
  }
}

export function clearUserProfile(): void {
  _profile = null;
  try {
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('sn_profile_updated'));
}

export function clearCachedRecommendations(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS);
  } catch {
    // ignore
  }
}

export function calculateProfileCompletion(profile: UserProfile | null): number {
  if (!profile) return 0;
  let score = 0;
  if (profile.age !== undefined && profile.age !== '') score += 15;
  if (profile.gender) score += 15;
  if (profile.state) score += 15;
  if (profile.areaType || profile.residenceArea) score += 10;
  if (profile.employmentType || profile.occupation || profile.employmentStatus) score += 15;
  if (profile.category) score += 15;
  if (profile.incomeRange || profile.annualIncome !== undefined) score += 15;

  return Math.min(100, Math.max(0, score));
}

// ── Cached Recommendations ──────────────────────────────────────────────────

export function getCachedRecommendations(): SchemeMatchResult[] {
  return readFromStorage<SchemeMatchResult[]>(STORAGE_KEYS.RECOMMENDATIONS, []);
}

export function saveCachedRecommendations(recommendations: SchemeMatchResult[]): void {
  writeToStorage(STORAGE_KEYS.RECOMMENDATIONS, recommendations);
}

// ── Saved Schemes ─────────────────────────────────────────────────────────────

function formatTitleFromSlug(slug: string): string {
  if (!slug) return 'Government Scheme';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (['PM', 'PMAY', 'KCC', 'APY', 'PMMY', 'PMJAY', 'SSY', 'PMKVY', 'NAPS', 'DBT', 'SC', 'ST', 'OBC', 'BPL'].includes(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function getDeletedSchemeKeys(): Set<string> {
  const raw = readFromStorage<string[]>(STORAGE_KEYS.DELETED_SCHEMES, []);
  return new Set(Array.isArray(raw) ? raw.map((k) => String(k).trim().toLowerCase()) : []);
}

export function addDeletedSchemeKey(key: string): void {
  if (!key) return;
  const set = getDeletedSchemeKeys();
  set.add(key.trim().toLowerCase());
  writeToStorage(STORAGE_KEYS.DELETED_SCHEMES, Array.from(set));
}

export function removeDeletedSchemeKey(key: string): void {
  if (!key) return;
  const set = getDeletedSchemeKeys();
  set.delete(key.trim().toLowerCase());
  writeToStorage(STORAGE_KEYS.DELETED_SCHEMES, Array.from(set));
}

export function recoverAllSavedSchemes(): Scheme[] {
  const deletedKeys = getDeletedSchemeKeys();
  const seenKeys = new Set<string>();
  const recoveredSchemes: Scheme[] = [];
  const candidateIds = new Set<string>();

  // 1. Gather candidates from all potential localStorage keys
  for (const storageKey of LEGACY_SAVED_KEYS) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const item of parsed) {
          if (!item) continue;
          if (typeof item === 'object') {
            const sid = String(item.id || item.slug || '').trim();
            const key = sid.toLowerCase();
            const slugKey = item.slug ? String(item.slug).toLowerCase() : '';
            if (deletedKeys.has(key) || (slugKey && deletedKeys.has(slugKey))) {
              continue; // Do NOT resurrect explicitly deleted schemes
            }
            if (key && !seenKeys.has(key)) {
              seenKeys.add(key);
              if (item.slug && item.slug.toLowerCase() !== key) {
                seenKeys.add(item.slug.toLowerCase());
              }
              // Enrich if missing name
              if (!item.name || item.name === 'undefined' || item.name === sid) {
                const known = WELL_KNOWN_SCHEMES[key] || (item.slug ? WELL_KNOWN_SCHEMES[item.slug.toLowerCase()] : undefined);
                if (known) {
                  item.name = known.name;
                  item.category = item.category || known.category;
                  item.level = item.level || known.level;
                  item.shortDescription = item.shortDescription || known.desc;
                  item.officialPortalUrl = item.officialPortalUrl || known.portal;
                } else {
                  item.name = formatTitleFromSlug(sid);
                }
              }
              recoveredSchemes.push(item as Scheme);
              candidateIds.add(sid);
            }
          } else if (typeof item === 'string') {
            const sid = item.trim();
            if (sid && !deletedKeys.has(sid.toLowerCase())) {
              candidateIds.add(sid);
            }
          }
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  // 2. For any raw string ID:
  for (const sid of candidateIds) {
    const key = sid.toLowerCase();
    if (deletedKeys.has(key)) continue;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const known = WELL_KNOWN_SCHEMES[key];
      const recs = readFromStorage<SchemeMatchResult[]>(STORAGE_KEYS.RECOMMENDATIONS, []);
      const recMatch = recs.find(
        (r) => r.scheme && ((r.scheme.id && r.scheme.id.toLowerCase() === key) || (r.scheme.slug && r.scheme.slug.toLowerCase() === key))
      );

      if (recMatch?.scheme) {
        recoveredSchemes.push(recMatch.scheme);
      } else if (known) {
        recoveredSchemes.push({
          id: sid,
          slug: sid,
          name: known.name,
          category: known.category,
          level: known.level,
          shortDescription: known.desc,
          officialPortalUrl: known.portal,
        } as unknown as Scheme);
      } else {
        recoveredSchemes.push({
          id: sid,
          slug: sid,
          name: formatTitleFromSlug(sid),
          category: 'Social Welfare' as SchemeCategory,
          level: 'Central',
          shortDescription: 'Verified government welfare scheme.',
        } as unknown as Scheme);
      }
    }
  }

  return recoveredSchemes;
}

export function getSavedSchemes(): Scheme[] {
  let list = readFromStorage<Scheme[]>(STORAGE_KEYS.SAVED_SCHEME_OBJS, []);
  const authUser = getAuthUser();
  const isInitialized = typeof localStorage !== 'undefined' && localStorage.getItem('sn_saved_initialized') === 'true';

  // Only recover from legacy keys if the list is completely empty, user is NOT logged in, and not initialized
  if ((!Array.isArray(list) || list.length === 0) && !authUser?.isLoggedIn && !isInitialized) {
    const deletedKeys = getDeletedSchemeKeys();
    const recovered = recoverAllSavedSchemes().filter((s) => {
      const k1 = (s.id || '').toLowerCase();
      const k2 = (s.slug || '').toLowerCase();
      return !deletedKeys.has(k1) && (!k2 || !deletedKeys.has(k2));
    });
    if (recovered.length > 0) {
      list = recovered;
      writeToStorage(STORAGE_KEYS.SAVED_SCHEME_OBJS, list);
      writeToStorage(STORAGE_KEYS.SAVED_SCHEMES, list.map((s) => s.id || s.slug || '').filter(Boolean));
      writeToStorage(STORAGE_KEYS.SAVED_SCHEMES_BACKUP, list);
    }
  }

  // Deduplicate and ensure clean object format
  const seen = new Set<string>();
  const deduped: Scheme[] = [];
  for (const s of list || []) {
    if (!s) continue;
    const key = (s.id || s.slug || '').toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      if (s.slug && s.slug.toLowerCase() !== key) {
        seen.add(s.slug.toLowerCase());
      }
      if (!s.name || s.name === 'undefined' || s.name === (s.id || s.slug)) {
        const known = WELL_KNOWN_SCHEMES[key];
        if (known) {
          s.name = known.name;
          s.category = s.category || known.category;
          s.level = s.level || (known.level as 'Central' | 'State');
          s.shortDescription = s.shortDescription || known.desc || 'Verified government scheme.';
          if (!s.verification) {
            (s as any).verification = { officialPortalUrl: known.portal || '' };
          } else if (known.portal) {
            s.verification.officialPortalUrl = s.verification.officialPortalUrl || known.portal;
          }
        } else {
          s.name = formatTitleFromSlug(s.id || s.slug || '');
          s.shortDescription = s.shortDescription || 'Verified government scheme.';
        }
      }
      deduped.push(s);
    }
  }
  _savedSchemes = deduped;
  _savedSchemeIds = _savedSchemes.map((s) => s.id || s.slug || '').filter(Boolean);
  return [..._savedSchemes];
}

export function getSavedSchemeIds(): string[] {
  const schemes = getSavedSchemes();
  _savedSchemeIds = schemes.map((s) => s.id || s.slug || '').filter(Boolean);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEMES, _savedSchemeIds);
  return [..._savedSchemeIds];
}

export function setSavedSchemesList(schemes: Scheme[]): void {
  const seen = new Set<string>();
  const deduped: Scheme[] = [];
  for (const s of schemes || []) {
    if (!s) continue;
    const key = (s.id || s.slug || '').toLowerCase();
    const slugKey = (s.slug || '').toLowerCase();
    // Since these schemes are affirmatively in the list, remove them from deletedKeys
    if (key) removeDeletedSchemeKey(key);
    if (slugKey) removeDeletedSchemeKey(slugKey);

    if (key && !seen.has(key)) {
      seen.add(key);
      if (s.slug && s.slug.toLowerCase() !== key) {
        seen.add(s.slug.toLowerCase());
      }
      deduped.push(s);
    }
  }
  _savedSchemes = deduped;
  _savedSchemeIds = _savedSchemes.map((s) => s.id || s.slug || '').filter(Boolean);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEMES, _savedSchemeIds);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEME_OBJS, _savedSchemes);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEMES_BACKUP, _savedSchemes);
  try {
    localStorage.setItem('sn_saved_initialized', 'true');
  } catch {}
  window.dispatchEvent(new Event('sn_saved_updated'));
}

export function isSchemeSaved(schemeIdOrSlug?: string): boolean {
  if (!schemeIdOrSlug) return false;
  const target = String(schemeIdOrSlug).trim().toLowerCase();
  const deletedKeys = getDeletedSchemeKeys();
  if (deletedKeys.has(target)) return false;

  const currentObjs = getSavedSchemes();
  return currentObjs.some((s) =>
    (s.id && s.id.toLowerCase() === target) ||
    (s.slug && s.slug.toLowerCase() === target)
  );
}

let _saveChangeListeners: Array<(isSaved: boolean, schemeId: string, scheme?: Scheme) => void> = [];
export function registerSaveChangeListener(fn: (isSaved: boolean, schemeId: string, scheme?: Scheme) => void) {
  _saveChangeListeners.push(fn);
  return () => {
    _saveChangeListeners = _saveChangeListeners.filter((l) => l !== fn);
  };
}

export function removeSavedScheme(schemeOrId: string | Scheme): boolean {
  if (!schemeOrId) return false;
  const isObj = typeof schemeOrId === 'object' && schemeOrId !== null;
  const idStr = String(isObj ? (schemeOrId.id || (schemeOrId as any).slug || '') : schemeOrId).trim().toLowerCase();
  const slugStr = String(isObj ? ((schemeOrId as any).slug || schemeOrId.id || '') : '').trim().toLowerCase();

  const currentObjs = getSavedSchemes();
  const foundIndex = currentObjs.findIndex(
    (s) =>
      (s.id && s.id.toLowerCase() === idStr) ||
      (s.slug && s.slug.toLowerCase() === idStr) ||
      (slugStr && (
        (s.id && s.id.toLowerCase() === slugStr) ||
        (s.slug && s.slug.toLowerCase() === slugStr)
      ))
  );

  const matched = foundIndex >= 0 ? currentObjs[foundIndex] : (isObj ? (schemeOrId as Scheme) : null);
  const matchedId = matched?.id ? String(matched.id).toLowerCase() : idStr;
  const matchedSlug = matched?.slug ? String(matched.slug).toLowerCase() : slugStr;

  // Add to deleted keys blacklist
  if (matchedId) addDeletedSchemeKey(matchedId);
  if (matchedSlug) addDeletedSchemeKey(matchedSlug);
  if (idStr) addDeletedSchemeKey(idStr);
  if (slugStr) addDeletedSchemeKey(slugStr);

  // Filter remaining saved schemes
  const remaining = currentObjs.filter((s) => {
    const sid = (s.id || '').toLowerCase();
    const ssl = (s.slug || '').toLowerCase();
    if (sid && (sid === matchedId || sid === matchedSlug || sid === idStr || (slugStr && sid === slugStr))) return false;
    if (ssl && (ssl === matchedId || ssl === matchedSlug || ssl === idStr || (slugStr && ssl === slugStr))) return false;
    return true;
  });

  _savedSchemes = remaining;
  _savedSchemeIds = remaining.map((s) => s.id || s.slug || '').filter(Boolean);

  // Persist to all storage locations
  writeToStorage(STORAGE_KEYS.SAVED_SCHEMES, _savedSchemeIds);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEME_OBJS, _savedSchemes);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEMES_BACKUP, _savedSchemes);

  // Clean out of legacy keys
  for (const key of LEGACY_SAVED_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => {
          if (!item) return false;
          if (typeof item === 'string') {
            const s = item.trim().toLowerCase();
            return s !== matchedId && s !== matchedSlug && s !== idStr && s !== slugStr;
          }
          if (typeof item === 'object') {
            const sid = (item.id || '').trim().toLowerCase();
            const ssl = (item.slug || '').trim().toLowerCase();
            return (
              sid !== matchedId &&
              sid !== matchedSlug &&
              sid !== idStr &&
              ssl !== matchedId &&
              ssl !== matchedSlug &&
              ssl !== idStr
            );
          }
          return true;
        });
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch {}
  }

  // Notify listeners and UI
  window.dispatchEvent(new Event('sn_saved_updated'));
  _saveChangeListeners.forEach((fn) => {
    try {
      fn(false, matchedId || idStr, matched || undefined);
    } catch {}
  });

  return true;
}

export function toggleSaveScheme(schemeOrId: string | Scheme, schemeObj?: Scheme): boolean {
  const isObj = typeof schemeOrId === 'object' && schemeOrId !== null;
  const schemeId = isObj ? (schemeOrId.id || (schemeOrId as any).slug) : String(schemeOrId).trim();
  const schemeSlug = isObj ? ((schemeOrId as any).slug || schemeOrId.id) : (schemeObj ? (schemeObj.slug || schemeObj.id) : undefined);

  const currentObjs = getSavedSchemes();
  const targetKey = String(schemeId).toLowerCase();
  const targetSlugKey = schemeSlug ? String(schemeSlug).toLowerCase() : undefined;

  const existingIndex = currentObjs.findIndex(
    (s) =>
      (s.id && s.id.toLowerCase() === targetKey) ||
      (s.slug && s.slug.toLowerCase() === targetKey) ||
      (targetSlugKey && (
        (s.id && s.id.toLowerCase() === targetSlugKey) ||
        (s.slug && s.slug.toLowerCase() === targetSlugKey)
      ))
  );

  if (existingIndex >= 0) {
    removeSavedScheme(currentObjs[existingIndex]);
    return false;
  } else {
    removeDeletedSchemeKey(targetKey);
    if (targetSlugKey) removeDeletedSchemeKey(targetSlugKey);

    let targetObj: Scheme | undefined = isObj ? schemeOrId : schemeObj;
    if (!targetObj) {
      const known = WELL_KNOWN_SCHEMES[targetKey] || (targetSlugKey ? WELL_KNOWN_SCHEMES[targetSlugKey] : undefined);
      const cachedRecs = getCachedRecommendations();
      const match = cachedRecs.find(
        (r) => r.scheme && ((r.scheme.id && r.scheme.id.toLowerCase() === targetKey) || (r.scheme.slug && r.scheme.slug.toLowerCase() === targetKey))
      );
      if (match?.scheme) {
        targetObj = match.scheme;
      } else if (known) {
        targetObj = {
          id: schemeId,
          slug: schemeSlug || schemeId,
          name: known.name,
          category: known.category,
          level: known.level,
          shortDescription: known.desc,
          officialPortalUrl: known.portal,
        } as unknown as Scheme;
      } else {
        const trackerMatch = getTrackerItems().find(
          (t) => (t.schemeId && t.schemeId.toLowerCase() === targetKey)
        );
        if (trackerMatch) {
          targetObj = {
            id: schemeId,
            slug: schemeSlug || schemeId,
            name: trackerMatch.schemeName,
            category: trackerMatch.category,
            level: trackerMatch.level,
            shortDescription: trackerMatch.shortDescription,
            officialPortalUrl: trackerMatch.officialPortalUrl,
          } as unknown as Scheme;
        }
      }
    }

    if (!targetObj) {
      targetObj = {
        id: schemeId,
        slug: schemeSlug || schemeId,
        name: formatTitleFromSlug(schemeSlug || schemeId),
        category: 'Social Welfare' as SchemeCategory,
        level: 'Central',
        shortDescription: 'Verified government welfare scheme.',
      } as unknown as Scheme;
    }

    _savedSchemes = [
      targetObj,
      ...currentObjs.filter(
        (s) =>
          (s.id && s.id.toLowerCase() !== targetKey) &&
          (s.slug && s.slug.toLowerCase() !== targetKey) &&
          (!targetSlugKey || ((s.id && s.id.toLowerCase() !== targetSlugKey) && (s.slug && s.slug.toLowerCase() !== targetSlugKey)))
      ),
    ];
    _savedSchemeIds = _savedSchemes.map((s) => s.id || s.slug || '').filter(Boolean);
    writeToStorage(STORAGE_KEYS.SAVED_SCHEMES, _savedSchemeIds);
    writeToStorage(STORAGE_KEYS.SAVED_SCHEME_OBJS, _savedSchemes);
    writeToStorage(STORAGE_KEYS.SAVED_SCHEMES_BACKUP, _savedSchemes);
    window.dispatchEvent(new Event('sn_saved_updated'));
    _saveChangeListeners.forEach((fn) => {
      try {
        fn(true, schemeId, targetObj);
      } catch {}
    });

    try {
      if (typeof window !== 'undefined') {
        const user = getAuthUser();
        const skipPrompt = localStorage.getItem('sn_skip_save_signup');
        if (!user?.isLoggedIn && skipPrompt !== 'true') {
          window.dispatchEvent(
            new CustomEvent('sn_prompt_save_signup', { detail: { scheme: targetObj } })
          );
        }
      }
    } catch {}

    return true;
  }
}

// ── Application Guidance Tracker ─────────────────────────────────────────────

export function getTrackerItems(): TrackerItem[] {
  _trackerItems = readFromStorage<TrackerItem[]>(STORAGE_KEYS.TRACKER, []);
  
  // Auto-repair missing fields or 'undefined' names from saved schemes store
  const saved = readFromStorage<Scheme[]>(STORAGE_KEYS.SAVED_SCHEME_OBJS, []);
  let hasRepaired = false;
  
  _trackerItems = _trackerItems.map((item) => {
    // Auto-repair any legacy unparsed portal URLs stored in localStorage
    if (item.officialPortalUrl && (item.officialPortalUrl.includes('\n') || item.officialPortalUrl.includes('Guidelines:') || item.officialPortalUrl.includes('file:///'))) {
      item.officialPortalUrl = extractCleanPortalUrl(item.officialPortalUrl);
      hasRepaired = true;
    }

    if (
      !item.schemeName ||
      item.schemeName === 'undefined' ||
      item.schemeName === 'Unknown Scheme' ||
      !item.category
    ) {
      const match = saved.find((s) => s.id === item.schemeId || s.slug === item.schemeId);
      if (match) {
        hasRepaired = true;
        const officialUrl = getSafeOfficialUrl(match);
        return {
          ...item,
          schemeName: match.name || item.schemeName,
          category: match.category || item.category || ('Social Welfare' as SchemeCategory),
          level: match.level || item.level || 'Central',
          shortDescription: match.shortDescription || (match as any)?.description || item.shortDescription,
          officialPortalUrl: officialUrl || item.officialPortalUrl,
          totalDocumentsCount: match.documents?.length || item.totalDocumentsCount,
        };
      }
    }
    return item;
  });

  if (hasRepaired) {
    writeToStorage(STORAGE_KEYS.TRACKER, _trackerItems);
  }

  return [..._trackerItems];
}

export function addSchemeToTracker(
  scheme: Scheme,
  status: ApplicationStatus = 'Exploring',
  notes?: string
): void {
  const schemeId = scheme.id || scheme.slug;
  if (!schemeId) return;

  const current = getTrackerItems();
  const existingIndex = current.findIndex(
    (i) =>
      i.schemeId === schemeId ||
      (scheme.slug && i.schemeId === scheme.slug) ||
      (scheme.id && i.schemeId === scheme.id)
  );
  const officialPortalUrl = getSafeOfficialUrl(scheme);

  const itemData: TrackerItem = {
    id: existingIndex >= 0 ? current[existingIndex].id : 'tr-' + Date.now(),
    schemeId,
    schemeName: scheme.name || (existingIndex >= 0 ? current[existingIndex].schemeName : 'Scheme'),
    category: scheme.category || (existingIndex >= 0 ? current[existingIndex].category : ('Social Welfare' as SchemeCategory)),
    level: scheme.level || (existingIndex >= 0 ? current[existingIndex].level : 'Central'),
    shortDescription: scheme.shortDescription || (scheme as any)?.description || (existingIndex >= 0 ? current[existingIndex].shortDescription : undefined),
    officialPortalUrl: officialPortalUrl || (existingIndex >= 0 ? current[existingIndex].officialPortalUrl : undefined),
    status: existingIndex >= 0 ? current[existingIndex].status : status,
    notes: notes || (existingIndex >= 0 ? current[existingIndex].notes : 'Started exploring scheme guidance.'),
    preparedDocuments: existingIndex >= 0 ? current[existingIndex].preparedDocuments : [],
    totalDocumentsCount: scheme.documents?.length || (existingIndex >= 0 ? current[existingIndex].totalDocumentsCount : undefined),
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    _trackerItems = current.map((item, idx) => (idx === existingIndex ? { ...item, ...itemData } : item));
  } else {
    _trackerItems = [itemData, ...current];
  }

  writeToStorage(STORAGE_KEYS.TRACKER, _trackerItems);
  window.dispatchEvent(new Event('sn_tracker_updated'));
}

export function updateTrackerStatus(
  schemeId: string,
  schemeName: string,
  category: SchemeCategory,
  status: ApplicationStatus,
  notes?: string
): void {
  const current = getTrackerItems();
  const existingIndex = current.findIndex((i) => i.schemeId === schemeId);

  if (existingIndex >= 0) {
    _trackerItems = current.map((item, idx) =>
      idx === existingIndex
        ? {
            ...item,
            schemeName: schemeName && schemeName !== 'undefined' ? schemeName : item.schemeName,
            category: category || item.category,
            status,
            notes: notes ?? item.notes,
            updatedAt: new Date().toISOString(),
          }
        : item
    );
  } else {
    _trackerItems = [
      {
        id: 'tr-' + Date.now(),
        schemeId,
        schemeName: schemeName || 'Scheme',
        category: category || ('Social Welfare' as SchemeCategory),
        status,
        notes: notes || 'Started exploring scheme guidance.',
        preparedDocuments: [],
        updatedAt: new Date().toISOString(),
      },
      ...current,
    ];
  }

  writeToStorage(STORAGE_KEYS.TRACKER, _trackerItems);
  window.dispatchEvent(new Event('sn_tracker_updated'));
}

export function removeTrackerItem(schemeId: string): void {
  const current = getTrackerItems();
  _trackerItems = current.filter((i) => i.schemeId !== schemeId);
  writeToStorage(STORAGE_KEYS.TRACKER, _trackerItems);
  window.dispatchEvent(new Event('sn_tracker_updated'));
}

let _trackerChangeListeners: Array<(item: TrackerItem) => void> = [];
export function registerTrackerChangeListener(fn: (item: TrackerItem) => void) {
  _trackerChangeListeners.push(fn);
  return () => {
    _trackerChangeListeners = _trackerChangeListeners.filter((l) => l !== fn);
  };
}

export function setTrackerItemsList(items: TrackerItem[]): void {
  _trackerItems = Array.isArray(items) ? [...items] : [];
  writeToStorage(STORAGE_KEYS.TRACKER, _trackerItems);
  window.dispatchEvent(new Event('sn_tracker_updated'));
}

export function saveTrackerItem(item: TrackerItem, emitListener: boolean = true): void {
  const current = getTrackerItems();
  const existingIndex = current.findIndex((i) => i.schemeId === item.schemeId);
  if (existingIndex >= 0) {
    _trackerItems = current.map((t, idx) =>
      idx === existingIndex ? { ...item, updatedAt: new Date().toISOString() } : t
    );
  } else {
    _trackerItems = [
      { ...item, id: item.id || 'tr-' + Date.now(), updatedAt: new Date().toISOString() },
      ...current,
    ];
  }
  writeToStorage(STORAGE_KEYS.TRACKER, _trackerItems);
  window.dispatchEvent(new Event('sn_tracker_updated'));

  if (emitListener) {
    _trackerChangeListeners.forEach((fn) => {
      try {
        fn(item);
      } catch {}
    });
  }
}

// ── Auth State ────────────────────────────────────────────────────────────────

export function getAuthUser(): AuthUser | null {
  if (!_authUser) {
    _authUser = readFromStorage<AuthUser | null>(STORAGE_KEYS.AUTH, null);
  }
  return _authUser;
}

export function setAuthUser(user: AuthUser | null): void {
  if (user) {
    _authUser = { ...user, isLoggedIn: true };
    writeToStorage(STORAGE_KEYS.AUTH, _authUser);
    try {
      localStorage.setItem('sn_auth_user', JSON.stringify(_authUser));
    } catch {}
  } else {
    _authUser = null;
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      localStorage.removeItem('sn_auth_user');
    } catch {
      // ignore
    }
  }
  window.dispatchEvent(new Event('sn_auth_updated'));
}

export function clearAllUserData(): void {
  clearUserProfile();
  clearCachedRecommendations();
  _savedSchemes = [];
  _savedSchemeIds = [];
  writeToStorage(STORAGE_KEYS.SAVED_SCHEMES, []);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEME_OBJS, []);
  writeToStorage(STORAGE_KEYS.SAVED_SCHEMES_BACKUP, []);
  _trackerItems = [];
  writeToStorage(STORAGE_KEYS.TRACKER, []);
  window.dispatchEvent(new Event('sn_saved_updated'));
  window.dispatchEvent(new Event('sn_tracker_updated'));
  window.dispatchEvent(new Event('sn_profile_updated'));
}

export function loginMockUser(name: string = 'User', email: string = 'user@example.com'): AuthUser {
  const user: AuthUser = {
    id: 'usr-101',
    name,
    email,
    isLoggedIn: true,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
  };
  setAuthUser(user);
  return user;
}

export function logoutUser(): void {
  setAuthUser(null);
  clearAllUserData();
}

export const logoutMockUser = logoutUser;

const NOTIFICATION_PREF_KEY = 'sn_notification_preferences_v1';

export function getLocalNotificationPreferences(): NotificationPreferences {
  return readFromStorage<NotificationPreferences>(NOTIFICATION_PREF_KEY, {
    phone_number: '',
    channel_whatsapp: true,
    channel_sms: true,
    notify_tracker_updates: true,
    notify_deadlines: true,
    notify_new_schemes: false,
    preferred_language: 'hi-IN',
  });
}

export function saveLocalNotificationPreferences(prefs: NotificationPreferences): void {
  writeToStorage(NOTIFICATION_PREF_KEY, prefs);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sn_notifications_updated', { detail: prefs }));
  }
}



