import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List, Star, Download, Inbox } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi, useOnChange } from '../lib/hooks.js';
import { CATEGORIES, SUBTYPES, MOOD_FACE } from '../lib/categories.js';
import { money, num, duration, humanize, dayLabel, todayISO, shiftISO, getCurrency } from '../lib/format.js';
import { RecordEditor, RecordRow } from '../components/Records.jsx';
import { CategoryIcon, Empty, PageHeader, Segmented, Skeleton, Spinner, Stat, cx } from '../components/ui.jsx';
import { ShareBars } from '../components/Charts.jsx';

const RANGES = { '30D': 30, '90D': 90, '1Y': 365, All: 0 };
const PAGE = 100;

function statsFor(cat, s, records) {
  const cur = getCurrency();
  const top = (arr) => arr[0] ? humanize(arr[0].subtype) : '—';
  const sum = s.summary;
  switch (cat) {
    case 'finance':
      return [
        { label: 'Spent', value: money(sum.expense, cur, { compact: true }), hint: `${num(s.subtypes.filter((x) => x.direction === 'expense').reduce((a, b) => a + b.count, 0))} expenses` },
        { label: 'Earned', value: money(sum.income, cur, { compact: true }), hint: `${num(s.subtypes.filter((x) => x.direction === 'income').reduce((a, b) => a + b.count, 0))} credits` },
        { label: 'Net', value: money(sum.income - sum.expense, cur, { compact: true, sign: sum.income !== sum.expense }), hint: sum.income ? `${Math.round(((sum.income - sum.expense) / sum.income) * 100)}% saved` : 'income − expenses' },
        { label: 'Daily spend', value: money(sum.expense / Math.max(1, sum.activeDays), cur, { compact: true }), hint: `avg over ${sum.activeDays} active days` },
      ];
    case 'exercise':
      return [
        { label: 'Workouts', value: num(sum.count), hint: `${sum.activeDays} active days` },
        { label: 'Time', value: duration(sum.durationMin) || '0m', hint: sum.count ? `${duration(Math.round(sum.durationMin / sum.count)) || '—'} avg` : '' },
        { label: 'Distance', value: `${num(sum.distanceKm, 1)} km`, hint: 'runs, walks, rides' },
        { label: 'Favourite', value: top(s.subtypes), hint: s.subtypes[0] ? `${s.subtypes[0].count} sessions` : '' },
      ];
    case 'media': {
      const by = (t) => s.subtypes.filter((x) => x.subtype === t).reduce((a, b) => a + b.count, 0);
      return [
        { label: 'Titles', value: num(sum.count), hint: `${sum.activeDays} days` },
        { label: 'Movies', value: num(by('movie')), hint: `${num(by('show'))} shows` },
        { label: 'Books', value: num(by('book')), hint: `${num(by('podcast') + by('music'))} audio` },
        { label: 'Avg rating', value: sum.avgRating ? `${num(sum.avgRating, 1)}/10` : '—', hint: 'when you rate' },
      ];
    }
    case 'food':
      return [
        { label: 'Meals', value: num(sum.count), hint: `${sum.activeDays} days logged` },
        { label: 'Per day', value: num(sum.count / Math.max(1, sum.activeDays), 1), hint: 'meals & drinks' },
        { label: 'Calories', value: sum.calories ? num(sum.calories) : '—', hint: 'when mentioned' },
        { label: 'Most logged', value: top(s.subtypes), hint: s.subtypes[0] ? `${s.subtypes[0].count} times` : '' },
      ];
    case 'health': {
      const latest = (t) => records.find((r) => r.subtype === t && r.value !== undefined);
      const sleeps = records.filter((r) => r.subtype === 'sleep' && r.value);
      const w = latest('weight');
      const water = records.filter((r) => r.subtype === 'water' && r.value);
      return [
        { label: 'Avg sleep', value: sleeps.length ? `${num(sleeps.reduce((a, r) => a + r.value, 0) / sleeps.length, 1)}h` : '—', hint: `${sleeps.length} nights` },
        { label: 'Weight', value: w ? `${num(w.value, 1)} kg` : '—', hint: w ? `latest · ${dayLabel(w.date)}` : 'mention “weighed 72kg”' },
        { label: 'Water', value: water.length ? `${num(water.reduce((a, r) => a + r.value, 0) / water.length, 1)} l` : '—', hint: 'avg per log' },
        { label: 'Logs', value: num(sum.count), hint: `${sum.activeDays} days` },
      ];
    }
    case 'mood': {
      const avg = sum.avgRating;
      return [
        { label: 'Average', value: avg ? `${MOOD_FACE[Math.round(avg)]} ${num(avg, 1)}` : '—', hint: 'out of 5' },
        { label: 'Check-ins', value: num(sum.count), hint: `${sum.activeDays} days` },
        { label: 'Most common', value: top(s.subtypes), hint: s.subtypes[0] ? `${s.subtypes[0].count} days` : '' },
        { label: 'Great days', value: num(s.subtypes.find((x) => x.subtype === 'great')?.count || 0), hint: 'rated 5/5' },
      ];
    }
    default: {
      const people = new Set(records.flatMap((r) => r.people || []));
      return [
        { label: 'Total', value: num(sum.count), hint: `${sum.activeDays} active days` },
        { label: 'Most common', value: top(s.subtypes), hint: s.subtypes[0] ? `${s.subtypes[0].count} times` : '' },
        cat === 'activity' ? { label: 'Time', value: duration(sum.durationMin) || '—', hint: 'when mentioned' } : { label: 'People', value: num(people.size), hint: 'distinct names' },
        { label: 'All time', value: num(s.allTime), hint: 'records' },
      ];
    }
  }
}

