import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Fetch helper with loading/error state and a reload() function. */
export function useApi(path, query, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const key = JSON.stringify([path, query]);
  const ctrl = useRef();

  const load = useCallback(async () => {
    if (!enabled) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    try {
      const d = await api(path, { query, signal: c.signal });
      if (!c.signal.aborted) { setData(d); setError(null); }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e);
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => { load(); return () => ctrl.current?.abort(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

/** Global "data changed" pulse so lists refresh after a new entry or edit. */
const listeners = new Set();
export const emitChange = () => listeners.forEach((l) => l());
export function useOnChange(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const l = () => ref.current();
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
}

export function useHotkey(combo, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const [needMod, key] = combo.startsWith('mod+') ? [true, combo.slice(4)] : [false, combo];
      if (needMod !== mod || e.key.toLowerCase() !== key) return;
      if (!needMod && /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
      if (!needMod && document.activeElement?.isContentEditable) return;
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo]);
}
