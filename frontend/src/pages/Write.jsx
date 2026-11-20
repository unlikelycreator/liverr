import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, CornerDownLeft, Calendar, Undo2, ArrowRight, Plus, CircleAlert } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi, useOnChange, emitChange } from '../lib/hooks.js';
import { greeting, longDate, todayISO, shiftISO, money, duration, num, dayLabel } from '../lib/format.js';
import { useApp } from '../App.jsx';
import { GroupedRecords, RecordEditor } from '../components/Records.jsx';
import { Empty, Segmented, Skeleton, Spinner, cx, useToast } from '../components/ui.jsx';

const DRAFT_KEY = 'liverr.draft';
const EXAMPLES = [
  'Slept 7 hours. Had poha and chai for breakfast, then a 5 km run in 28 minutes.',
  'Lunch with Riya at Blue Tokai, paid ₹640. Finished watching The Bear on Hotstar — 9/10.',
  'Got paid 12k for the freelance logo. Spent 1.2k on groceries at BigBasket. Feeling really productive.',
];
const STEPS = ['Reading your entry', 'Finding meals, money and moments', 'Sorting into collections'];

function useAutosize(ref, value) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.max(el.scrollHeight, 168)}px`;
  }, [ref, value]);
}

function DaySummary({ records }) {
  const { health } = useApp();
  const s = useMemo(() => {
    const spent = records.filter((r) => r.category === 'finance' && r.direction === 'expense').reduce((a, r) => a + r.amount, 0);
    const earned = records.filter((r) => r.category === 'finance' && r.direction === 'income').reduce((a, r) => a + r.amount, 0);
    const meals = records.filter((r) => r.category === 'food').length;
    const workout = records.filter((r) => r.category === 'exercise').reduce((a, r) => a + (r.durationMin || 0), 0);
    const workouts = records.filter((r) => r.category === 'exercise').length;
    const sleep = records.find((r) => r.category === 'health' && r.subtype === 'sleep' && r.value)?.value;
    return { spent, earned, meals, workout, workouts, sleep };
  }, [records]);
  const cells = [
    { label: 'Spent', value: money(s.spent, health?.currency), sub: s.earned ? `+${money(s.earned, health?.currency)} in` : null, color: '#10b981' },
    { label: 'Meals', value: num(s.meals), color: '#f97316' },
    { label: 'Exercise', value: s.workout ? duration(s.workout) : num(s.workouts), sub: s.workout ? `${s.workouts} session${s.workouts === 1 ? '' : 's'}` : null, color: '#0ea5e9' },
    { label: 'Sleep', value: s.sleep ? `${num(s.sleep, 1)}h` : '—', color: '#f43f5e' },
  ];
  return (
    <div className="grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-panel shadow-card sm:grid-cols-4 sm:divide-x [&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-b-0 [&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-r-0">
      {cells.map((c) => (
        <div key={c.label} className="border-line p-4">
          <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-faint">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.label}
          </div>
          <div className="num mt-1.5 text-lg font-semibold tracking-[-0.01em]">{c.value}</div>
          <div className="h-4 text-xs text-faint">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

export default function Write() {
  const toast = useToast();
  const { health } = useApp();
  const [text, setText] = useState(() => { try { return localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; } });
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(null);
  const ta = useRef();
  const dateInput = useRef();
  useAutosize(ta, text);

  const day = useApi('/records', { from: date, to: date, limit: 200 });
  useOnChange(day.reload);

  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, text); } catch { /* ignore */ } }, [text]);
  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, [busy]);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await api('/entries', { method: 'POST', body: { text, date } });
      setResult(res);
      setText('');
      emitChange();
      if (res.warning) toast(res.warning, { type: 'error' });
      else toast(`Logged ${res.records.length} record${res.records.length === 1 ? '' : 's'}`);
    } catch (e) {
      toast(e.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!result) return;
    try {
      await api(`/entries/${result.entry._id}`, { method: 'DELETE' });
      setText(result.entry.text);
      setResult(null);
      emitChange();
      toast('Entry removed — it’s back in the editor');
    } catch (e) { toast(e.message, { type: 'error' }); }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isToday = date === todayISO();
  const isYesterday = date === shiftISO(todayISO(), -1);
  const dayRecords = day.data?.records || [];

  return (
    <div>
      <div className="mb-7">
        <div className="text-[13px] text-faint">{longDate(todayISO())}</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.025em]">{greeting()}.</h1>
        <p className="mt-1 text-[14px] text-muted">Write about your day in your own words — Liverr sorts it into your logs.</p>
      </div>

      {/* Composer */}
      <div className={cx('card relative overflow-hidden transition-shadow focus-within:shadow-[0_0_0_1px_rgb(var(--accent)/.5),0_0_0_4px_rgb(var(--accent)/.12)]', busy && 'pointer-events-none')}>
        <textarea
          ref={ta}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder={'Woke up at 7, slept about 6 hours. Had oats for breakfast…\n\nWhat did you eat, watch, spend, do, feel?'}
          className="block w-full resize-none bg-transparent px-5 pb-3 pt-5 text-[15px] leading-[1.7] outline-none placeholder:text-faint"
          disabled={busy}
          autoFocus
        />
        {!text && !busy && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-3">
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => { setText(ex); ta.current?.focus(); }} className="chip max-w-full truncate transition-colors hover:border-line2 hover:text-fg">
                <Plus className="h-3 w-3 shrink-0" /><span className="truncate">{ex.split('.')[0]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-bg/40 px-3 py-2.5">
          <Segmented
            value={isToday ? 't' : isYesterday ? 'y' : 'c'}
            onChange={(v) => (v === 't' ? setDate(todayISO()) : v === 'y' ? setDate(shiftISO(todayISO(), -1)) : dateInput.current?.showPicker?.())}
            options={[{ value: 't', label: 'Today' }, { value: 'y', label: 'Yesterday' }, { value: 'c', label: !isToday && !isYesterday ? dayLabel(date) : <Calendar className="h-3.5 w-3.5" /> }]}
          />
          <input ref={dateInput} type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} className="pointer-events-none absolute h-0 w-0 opacity-0" tabIndex={-1} />
          <div className="ml-auto flex items-center gap-3">
            <span className="num hidden text-xs text-faint sm:inline">{words ? `${words} word${words === 1 ? '' : 's'}` : ''}</span>
            <span className="hidden items-center gap-1 text-xs text-faint md:flex"><span className="kbd">⌘</span><span className="kbd"><CornerDownLeft className="h-2.5 w-2.5" /></span></span>
            <button onClick={submit} disabled={!text.trim() || busy} className="btn-accent h-8 px-3.5">
              {busy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? 'Logging…' : 'Log entry'}
            </button>
          </div>
        </div>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel/70 backdrop-blur-[3px] animate-fade">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-9 w-9">
                <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg"><Sparkles className="h-4 w-4" /></div>
              </div>
              <div key={step} className="text-[13px] font-medium animate-in">{STEPS[step]}…</div>
              <div className="text-xs text-faint">{health?.ai ? 'Using AI extraction' : 'Using offline extraction'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="card mt-4 overflow-hidden animate-in">
          <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"><Sparkles className="h-3.5 w-3.5" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">
                {result.records.length ? `Extracted ${result.records.length} record${result.records.length === 1 ? '' : 's'}` : 'Saved to your journal'}
                <span className="ml-2 text-xs font-normal text-faint">{dayLabel(result.entry.date)} · {result.entry.parser === 'gemini' ? 'AI' : 'offline'}</span>
              </div>
              {result.entry.summary && <div className="mt-0.5 text-[13px] text-muted">{result.entry.summary}</div>}
              {result.warning && <div className="mt-1 flex items-center gap-1 text-xs text-amber-500"><CircleAlert className="h-3 w-3" />{result.warning}</div>}
            </div>
            <button className="btn-ghost h-7 px-2 text-xs" onClick={undo}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
          </div>
          {result.records.length ? (
            <GroupedRecords records={result.records} onEdit={setEditing} animate />
          ) : (
            <div className="px-4 py-5 text-[13px] text-muted">Nothing trackable found — try mentioning what you ate, spent, watched or did. You can also add records by hand.</div>
          )}
        </div>
      )}

      {/* Day */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{isToday ? 'Today so far' : dayLabel(date)}</h2>
          <button className="btn-ghost h-7 px-2 text-xs" onClick={() => setEditing({ date, category: 'finance', direction: 'expense' })}><Plus className="h-3.5 w-3.5" /> Add manually</button>
        </div>
        <DaySummary records={dayRecords} />
        <div className="card mt-3 overflow-hidden">
          {day.loading && !day.data ? (
            <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : dayRecords.length ? (
            <GroupedRecords records={dayRecords} onEdit={setEditing} />
          ) : (
            <Empty icon={Sparkles} title="Nothing logged yet">Your first entry of the day will appear here, already sorted.</Empty>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Link to="/overview" className="btn-ghost text-xs">See overview <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>

      <RecordEditor
        open={Boolean(editing)}
        record={editing?._id ? editing : null}
        defaults={editing?._id ? undefined : editing}
        onClose={() => setEditing(null)}
        onSaved={(rec) => {
          if (!result) return;
          setResult((r) => ({ ...r, records: rec ? r.records.map((x) => (x._id === rec._id ? rec : x)) : r.records.filter((x) => x._id !== editing._id) }));
        }}
      />
    </div>
  );
}
