import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Trash2, Pencil, RefreshCw, ChevronLeft, X, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi, useOnChange, emitChange } from '../lib/hooks.js';
import { dayLabel, longDate, relTime } from '../lib/format.js';
import { MOOD_FACE } from '../lib/categories.js';
import { GroupedRecords, RecordEditor } from '../components/Records.jsx';
import { Empty, PageHeader, Skeleton, Spinner, cx, useToast } from '../components/ui.jsx';

const PAGE = 20;

function EntryDetail({ id, onDeleted }) {
  const toast = useToast();
  const { data, loading, reload, setData } = useApi(`/entries/${id}`);
  const [editText, setEditText] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  useOnChange(reload);

  async function save() {
    setBusy(true);
    try {
      const res = await api(`/entries/${id}`, { method: 'PUT', body: { text: editText } });
      setData(res);
      setEditText(null);
      emitChange();
      toast(`Re-analyzed · ${res.records.length} records`);
    } catch (e) { toast(e.message, { type: 'error' }); } finally { setBusy(false); }
  }
  async function reparse() {
    setBusy(true);
    try {
      const res = await api(`/entries/${id}`, { method: 'PUT', body: {} });
      setData(res);
      emitChange();
      toast(`Re-analyzed · ${res.records.length} records`);
    } catch (e) { toast(e.message, { type: 'error' }); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm('Delete this entry and all records extracted from it?')) return;
    try {
      await api(`/entries/${id}`, { method: 'DELETE' });
      emitChange();
      toast('Entry deleted');
      onDeleted();
    } catch (e) { toast(e.message, { type: 'error' }); }
  }

  if (loading && !data) return <div className="space-y-3 p-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-32" /><Skeleton className="h-48" /></div>;
  if (!data) return <Empty icon={BookOpen} title="Entry not found" />;
  const { entry, records } = data;
  return (
    <div className="animate-in">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.01em]">{longDate(entry.date)}</div>
          <div className="mt-0.5 text-xs text-faint">Written {relTime(entry.createdAt)} · {entry.parser === 'gemini' ? 'AI extraction' : 'Offline extraction'}</div>
        </div>
        <div className="flex items-center gap-0.5">
          <button className="btn-icon" title="Re-analyze" onClick={reparse} disabled={busy}>{busy ? <Spinner /> : <RefreshCw className="h-4 w-4" />}</button>
          <button className="btn-icon" title="Edit text" onClick={() => setEditText(entry.text)}><Pencil className="h-4 w-4" /></button>
          <button className="btn-icon hover:text-rose-500" title="Delete" onClick={remove}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="px-5 py-4">
        {editText !== null ? (
          <div>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="input min-h-[180px] resize-y py-3 text-[14px] leading-relaxed" autoFocus />
            <div className="mt-2 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditText(null)}>Cancel</button>
              <button className="btn-accent" onClick={save} disabled={busy || !editText.trim()}>{busy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} Save & re-analyze</button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[14px] leading-[1.75] text-fg/90">{entry.text}</p>
        )}
        {entry.summary && (
          <div className="mt-4 rounded-lg border border-line bg-elev/50 px-3.5 py-2.5 text-[13px] text-muted">
            {entry.mood && <span className="mr-1.5">{MOOD_FACE[entry.mood]}</span>}{entry.summary}
          </div>
        )}
      </div>
      <div className="border-t border-line">
        <div className="px-5 pt-4 text-[13px] font-semibold">Extracted <span className="num ml-1 font-normal text-faint">{records.length}</span></div>
        {records.length ? <GroupedRecords records={records} onEdit={setEditing} /> : <div className="px-5 py-4 text-[13px] text-muted">Nothing was extracted from this entry.</div>}
        <div className="h-3" />
      </div>
      <RecordEditor open={Boolean(editing)} record={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export default function Journal() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || '';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  async function load(skip = 0) {
    skip ? setMore(true) : setLoading(true);
    try {
      const d = await api('/entries', { query: { limit: PAGE, skip, q: query, date } });
      setEntries((e) => (skip ? [...e, ...d.entries] : d.entries));
      setTotal(d.total);
    } catch { /* surfaced by empty state */ } finally { setLoading(false); setMore(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(0); }, [query, date]);
  useOnChange(() => load(0));

  // Group entries by month.
  const groups = [];
  for (const e of entries) {
    const m = new Date(`${e.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (groups.at(-1)?.month !== m) groups.push({ month: m, items: [] });
    groups.at(-1).items.push(e);
  }

  const list = (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
        <input className="input pl-8" placeholder="Search your journal…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {date && (
        <div className="mb-3 flex items-center gap-2">
          <span className="chip">{dayLabel(date)}<button onClick={() => setParams({})} aria-label="Clear date"><X className="h-3 w-3" /></button></span>
        </div>
      )}
      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !entries.length ? (
        <div className="card">
          <Empty icon={BookOpen} title={query || date ? 'No matching entries' : 'Your journal is empty'} action={!query && !date && <Link to="/" className="btn-primary">Write your first entry</Link>}>
            {query || date ? 'Try a different search.' : 'Every entry you write lives here, with everything Liverr pulled out of it.'}
          </Empty>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.month}>
              <div className="mb-2 px-1 text-2xs font-medium uppercase tracking-[0.08em] text-faint">{g.month}</div>
              <div className="card divide-y divide-line overflow-hidden">
                {g.items.map((e) => (
                  <Link key={e._id} to={`/journal/${e._id}${date ? `?date=${date}` : ''}`} className={cx('block px-4 py-3.5 transition-colors hover:bg-elev/50', id === e._id && 'bg-elev/70')}>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{dayLabel(e.date)}</span>
                      {e.mood && <span className="text-xs">{MOOD_FACE[e.mood]}</span>}
                      <span className="num ml-auto text-2xs text-faint">{e.recordCount} records</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{e.text}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {entries.length < total && (
            <div className="flex justify-center"><button className="btn-outline" onClick={() => load(entries.length)} disabled={more}>{more && <Spinner className="h-3.5 w-3.5" />} Load more</button></div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="Journal" subtitle={total ? `${total} entr${total === 1 ? 'y' : 'ies'}` : 'Your entries, in your words.'} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className={cx(id && 'hidden lg:block')}>{list}</div>
        <div className={cx(!id && 'hidden lg:block')}>
          {id ? (
            <div className="lg:sticky lg:top-10">
              <button className="btn-ghost mb-3 -ml-2 lg:hidden" onClick={() => nav(`/journal${date ? `?date=${date}` : ''}`)}><ChevronLeft className="h-4 w-4" /> All entries</button>
              <div className="card overflow-hidden"><EntryDetail key={id} id={id} onDeleted={() => nav('/journal')} /></div>
            </div>
          ) : (
            <div className="card flex h-[320px] items-center justify-center border-dashed bg-transparent shadow-none">
              <div className="text-center text-[13px] text-faint">Select an entry to see what was extracted.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
