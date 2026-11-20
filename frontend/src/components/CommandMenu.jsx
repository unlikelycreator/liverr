import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, PenLine, LayoutGrid, BookOpen, CornerDownLeft, Sun } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS } from '../lib/categories.js';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { RecordValue, recordBits } from './Records.jsx';
import { CategoryIcon, Dot, Spinner, cx } from './ui.jsx';
import { dayLabel } from '../lib/format.js';

export function CommandMenu({ open, onClose }) {
  const nav = useNavigate();
  const { toggleTheme } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef();
  const listRef = useRef();

  useEffect(() => {
    if (open) { setQ(''); setResults([]); setIdx(0); }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults([]); return; }
    const c = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const d = await api('/records', { query: { q: q.trim(), limit: 12 }, signal: c.signal });
        setResults(d.records);
      } catch { /* ignore */ } finally { if (!c.signal.aborted) setBusy(false); }
    }, 160);
    return () => { clearTimeout(t); c.abort(); };
  }, [q, open]);

  const commands = useMemo(() => {
    const base = [
      { id: 'write', label: 'Write a journal entry', icon: PenLine, run: () => nav('/') },
      { id: 'overview', label: 'Overview', icon: LayoutGrid, run: () => nav('/overview') },
      { id: 'journal', label: 'Journal history', icon: BookOpen, run: () => nav('/journal') },
      ...CATEGORY_KEYS.map((k) => ({ id: k, label: CATEGORIES[k].label, color: CATEGORIES[k].color, run: () => nav(`/c/${k}`) })),
      { id: 'theme', label: 'Toggle theme', icon: Sun, run: toggleTheme },
    ];
    const s = q.trim().toLowerCase();
    return s ? base.filter((c) => c.label.toLowerCase().includes(s)) : base;
  }, [q, nav, toggleTheme]);

  const items = [
    ...commands.map((c) => ({ type: 'cmd', ...c })),
    ...results.map((r) => ({ type: 'rec', id: r._id, r, run: () => nav(`/c/${r.category}?q=${encodeURIComponent(r.title)}`) })),
  ];
  useEffect(() => setIdx(0), [q, results.length]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;
  const run = (it) => { onClose(); it.run(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && items[idx]) { e.preventDefault(); run(items[idx]); }
    else if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-panel shadow-pop animate-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          {busy ? <Spinner className="h-4 w-4 text-faint" /> : <Search className="h-4 w-4 text-faint" />}
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search everything you’ve logged…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
          <span className="kbd">esc</span>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {commands.length > 0 && <div className="px-2.5 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.08em] text-faint">Go to</div>}
          {items.map((it, i) => {
            const active = i === idx;
            const header = it.type === 'rec' && i === commands.length;
            return (
              <div key={`${it.type}-${it.id}`}>
                {header && <div className="px-2.5 pb-1 pt-3 text-2xs font-medium uppercase tracking-[0.08em] text-faint">Records</div>}
                <button
                  data-i={i}
                  onMouseMove={() => setIdx(i)}
                  onClick={() => run(it)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px]', active && 'bg-elev')}
                >
                  {it.type === 'cmd' ? (
                    <>
                      <span className="flex h-6 w-6 items-center justify-center text-muted">
                        {it.color ? <Dot color={it.color} className="h-2 w-2" /> : <it.icon className="h-4 w-4" />}
                      </span>
                      <span className="flex-1">{it.label}</span>
                    </>
                  ) : (
                    <>
                      <CategoryIcon category={it.r.category} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{it.r.title}</span>
                        <span className="block truncate text-xs text-faint">{[dayLabel(it.r.date), ...recordBits(it.r)].join(' · ')}</span>
                      </span>
                      <RecordValue r={it.r} />
                    </>
                  )}
                  {active && <CornerDownLeft className="h-3.5 w-3.5 text-faint" />}
                </button>
              </div>
            );
          })}
          {!items.length && !busy && <div className="px-3 py-10 text-center text-[13px] text-faint">No results for “{q}”</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}
