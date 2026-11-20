import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PenLine, LayoutGrid, BookOpen, Search, Sun, Moon, LogOut, Menu, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS } from '../lib/categories.js';
import { useApp } from '../App.jsx';
import { useHotkey, useApi, useOnChange } from '../lib/hooks.js';
import { CommandMenu } from './CommandMenu.jsx';
import { cx, Dot } from './ui.jsx';

export function Logo({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="rgb(var(--fg))" />
      <path d="M10 8v16h12" fill="none" stroke="rgb(var(--bg))" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="10" r="2.6" fill="rgb(var(--accent))" />
    </svg>
  );
}

function NavItem({ to, icon: Icon, label, end, count, color, onClick, shortcut }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
          isActive ? 'bg-elev text-fg shadow-[inset_0_0_0_1px_rgb(var(--line))]' : 'text-muted hover:bg-elev/60 hover:text-fg'
        )
      }
    >
      {color ? <span className="flex h-4 w-4 items-center justify-center"><Dot color={color} className="h-2 w-2" /></span> : <Icon className="h-4 w-4" strokeWidth={1.9} />}
      <span className="flex-1 truncate">{label}</span>
      {count > 0 && <span className="num text-2xs text-faint">{count}</span>}
      {shortcut && <span className="kbd opacity-0 transition-opacity group-hover:opacity-100">{shortcut}</span>}
    </NavLink>
  );
}

function Sidebar({ onNavigate, onSearch }) {
  const { theme, toggleTheme, logout, health, authRequired } = useApp();
  const { data, reload } = useApi('/stats/overview', { from: '2000-01-01' });
  useOnChange(reload);
  const counts = data?.categories || {};
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo />
        <span className="text-[15px] font-semibold tracking-[-0.02em]">Liverr</span>
      </div>
      <div className="px-3">
        <button onClick={onSearch} className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[13px] text-faint shadow-card transition-colors hover:text-muted">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search</span>
          <span className="kbd">⌘K</span>
        </button>
      </div>
      <nav className="mt-4 space-y-0.5 px-3">
        <NavItem to="/" end icon={PenLine} label="Write" onClick={onNavigate} />
        <NavItem to="/overview" icon={LayoutGrid} label="Overview" onClick={onNavigate} />
        <NavItem to="/journal" icon={BookOpen} label="Journal" count={data?.totals?.entries} onClick={onNavigate} />
      </nav>
      <div className="mt-6 px-5 text-2xs font-medium uppercase tracking-[0.08em] text-faint">Collections</div>
      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {CATEGORY_KEYS.map((k) => (
          <NavItem key={k} to={`/c/${k}`} color={CATEGORIES[k].color} label={CATEGORIES[k].label} count={counts[k]} onClick={onNavigate} />
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5 text-xs text-faint" title={health?.ai ? `AI parsing with ${health.model}` : 'Offline rule-based parsing'}>
            <span className={cx('h-1.5 w-1.5 rounded-full', !health ? 'bg-faint' : health.db ? 'bg-emerald-500' : 'bg-amber-500')} />
            <span className="truncate">{!health ? 'Connecting…' : !health.db ? 'No database' : health.ai ? 'AI parsing' : 'Offline parsing'}</span>
          </div>
          <button className="btn-icon" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {authRequired && (
            <button className="btn-icon" onClick={logout} aria-label="Lock" title="Lock">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useHotkey('mod+k', () => setCmd((v) => !v));
  useHotkey('/', () => setCmd(true));
  useHotkey('n', () => nav('/'));
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-line bg-bg lg:block">
        <Sidebar onSearch={() => setCmd(true)} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <button className="btn-icon -ml-2" onClick={() => setDrawer(true)} aria-label="Menu"><Menu className="h-[18px] w-[18px]" /></button>
        <Logo className="h-6 w-6" />
        <span className="flex-1 text-[15px] font-semibold tracking-[-0.02em]">Liverr</span>
        <button className="btn-icon" onClick={() => setCmd(true)} aria-label="Search"><Search className="h-[18px] w-[18px]" /></button>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[264px] border-r border-line bg-bg shadow-pop animate-in">
            <button className="btn-icon absolute right-3 top-3" onClick={() => setDrawer(false)} aria-label="Close"><X className="h-4 w-4" /></button>
            <Sidebar onNavigate={() => setDrawer(false)} onSearch={() => { setDrawer(false); setCmd(true); }} />
          </div>
        </div>
      )}

      <main className="lg:pl-[232px]">
        <div key={loc.pathname} className="mx-auto w-full max-w-[1080px] px-4 pb-24 pt-6 animate-in sm:px-6 lg:px-10 lg:pt-10">
          <Outlet />
        </div>
      </main>
      <CommandMenu open={cmd} onClose={() => setCmd(false)} />
    </div>
  );
}