function MediaCard({ r, onEdit }) {
  const hue = [...r.title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <button onClick={() => onEdit(r)} className="group overflow-hidden rounded-xl border border-line bg-panel text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-line2">
      <div className="relative flex aspect-[4/3] items-end p-3" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55% / .22), hsl(${(hue + 50) % 360} 70% 50% / .08))` }}>
        <span className="absolute right-3 top-3 rounded-md bg-panel/80 px-1.5 py-0.5 text-2xs font-medium text-muted backdrop-blur">{humanize(r.subtype)}</span>
        <span className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-[-0.02em]">{r.title}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-faint">
        <span className="truncate">{[r.platform, dayLabel(r.date)].filter(Boolean).join(' · ')}</span>
        {r.rating !== undefined && <span className="num ml-auto flex items-center gap-1 text-muted"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{num(r.rating, 1)}</span>}
      </div>
    </button>
  );
}

function toCSV(records) {
  const cols = ['date', 'time', 'category', 'subtype', 'title', 'amount', 'currency', 'direction', 'merchant', 'value', 'unit', 'durationMin', 'distanceKm', 'calories', 'sets', 'reps', 'weightKg', 'rating', 'status', 'platform', 'creator', 'location', 'people', 'items', 'tags', 'notes'];
  const esc = (v) => (v === undefined || v === null ? '' : `"${(Array.isArray(v) ? v.join('; ') : String(v)).replace(/"/g, '""')}"`);
  return [cols.join(','), ...records.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export default function Category() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const meta = CATEGORIES[category];
  const [range, setRange] = useState('90D');
  const [subtype, setSubtype] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const [view, setView] = useState(category === 'media' ? 'grid' : 'list');
  const [editing, setEditing] = useState(null);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  useEffect(() => { setSubtype(''); setView(category === 'media' ? 'grid' : 'list'); setQ(params.get('q') || ''); setQuery(params.get('q') || ''); }, [category]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  const days = RANGES[range];
  const to = todayISO();
  const from = days ? shiftISO(to, -(days - 1)) : '2000-01-01';
  const stats = useApi(`/stats/category/${category}`, { from, to }, { enabled: Boolean(meta) });

  async function load(page = 1) {
    page > 1 ? setMore(true) : setLoading(true);
    try {
      const d = await api('/records', { query: { category, from, to, subtype, q: query, limit: PAGE, page } });
      setRecords((r) => (page > 1 ? [...r, ...d.records] : d.records));
      setTotal(d.total);
    } catch { /* empty state */ } finally { setLoading(false); setMore(false); }
  }
  useEffect(() => { if (meta) load(1); }, [category, from, subtype, query]); // eslint-disable-line react-hooks/exhaustive-deps
  useOnChange(() => { load(1); stats.reload(); });

  const byDay = useMemo(() => {
    const g = [];
    for (const r of records) {
      if (g.at(-1)?.date !== r.date) g.push({ date: r.date, items: [] });
      g.at(-1).items.push(r);
    }
    return g;
  }, [records]);

  if (!meta) return <Navigate to="/" replace />;
  const cards = stats.data ? statsFor(category, stats.data, records) : null;
  const subtypesUsed = stats.data?.subtypes || [];
  const breakdown = Object.values(
    subtypesUsed.filter((s) => category !== 'finance' || s.direction === 'expense').reduce((a, s) => {
      a[s.subtype] ||= { label: humanize(s.subtype), value: 0 };
      a[s.subtype].value += category === 'finance' ? s.amount : s.count;
      return a;
    }, {})
  ).sort((a, b) => b.value - a.value).slice(0, 6).map((x, i) => ({ ...x, color: `color-mix(in srgb, ${meta.color} ${100 - i * 14}%, rgb(var(--elev)))` }));

  function exportCSV() {
    const blob = new Blob([toCSV(records)], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `liverr-${category}-${todayISO()}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader
        icon={<CategoryIcon category={category} size="lg" />}
        title={meta.label}
        subtitle={meta.blurb}
        actions={
          <>
            <button className="btn-icon border border-line bg-panel" onClick={exportCSV} title="Export CSV" disabled={!records.length}><Download className="h-4 w-4" /></button>
            <button className="btn-primary" onClick={() => setEditing({ category, subtype: SUBTYPES[category][0], date: todayISO(), ...(category === 'finance' ? { direction: 'expense' } : {}) })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={range} onChange={setRange} options={Object.keys(RANGES)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards ? cards.map((c) => <Stat key={c.label} {...c} accent={meta.color} />) : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />)}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input className="input h-8 pl-8" placeholder={`Search ${meta.label.toLowerCase()}…`} value={q} onChange={(e) => { setQ(e.target.value); if (params.get('q')) setParams({}); }} />
            </div>
            {category === 'media' && (
              <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: <LayoutGrid className="h-3.5 w-3.5" /> }, { value: 'list', label: <List className="h-3.5 w-3.5" /> }]} />
            )}
          </div>
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {['', ...SUBTYPES[category]].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setSubtype(s)}
                className={cx('h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors', subtype === s ? 'border-fg bg-fg text-bg' : 'border-line bg-panel text-muted hover:text-fg')}
              >
                {s ? humanize(s) : 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : !records.length ? (
            <div className="card">
              <Empty icon={Inbox} title={`No ${meta.label.toLowerCase()} yet`}>
                {query || subtype ? 'Nothing matches these filters.' : 'Write about it in your journal and it will show up here automatically.'}
              </Empty>
            </div>
          ) : view === 'grid' && category === 'media' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{records.map((r) => <MediaCard key={r._id} r={r} onEdit={setEditing} />)}</div>
          ) : (
            <div className="card overflow-hidden">
              {byDay.map((g) => {
                const net = category === 'finance' ? g.items.reduce((a, r) => a + (r.direction === 'income' ? r.amount : -r.amount), 0) : null;
                return (
                  <div key={g.date} className="border-b border-line last:border-0">
                    <div className="flex items-center justify-between bg-bg/50 px-4 py-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-faint">
                      <span>{dayLabel(g.date)}</span>
                      {net !== null && <span className={cx('num normal-case tracking-normal', net > 0 && 'text-emerald-500')}>{money(net, getCurrency(), { sign: true })}</span>}
                    </div>
                    {g.items.map((r) => <RecordRow key={r._id} r={r} onEdit={setEditing} />)}
                  </div>
                );
              })}
            </div>
          )}
          {records.length < total && (
            <div className="mt-4 flex justify-center">
              <button className="btn-outline" disabled={more} onClick={() => load(Math.floor(records.length / PAGE) + 1)}>{more && <Spinner className="h-3.5 w-3.5" />} Load more</button>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="card p-4">
            <div className="mb-3 text-[13px] font-semibold">{category === 'finance' ? 'Spending by type' : 'Breakdown'}</div>
            {breakdown.length ? (
              <ShareBars items={breakdown} format={(v) => (category === 'finance' ? money(v, getCurrency(), { compact: true }) : num(v))} />
            ) : (
              <div className="text-[13px] text-faint">No data in this range.</div>
            )}
          </div>
          <div className="card p-4 text-[13px] text-muted">
            <div className="mb-1 font-medium text-fg">Tip</div>
            {{
              finance: '“Paid ₹250 for an Uber to the office” or “got 40k salary” is all it takes.',
              food: '“Poha and chai for breakfast, paneer wrap for lunch” logs two meals.',
              media: 'Add ratings like “8/10” and platforms like “on Netflix”.',
              exercise: '“5 km run in 28 min” or “leg day, squats 4x10 at 60kg”.',
              health: '“Slept 7 hours”, “8 glasses of water”, “weighed 72 kg”.',
              mood: 'Say how you felt: “feeling calm but a bit tired”.',
            }[category] || 'Just write naturally — Liverr picks it up.'}
          </div>
        </aside>
      </div>

      <RecordEditor open={Boolean(editing)} record={editing?._id ? editing : null} defaults={editing?._id ? undefined : editing} onClose={() => setEditing(null)} />
    </div>
  );
}
