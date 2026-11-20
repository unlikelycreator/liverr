import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, ArrowUpRight, Star } from 'lucide-react';
import { useApi, useOnChange } from '../lib/hooks.js';
import { CATEGORIES, CATEGORY_KEYS, MOOD_FACE } from '../lib/categories.js';
import { money, num, duration, todayISO, shiftISO, humanize, dayLabel } from '../lib/format.js';
import { Bars, Heatmap, Line, ShareBars } from '../components/Charts.jsx';
import { PageHeader, Segmented, Skeleton, Stat, CategoryIcon, Empty } from '../components/ui.jsx';

const RANGES = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 };
const SPEND_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#0ea5e9', '#38bdf8', '#a855f7', '#f97316', '#8b8b96'];

// Weekly buckets keep long ranges readable.
function bucket(series, days, pick, mode = 'sum') {
  if (days <= 90) return series.map((d) => ({ date: d.date, value: pick(d) }));
  const out = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    const vals = chunk.map(pick).filter((v) => v !== null && v !== undefined);
    const value = mode === 'avg' ? (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null) : vals.reduce((a, b) => a + b, 0);
    out.push({ date: chunk[0].date, value: mode === 'avg' && value !== null ? Math.round(value * 10) / 10 : value });
  }
  return out;
}

function Card({ title, action, children, className = '' }) {
  return (
    <div className={`card min-w-0 p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Overview() {
  const nav = useNavigate();
  const [range, setRange] = useState('30D');
  const days = RANGES[range];
  const to = todayISO();
  const from = shiftISO(to, -(days - 1));
  const { data, loading, reload } = useApi('/stats/overview', { from, to });
  useOnChange(reload);

  const d = useMemo(() => {
    if (!data) return null;
    const cur = data.currency;
    const m = data.money[cur] || { income: 0, expense: 0 };
    const s = data.series;
    const sleeps = s.map((x) => x.sleep).filter((v) => v !== null);
    const moods = s.map((x) => x.mood).filter((v) => v !== null);
    const workouts = s.reduce((a, x) => a + x.workouts, 0);
    const exMin = s.reduce((a, x) => a + x.exerciseMin, 0);
    return {
      cur, m, workouts, exMin,
      sleepAvg: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
      moodAvg: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
      spend: bucket(s, days, (x) => x.expense),
      income: s.reduce((a, x) => a + x.income, 0),
      sleep: bucket(s, days, (x) => x.sleep, 'avg'),
      mood: bucket(s, days, (x) => x.mood, 'avg'),
      exercise: bucket(s, days, (x) => x.exerciseMin || x.workouts * 30),
      cats: CATEGORY_KEYS.map((k) => ({ label: CATEGORIES[k].label, value: data.categories[k], color: CATEGORIES[k].color })).filter((x) => x.value).sort((a, b) => b.value - a.value),
    };
  }, [data, days]);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Everything you’ve logged, at a glance."
        actions={<Segmented value={range} onChange={setRange} options={Object.keys(RANGES)} />}
      />

      {!d ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />)}<Skeleton className="h-72 sm:col-span-2 lg:col-span-4" /></div>
      ) : (
        <div className={loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Net cashflow" accent="#10b981" value={money(d.m.income - d.m.expense, d.cur, { compact: true, sign: d.m.income - d.m.expense !== 0 })} hint={`${money(d.m.expense, d.cur, { compact: true })} out · ${money(d.m.income, d.cur, { compact: true })} in`} />
            <Stat label="Workouts" accent="#0ea5e9" value={num(d.workouts)} hint={d.exMin ? `${duration(d.exMin)} total` : 'sessions logged'} />
            <Stat label="Avg sleep" accent="#f43f5e" value={d.sleepAvg ? `${num(d.sleepAvg, 1)}h` : '—'} hint={d.sleepAvg ? 'per logged night' : 'mention “slept 7 hours”'} />
            <Stat
              label="Journal streak"
              accent="#eab308"
              value={<span className="inline-flex items-center gap-1.5">{num(data.streak)}<Flame className={`h-5 w-5 ${data.streak ? 'text-orange-500' : 'text-faint'}`} /></span>}
              hint={`${num(data.totals.journalDays)} days journaled · mood ${d.moodAvg ? MOOD_FACE[Math.round(d.moodAvg)] : '—'}`}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title="Spending"
              action={<Link to="/c/finance" className="btn-ghost -mr-2 h-7 px-2 text-xs">Ledger <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
            >
              <Bars data={d.spend} color="#10b981" format={(v) => money(v, d.cur)} height={160} />
            </Card>
            <Card title="Where it went">
              {data.topSpend.length ? (
                <ShareBars items={data.topSpend.slice(0, 6).map((s, i) => ({ label: humanize(s.subtype), value: s.total, color: SPEND_COLORS[i] }))} format={(v) => money(v, d.cur, { compact: true })} />
              ) : (
                <Empty title="No expenses yet">Mention what you spent in your journal.</Empty>
              )}
            </Card>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card title="Sleep" action={<span className="text-xs text-faint">hours</span>}>
              <Line data={d.sleep} color="#f43f5e" format={(v) => `${num(v, 1)}h`} min={0} max={Math.max(10, ...d.sleep.map((x) => x.value || 0))} />
            </Card>
            <Card title="Mood" action={<span className="text-xs text-faint">1–5</span>}>
              <Line data={d.mood} color="#eab308" format={(v) => `${MOOD_FACE[Math.round(v)] || ''} ${num(v, 1)}`} min={1} max={5} />
            </Card>
            <Card title="Exercise" action={<span className="text-xs text-faint">minutes</span>}>
              <Bars data={d.exercise} color="#0ea5e9" format={(v) => duration(v) || '0m'} height={120} />
            </Card>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card title="Activity" className="lg:col-span-2" action={<span className="num text-xs text-faint">{num(data.totals.records)} records all time</span>}>
              <Heatmap counts={data.heatmap} onPick={(date) => nav(`/journal?date=${date}`)} />
            </Card>
            <Card title="What you logged">
              {d.cats.length ? <ShareBars items={d.cats.slice(0, 7)} /> : <Empty title="Nothing yet">Write your first entry.</Empty>}
            </Card>
          </div>

          <div className="mt-3">
            <Card title="Recently watched & read" action={<Link to="/c/media" className="btn-ghost -mr-2 h-7 px-2 text-xs">Library <ArrowUpRight className="h-3.5 w-3.5" /></Link>}>
              {data.recentMedia.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.recentMedia.map((r) => (
                    <div key={r._id} className="flex items-center gap-3 rounded-lg border border-line p-3">
                      <CategoryIcon category="media" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{r.title}</div>
                        <div className="truncate text-xs text-faint">{[humanize(r.subtype), r.platform, dayLabel(r.date)].filter(Boolean).join(' · ')}</div>
                      </div>
                      {r.rating !== undefined && <span className="num flex items-center gap-1 text-xs text-muted"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{num(r.rating, 1)}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="Nothing watched yet">Try “watched Interstellar on Netflix, 9/10”.</Empty>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
