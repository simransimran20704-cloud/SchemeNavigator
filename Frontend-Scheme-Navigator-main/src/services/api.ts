import { UserProfile, TrackerItem, Scheme } from '../types';
import { HttpApiClient } from './httpClient';

import {
  registerSaveChangeListener,
  registerProfileChangeListener,
  registerTrackerChangeListener,
} from './storageService';

function resolveBackendUrl(): string {
  if (typeof window === 'undefined') return '';

  const hostname = window.location.hostname;
  const port = window.location.port;
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLan =
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.local');

  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  // If envUrl is explicitly set to an absolute remote backend (e.g. https://api.myscheme.gov.in)
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // When loaded through Vite dev server (5173) or preview (4173), Vite's proxy forwards
  // all /api requests directly to Django (http://127.0.0.1:8000).
  // Using relative path '' ensures other devices on the same Wi-Fi (phones/tablets)
  // route through Vite's open port seamlessly without CORS preflight failures or
  // Windows Firewall port 8000 blocks.
  if (port === '5173' || port === '4173') {
    return '';
  }

  // If already loaded on port 8000, relative '' works as well
  if (port === '8000') {
    return '';
  }

  // If accessing on LAN or loopback without Vite dev/preview port, target host:8000
  if (isLoopback || isLan) {
    return `http://${hostname}:8000`;
  }

  return '';
}

const _backendUrl = resolveBackendUrl();

export const API_BASE_URL = _backendUrl;
export const api = new HttpApiClient(_backendUrl);

// Automatically synchronize local bookmark toggles, profile updates, and tracker changes with backend database
registerSaveChangeListener((isSaved: boolean, schemeId: string, scheme?: Scheme) => {
  if (isSaved) {
    api.saveScheme(schemeId, scheme);
  } else {
    api.removeSavedScheme(schemeId, scheme?.slug);
  }
});

registerProfileChangeListener((profile: UserProfile) => {
  api.updateProfile(profile);
});

registerTrackerChangeListener((item: TrackerItem) => {
  api.updateApplication(item);
});

export default api;

