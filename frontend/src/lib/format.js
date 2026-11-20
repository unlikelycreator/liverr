let CURRENCY = 'INR';
export const setCurrency = (c) => { if (c) CURRENCY = c; };
export const getCurrency = () => CURRENCY;

const fmtCache = {};
export function money(n, currency = CURRENCY, { compact = false, sign = false } = {}) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const key = `${currency}|${compact}`;
  fmtCache[key] ||= new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: compact || Number.isInteger(n) ? 0 : 2,
    notation: compact && Math.abs(n) >= 10000 ? 'compact' : 'standard',
  });
  try {
    const s = fmtCache[key].format(Math.abs(n));
    return sign ? `${n < 0 ? '−' : '+'}${s}` : n < 0 ? `−${s}` : s;
  } catch {
    return `${currency} ${n}`;
  }
}

export const num = (n, d = 0) =>
  n === undefined || n === null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);

export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function shiftISO(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const asDate = (iso) => new Date(`${iso}T12:00:00`);

export function dayLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === shiftISO(t, -1)) return 'Yesterday';
  if (iso === shiftISO(t, 1)) return 'Tomorrow';
  const d = asDate(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
export const shortDate = (iso) => asDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longDate = (iso) => asDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export const weekday = (iso) => asDate(iso).toLocaleDateString('en-US', { weekday: 'narrow' });

export function relTime(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const duration = (min) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
};

export const humanize = (s = '') => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
