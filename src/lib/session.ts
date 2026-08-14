export type Session = {
  patient?: string;
  tagId?: string;
  product?: string;
  gtin?: string;
  lot?: string;
  expiry?: string;
  serial?: string;
  beforeWeight?: number;
  afterWeight?: number;
  beforePhoto?: string;
  afterPhoto?: string;
};
const KEY = 'chaindose-session';
export function getSession(): Session {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
export function updateSession(p: Partial<Session>) {
  const s = {...getSession(), ...p};
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
export function clearSession() {
  localStorage.removeItem(KEY);
}
