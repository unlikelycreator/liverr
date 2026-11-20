import { useEffect, useState } from 'react';
import { Star, Trash2, Pencil } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS, FIELDS, FIELD_META, SUBTYPES, MOOD_FACE } from '../lib/categories.js';
import { money, duration, humanize, num, todayISO, dayLabel } from '../lib/format.js';
import { api } from '../lib/api.js';
import { emitChange } from '../lib/hooks.js';
import { CategoryIcon, Modal, Spinner, cx, useToast } from './ui.jsx';

/** Short, category-aware description bits for a record. */
export function recordBits(r) {
  const bits = [];
  const add = (v) => v && bits.push(v);
  switch (r.category) {
    case 'finance': add(humanize(r.subtype)); add(r.merchant && r.merchant !== r.title && r.merchant); break;
    case 'food': add(humanize(r.subtype)); add(r.calories && `${num(r.calories)} kcal`); add(r.location); break;
    case 'media': add(humanize(r.subtype)); add(r.platform); add(r.creator); add(r.status && r.status !== 'finished' && humanize(r.status)); break;
    case 'exercise': add(humanize(r.subtype)); add(r.sets && `${r.sets}×${r.reps || '?'}${r.weightKg ? ` @ ${r.weightKg} kg` : ''}`); add(r.items?.length && r.items.join(', ')); break;
    case 'health': add(humanize(r.subtype)); break;
    case 'mood': add(r.tags?.filter((t) => t.toLowerCase() !== r.title.toLowerCase()).join(', ')); break;
    case 'social': add(humanize(r.subtype)); add(r.location); break;
    default: add(humanize(r.subtype)); add(r.location);
  }
  if (r.people?.length && r.category !== 'social') add(r.people.join(', '));
  return bits;
}

export function RecordValue({ r }) {
  if (r.category === 'finance')
    return <span className={cx('num font-medium', r.direction === 'income' ? 'text-emerald-500' : 'text-fg')}>{money(r.direction === 'income' ? r.amount : -r.amount, r.currency, { sign: true })}</span>;
  if (r.category === 'exercise') {
    const parts = [r.distanceKm && `${num(r.distanceKm, 2)} km`, r.durationMin && duration(r.durationMin)].filter(Boolean);
    return parts.length ? <span className="num text-muted">{parts.join(' · ')}</span> : null;
  }
  if (r.category === 'health' && r.value !== undefined) return <span className="num text-muted">{num(r.value, 2)} {r.unit}</span>;
  if (r.category === 'mood' && r.rating) return <span className="text-base leading-none">{MOOD_FACE[r.rating]}</span>;
  if (r.category === 'media' && r.rating !== undefined)
    return <span className="num inline-flex items-center gap-1 text-muted"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{num(r.rating, 1)}</span>;
  if (r.durationMin) return <span className="num text-muted">{duration(r.durationMin)}</span>;
  return null;
}

export function RecordRow({ r, onEdit, showDate, compact }) {
  const bits = recordBits(r);
  return (
    <div className={cx('group flex items-center gap-3 px-4 transition-colors hover:bg-elev/50', compact ? 'py-2' : 'py-2.5')}>
      <CategoryIcon category={r.category} size="sm" />
      <button className="min-w-0 flex-1 text-left" onClick={() => onEdit?.(r)}>
        <div className="truncate text-[13px] font-medium">{r.title}</div>
        {bits.length > 0 && <div className="truncate text-xs text-faint">{bits.join(' · ')}</div>}
      </button>
      {showDate && <span className="hidden shrink-0 text-xs text-faint sm:block">{dayLabel(r.date)}</span>}
      <span className="shrink-0 text-[13px]"><RecordValue r={r} /></span>
      {onEdit && (
        <button className="btn-icon h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => onEdit(r)} aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const toForm = (r) => {
  const f = { ...r };
  for (const k of ['items', 'tags', 'people']) if (Array.isArray(f[k])) f[k] = f[k].join(', ');
  return f;
};
const fromForm = (f) => {
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (['_id', 'createdAt', 'updatedAt', '__v', 'entry', 'source'].includes(k)) continue;
    const meta = FIELD_META[k];
    if (meta?.type === 'list') out[k] = String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (meta?.type === 'number') { if (v !== '' && v !== null && v !== undefined) out[k] = Number(v); }
    else if (v !== '' && v !== null && v !== undefined) out[k] = v;
  }
  return out;
};

/** Create or edit a record. Pass record=null + defaults to create. */
export function RecordEditor({ open, record, defaults, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !record?._id;
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF(toForm(record || { category: 'finance', date: todayISO(), direction: 'expense', ...defaults }));
  }, [open, record, defaults]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const cat = f.category || 'note';

  async function save(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = fromForm(f);
      const res = isNew ? await api('/records', { method: 'POST', body }) : await api(`/records/${record._id}`, { method: 'PATCH', body });
      toast(isNew ? 'Record added' : 'Saved');
      emitChange();
      onSaved?.(res.record);
      onClose();
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm('Delete this record?')) return;
    setBusy(true);
    try {
      await api(`/records/${record._id}`, { method: 'DELETE' });
      toast('Deleted');
      emitChange();
      onSaved?.(null);
      onClose();
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const fields = FIELDS[cat] || [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? `New ${CATEGORIES[cat]?.noun || 'record'}` : 'Edit record'}
      footer={
        <>
          {!isNew && (
            <button className="btn-ghost mr-auto text-rose-500 hover:text-rose-500" onClick={remove} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !f.title}>
            {busy && <Spinner className="h-3.5 w-3.5" />} {isNew ? 'Add' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={cat} onChange={(e) => setF((p) => ({ ...p, category: e.target.value, subtype: SUBTYPES[e.target.value][0] }))}>
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={f.subtype || ''} onChange={set('subtype')}>
              {(SUBTYPES[cat] || []).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" autoFocus={isNew} value={f.title || ''} onChange={set('title')} placeholder="What was it?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={f.date || ''} onChange={set('date')} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input" value={f.time || ''} onChange={set('time')} />
          </div>
        </div>
        {fields.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {fields.map((k) => {
              const m = FIELD_META[k];
              return (
                <div key={k} className={m.type === 'list' ? 'col-span-2' : ''}>
                  <label className="label">{m.label}</label>
                  {m.type === 'select' ? (
                    <select className="input" value={f[k] || ''} onChange={set(k)}>
                      <option value="">—</option>
                      {m.options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
                    </select>
                  ) : (
                    <input
                      className="input num"
                      type={m.type === 'number' ? 'number' : 'text'}
                      step="any"
                      value={f[k] ?? ''}
                      onChange={set(k)}
                      placeholder={m.type === 'list' ? 'Comma separated' : ''}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[72px] resize-y py-2" value={f.notes || ''} onChange={set('notes')} />
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** Records grouped under category headers, in canonical category order. */
export function GroupedRecords({ records, onEdit, animate }) {
  const groups = CATEGORY_KEYS.map((k) => [k, records.filter((r) => r.category === k)]).filter(([, rs]) => rs.length);
  return (
    <div className="divide-y divide-line">
      {groups.map(([k, rs], gi) => (
        <div key={k} className={animate ? 'animate-in' : ''} style={animate ? { animationDelay: `${gi * 60}ms` } : undefined}>
          <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-2xs font-medium uppercase tracking-[0.08em] text-faint">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORIES[k].color }} />
            {CATEGORIES[k].label}
            <span className="num">{rs.length}</span>
          </div>
          <div className="pb-1.5">{rs.map((r) => <RecordRow key={r._id} r={r} onEdit={onEdit} compact />)}</div>
        </div>
      ))}
    </div>
  );
}
