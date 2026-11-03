import { Radio, User as UserIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/layout';
import { ErrorNote, Spinner } from '../components/ui';
import { api } from '../lib/api';
import type { User } from '../lib/types';
import { useAuth } from '../store/auth';

// Matches server/src/db/seed.ts so exhibition guests can jump straight in.
const DEMO = [
  { label: 'Customer demo', sub: 'Order & track deliveries', email: 'customer@medidrop.app', icon: UserIcon },
  { label: 'Operator demo', sub: 'Approve, dispatch, monitor', email: 'ops@medidrop.app', icon: Radio },
];
const DEMO_PASSWORD = 'demo1234';

function useFinishLogin() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (token: string, user: User) => {
    login(token, user);
    const next = params.get('next');
    navigate(next ?? (user.role === 'operator' ? '/ops' : '/shop'), { replace: true });
  };
}

function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const finish = useFinishLogin();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent, creds = { email, password }) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', { body: creds });
      finish(r.token, r.user);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" sub="Log in to order and track deliveries.">
      <div className="grid grid-cols-2 gap-3">
        {DEMO.map((d) => (
          <button key={d.email} type="button" disabled={busy} onClick={() => submit(undefined, { email: d.email, password: DEMO_PASSWORD })} className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-3 text-left transition hover:border-brand-400">
            <d.icon className="h-5 w-5 text-brand-300" />
            <div className="mt-2 text-sm font-semibold">{d.label}</div>
            <div className="text-xs text-slate-400">{d.sub}</div>
          </button>
        ))}
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
        <div className="h-px flex-1 bg-white/10" /> or with email <div className="h-px flex-1 bg-white/10" />
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Log in
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        New here?{' '}
        <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-brand-300 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function Register() {
  const finish = useFinishLogin();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string; user: User }>('/auth/register', { body: { ...form, phone: form.phone || undefined } });
      finish(r.token, r.user);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" sub="It takes 20 seconds.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required minLength={2} />
        </div>
        <div>
          <label className="label" htmlFor="r-email">Email</label>
          <input id="r-email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input id="phone" type="tel" className="input" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="label" htmlFor="r-password">Password</label>
          <input id="r-password" type="password" className="input" autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={6} />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Create account
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-300 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
