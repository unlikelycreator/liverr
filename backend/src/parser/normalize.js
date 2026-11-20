import { CATEGORIES } from '../categories.js';
import { config } from '../config.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

const num = (v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};
const str = (v, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const arr = (v) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].slice(0, 30) : undefined;

export const titleCase = (s) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Coerce an untrusted record (from Gemini, rules or a client) into a safe shape. Returns null if unusable. */
export function normalizeRecord(raw, fallbackDate) {
  if (!raw || typeof raw !== 'object') return null;
  const category = String(raw.category || '').toLowerCase().trim();
  const def = CATEGORIES[category];
  if (!def) return null;

  let subtype = String(raw.subtype || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (!def.subtypes.includes(subtype)) subtype = def.subtypes.includes('other') ? 'other' : def.subtypes[0];

  const title = str(raw.title) || str(raw.notes, 80);
  if (!title) return null;

  const out = {
    category,
    subtype,
    title,
    notes: str(raw.notes, 2000) || '',
    date: DATE_RE.test(raw.date || '') ? raw.date : fallbackDate,
    time: TIME_RE.test(raw.time || '') ? raw.time.padStart(5, '0') : '',
    amount: num(raw.amount),
    currency: str(raw.currency, 8)?.toUpperCase(),
    direction: ['income', 'expense'].includes(raw.direction) ? raw.direction : null,
    merchant: str(raw.merchant),
    value: num(raw.value),
    unit: str(raw.unit, 20),
    durationMin: num(raw.durationMin),
    distanceKm: num(raw.distanceKm),
    calories: num(raw.calories),
    sets: num(raw.sets),
    reps: num(raw.reps),
    weightKg: num(raw.weightKg),
    rating: num(raw.rating),
    status: str(raw.status, 30),
    creator: str(raw.creator),
    platform: str(raw.platform, 60),
    items: arr(raw.items),
    people: arr(raw.people),
    location: str(raw.location),
    tags: arr(raw.tags),
  };

  // Models often fill unused numeric fields with 0; a zero measurement carries no information.
  for (const k of ['value', 'durationMin', 'distanceKm', 'calories', 'sets', 'reps', 'weightKg']) if (out[k] === 0) delete out[k];
  if (out.items) out.items = out.items.map((x) => (/^[a-z]/.test(x) ? titleCase(x) : x));
  if (category === 'health' && out.value !== undefined && !out.unit)
    out.unit = { sleep: 'h', weight: 'kg', water: 'l', steps: 'steps' }[subtype];

  if (category === 'finance') {
    if (out.amount === undefined) return null;
    out.amount = Math.abs(out.amount);
    out.direction = out.direction || 'expense';
    out.currency = out.currency || config.currency;
  }
  if (category === 'mood' && out.rating !== undefined) out.rating = Math.min(5, Math.max(1, Math.round(out.rating)));
  if (out.rating !== undefined) out.rating = Math.min(10, Math.max(0, out.rating));

  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}
