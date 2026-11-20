import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { api, getToken, setToken, setUnauthorizedHandler } from './lib/api.js';
import { setCurrency } from './lib/format.js';
import { Layout } from './components/Layout.jsx';
import { ToastProvider, Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Write from './pages/Write.jsx';
import Overview from './pages/Overview.jsx';
import Journal from './pages/Journal.jsx';
import Category from './pages/Category.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const [health, setHealth] = useState(null);
  const [auth, setAuth] = useState({ checked: false, required: false, authed: false });
  const [wakeError, setWakeError] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09090b' : '#fafafa');
    try { localStorage.setItem('liverr.theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const boot = useCallback(async () => {
    setWakeError(false);
    // Free hosting tiers sleep; retry for ~60s while the API wakes up.
    for (let i = 0; i < 12; i++) {
      try {
        const [h, s] = await Promise.all([api('/health'), api('/auth/status')]);
        setHealth(h);
        setCurrency(h.currency);
        setAuth({ checked: true, required: s.required, authed: !s.required || Boolean(getToken()) });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    setWakeError(true);
  }, []);
  useEffect(() => { boot(); }, [boot]);

  const logout = useCallback(() => {
    setToken('');
    setAuth((a) => ({ ...a, authed: !a.required }));
  }, []);
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const ctx = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), health, logout, authRequired: auth.required }),
    [theme, health, logout, auth.required]
  );

  let body;
  if (!auth.checked) {
    body = (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-[13px] text-muted">
        {wakeError ? (
          <>
            <div>Couldn’t reach the Liverr server.</div>
            <button className="btn-outline" onClick={boot}>Try again</button>
          </>
        ) : (
          <>
            <Spinner className="h-5 w-5 text-faint" />
            <div className="animate-fade [animation-delay:2s]">Waking up the server…</div>
          </>
        )}
      </div>
    );
  } else if (!auth.authed) {
    body = <Login onDone={(t) => { setToken(t); setAuth((a) => ({ ...a, authed: true })); }} />;
  } else {
    body = (
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Write />} />
          <Route path="overview" element={<Overview />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/:id" element={<Journal />} />
          <Route path="c/:category" element={<Category />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider>{body}</ToastProvider>
    </AppCtx.Provider>
  );
}
