import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, LoaderCircle, Check, CircleAlert } from 'lucide-react';
import { CATEGORIES } from '../lib/categories.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Spinner({ className = 'h-4 w-4' }) {
  return <LoaderCircle className={cx('animate-spin', className)} strokeWidth={2} />;
}

export function CategoryIcon({ category, size = 'md', className }) {
  const c = CATEGORIES[category];
  if (!c) return null;
  const Icon = c.icon;
  const box = size === 'sm' ? 'h-6 w-6 rounded-md' : size === 'lg' ? 'h-10 w-10 rounded-xl' : 'h-8 w-8 rounded-lg';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center', box, className)}
      style={{ background: `${c.color}1a`, color: c.color, boxShadow: `inset 0 0 0 1px ${c.color}26` }}
    >
      <Icon className={icon} strokeWidth={2} />
    </span>
  );
}

export const Dot = ({ color, className }) => (
  <span className={cx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', className)} style={{ background: color }} />
);

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} />;
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center animate-fade">
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-elev text-muted">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      )}
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[13px] text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-start sm:p-4 sm:pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" className={cx('relative w-full overflow-hidden rounded-t-2xl bg-panel shadow-pop animate-pop sm:rounded-2xl', width)}>
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="text-sm font-semibold">{title}</div>
            <button className="btn-icon -mr-2 h-7 w-7" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-bg/40 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Segmented({ value, onChange, options, className }) {
  return (
    <div className={cx('inline-flex h-8 items-center rounded-lg border border-line bg-elev/60 p-0.5', className)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cx(
              'h-full rounded-md px-2.5 text-xs font-medium transition-colors',
              value === v ? 'bg-panel text-fg shadow-card ring-1 ring-line' : 'text-muted hover:text-fg'
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {icon}
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, trend, accent }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-faint">
        {accent && <Dot color={accent} />}
        {label}
      </div>
      <div className="num mt-2 text-[22px] font-semibold tracking-[-0.02em]">{value}</div>
      {(hint || trend) && <div className="mt-1 truncate text-xs text-muted">{trend}{hint}</div>}
    </div>
  );
}

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, { type = 'success', action } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, type, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl bg-panel px-3.5 py-2.5 text-[13px] shadow-pop animate-pop">
              {t.type === 'error'
                ? <CircleAlert className="h-4 w-4 shrink-0 text-rose-500" />
                : <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
              <span className="min-w-0">{t.message}</span>
              {t.action && <button className="ml-1 font-medium text-accent" onClick={t.action.onClick}>{t.action.label}</button>}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}
