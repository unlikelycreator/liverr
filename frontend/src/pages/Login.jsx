import { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { Logo } from '../components/Layout.jsx';
import { Spinner, cx } from '../components/ui.jsx';

export default function Login({ onDone }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    setErr('');
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { passcode: code } });
      onDone(token);
    } catch (e2) {
      setErr(e2.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(600px_circle_at_50%_-10%,rgb(var(--accent)/.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[.35] [background-image:linear-gradient(rgb(var(--line))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--line))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <form onSubmit={submit} className="relative w-full max-w-[340px] animate-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-11 w-11" />
          <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em]">Welcome back</h1>
          <p className="mt-1 text-[13px] text-muted">Enter your passcode to open Liverr.</p>
        </div>
        <div className={cx('card flex items-center gap-2 p-1.5 pl-3.5 transition-shadow focus-within:shadow-ring', err && 'animate-[pop_.2s]')}>
          <Lock className="h-4 w-4 shrink-0 text-faint" />
          <input
            autoFocus
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Passcode"
            className="h-9 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
          <button className="btn-primary h-9 w-9 px-0" disabled={busy || !code} aria-label="Unlock">
            {busy ? <Spinner className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 h-5 text-center text-xs text-rose-500">{err}</div>
      </form>
    </div>
  );
}
