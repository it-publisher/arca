// The access code (token + history key) and the draft live only in this browser.
// Note history is fetched from the server, encrypted with the history key.
const ACCESS_CODE_KEY = 'arca:access-code';
const DRAFT_KEY = 'arca:draft';
const LEGACY_KEYS = ['arca:token', 'arca:history'];

export const getAccessCode = () => localStorage.getItem(ACCESS_CODE_KEY);
export const setAccessCode = (accessCode) => localStorage.setItem(ACCESS_CODE_KEY, accessCode);
export const clearAccessCode = () => localStorage.removeItem(ACCESS_CODE_KEY);

/** Before server-side history, keys of old notes were stored here; nothing reads them any more. */
export function removeLegacyData() {
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}

export function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Corrupted draft in localStorage, ignoring it:', error);
    return null;
  }
}

export const saveDraft = (draft) => localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
export const clearDraft = () => localStorage.removeItem(DRAFT_KEY);
