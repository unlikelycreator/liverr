import { useEffect, useMemo, useRef, useState } from 'react';
import { shortDate, todayISO, shiftISO, longDate } from '../lib/format.js';
import { cx } from './ui.jsx';

/** Minimal bar chart. data: [{ date, value }], formatter for tooltip. */
export function Bars({ data, color = 'rgb(var(--accent))', height = 140, format = (v) => v, negative }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.value || 0, negative ? d.neg || 0 : 0)));
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative select-none">
      <div className="mb-3 flex h-5 items-baseline gap-2 text-xs">
        {h ? (
          <>
            <span className="num font-medium text-fg">{format(h.value)}</span>
            {negative && h.neg ? <span className="num text-muted">/ {format(h.neg)}</span> : null}
            <span className="text-faint">{shortDate(h.date)}</span>
          </>
        ) : (
          <span className="text-faint">Hover a bar</span>
        )}
      </div>
      <div className="flex items-end gap-[3px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.date} className="group flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)}>
            <div
              className="w-full rounded-[3px] transition-opacity"
              style={{
                height: `${Math.max((d.value / max) * 100, d.value ? 3 : 0)}%`,
                background: color,
                opacity: hover === null || hover === i ? 1 : 0.35,
              }}
            />
            {negative && (
              <div className="mt-[2px] w-full rounded-[3px]" style={{ height: `${((d.neg || 0) / max) * 40}%`, background: negative, opacity: hover === null || hover === i ? 0.9 : 0.3 }} />
            )}
            {!d.value && !(negative && d.neg) && <div className="h-[2px] w-full rounded bg-line" />}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-2xs text-faint">
        <span>{data[0] && shortDate(data[0].date)}</span>
        <span>{data.at(-1) && shortDate(data.at(-1).date)}</span>
      </div>
    </div>
  );
}

/** Smooth line chart for values with gaps (sleep, mood, weight). */
export function Line({ data, color = 'rgb(var(--accent))', height = 120, format = (v) => v, min: minV, max: maxV }) {
  const [hover, setHover] = useState(null);
  const pts = data.map((d, i) => ({ ...d, i })).filter((d) => d.value !== null && d.value !== undefined);
  const W = 600;
  const vals = pts.map((p) => p.value);
  const min = minV ?? Math.min(...vals, Infinity);
  const max = maxV ?? Math.max(...vals, -Infinity);
  const span = max - min || 1;
  const x = (i) => (data.length <= 1 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v) => height - 8 - ((v - min) / span) * (height - 16);
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="select-none">
      <div className="mb-3 flex h-5 items-baseline gap-2 text-xs">
        {h ? (
          <>
            <span className="num font-medium">{h.value === null || h.value === undefined ? 'No data' : format(h.value)}</span>
            <span className="text-faint">{shortDate(h.date)}</span>
          </>
        ) : pts.length ? (
          <span className="text-faint">Avg <span className="num text-muted">{format(Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10)}</span></span>
        ) : (
          <span className="text-faint">No data yet</span>
        )}
      </div>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1="0" x2={W} y1={height * t} y2={height * t} stroke="rgb(var(--line))" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          ))}
          {pts.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        {pts.map((p) => (
          <span
            key={p.date}
            className={cx('absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel transition-transform', hover === p.i && 'scale-150')}
            style={{ left: `${(x(p.i) / W) * 100}%`, top: y(p.value), background: color }}
          />
        ))}
        <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => <div key={d.date} className="h-full flex-1" onMouseEnter={() => setHover(i)} />)}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-2xs text-faint">
        <span>{data[0] && shortDate(data[0].date)}</span>
        <span>{data.at(-1) && shortDate(data.at(-1).date)}</span>
      </div>
    </div>
  );
}

/** GitHub-style year heatmap. counts: { 'YYYY-MM-DD': n } */
export function Heatmap({ counts = {}, weeks = 53, onPick }) {
  const [hover, setHover] = useState(null);
  const scroller = useRef();
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, []);
  const cols = useMemo(() => {
    const end = todayISO();
    const endDay = new Date(`${end}T12:00:00`).getDay(); // 0 = Sun
    let start = shiftISO(end, -(weeks * 7 - 1) - (6 - endDay));
    const out = [];
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        col.push(start <= end ? start : null);
        start = shiftISO(start, 1);
      }
      out.push(col);
    }
    return out;
  }, [weeks]);
  const max = Math.max(4, ...Object.values(counts));
  const level = (n) => (!n ? 0 : n <= max * 0.25 ? 1 : n <= max * 0.5 ? 2 : n <= max * 0.75 ? 3 : 4);
  const shade = ['rgb(var(--elev))', 'rgb(var(--accent) / .28)', 'rgb(var(--accent) / .5)', 'rgb(var(--accent) / .75)', 'rgb(var(--accent))'];
  const months = cols.map((c, i) => {
    const first = c.find(Boolean);
    if (!first) return null;
    const m = new Date(`${first}T12:00:00`).toLocaleDateString('en-US', { month: 'short' });
    const prev = i && cols[i - 1].find(Boolean);
    return !prev || new Date(`${prev}T12:00:00`).getMonth() !== new Date(`${first}T12:00:00`).getMonth() ? m : null;
  });
  return (
    <div>
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-[3px] text-2xs text-faint">
            {months.map((m, i) => <div key={i} className="w-[11px] overflow-visible whitespace-nowrap">{m}</div>)}
          </div>
          <div className="flex gap-[3px]" onMouseLeave={() => setHover(null)}>
            {cols.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((d, j) =>
                  d ? (
                    <button
                      key={d}
                      onMouseEnter={() => setHover(d)}
                      onClick={() => onPick?.(d)}
                      className="h-[11px] w-[11px] rounded-[3px] transition-transform hover:scale-125"
                      style={{ background: shade[level(counts[d])], boxShadow: 'inset 0 0 0 1px rgb(var(--fg) / .04)' }}
                      aria-label={d}
                    />
                  ) : (
                    <div key={j} className="h-[11px] w-[11px]" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-2xs text-faint">
        <span className="num">{hover ? `${counts[hover] || 0} records · ${longDate(hover)}` : `${Object.values(counts).reduce((a, b) => a + b, 0)} records in the last year`}</span>
        <span className="flex items-center gap-1">Less {shade.map((s, i) => <span key={i} className="h-[9px] w-[9px] rounded-[2px]" style={{ background: s }} />)} More</span>
      </div>
    </div>
  );
}

/** Horizontal share bars. items: [{ label, value, color }] */
export function ShareBars({ items, format = (v) => v }) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-elev">
        {items.map((it) => <div key={it.label} style={{ width: `${(it.value / total) * 100}%`, background: it.color }} />)}
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2 w-2 rounded-sm" style={{ background: it.color }} />
            <span className="flex-1 truncate text-muted">{it.label}</span>
            <span className="num font-medium">{format(it.value)}</span>
            <span className="num w-10 text-right text-xs text-faint">{Math.round((it.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
