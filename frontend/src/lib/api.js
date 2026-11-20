const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'liverr.token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, query, signal } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '' && v !== null)) : '';
  let res;
  try {
    res = await fetch(`${BASE}/api${path}${qs}`, {
      method,
      signal,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('Can’t reach the server. It may be waking up — try again in a few seconds.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}
