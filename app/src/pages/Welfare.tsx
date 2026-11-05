import { BadgePercent, CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorNote, PageLoader, Spinner } from '../components/ui';
import { api, useApi } from '../lib/api';
import { cx, dateTime } from '../lib/format';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';

interface Welfare {
  category: 'BPL' | 'SC' | 'ST' | 'EWS';
  doc_id: string;
  full_name: string;
  location: string;
  status: 'pending' | 'verified' | 'rejected';
  note: string | null;
  created_at: string;
  discountPct: number;
  label: string;
}

const CATEGORIES = [
  { id: 'BPL', name: 'Below Poverty Line (BPL)', pct: 50 },
  { id: 'SC', name: 'Scheduled Caste (SC)', pct: 40 },
  { id: 'ST', name: 'Scheduled Tribe (ST)', pct: 40 },
  { id: 'EWS', name: 'Economically Weaker Section (EWS)', pct: 30 },
] as const;

const STATUS = {
  pending: { icon: Clock, tone: 'border-amber-400/40 bg-amber-500/10 text-amber-300', title: 'Under review' },
  verified: { icon: CheckCircle2, tone: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300', title: 'Verified beneficiary' },
  rejected: { icon: XCircle, tone: 'border-rose-400/40 bg-rose-500/10 text-rose-300', title: 'Not approved' },
};

function WelfareForm({ onSaved }: { onSaved: (w: Welfare) => void }) {
  const user = useAuth((s) => s.user);
  const [form, setForm] = useState({ category: 'BPL', docId: '', fullName: user?.name ?? '', location: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await api<Welfare>('/welfare', { body: form }));
      toast({ tone: 'info', title: 'Sent for verification', body: 'An operator will check your document shortly' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <div className="label">Category</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setForm({ ...form, category: c.id })}
              className={cx('flex items-center justify-between rounded-xl border p-3 text-left text-sm', form.category === c.id ? 'border-violet-400/60 bg-violet-500/10' : 'border-line hover:border-white/20')}
            >
              <span className="font-medium text-white">{c.name}</span>
              <span className="font-mono text-xs font-bold text-violet-300">−{c.pct}%</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="doc">Ration card / certificate number</label>
          <input id="doc" className="input font-mono" placeholder="e.g. BPL-99281-IND" required minLength={4} value={form.docId} onChange={(e) => setForm({ ...form, docId: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="fname">Name as on the document</label>
          <input id="fname" className="input" required minLength={2} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="loc">Village / district / state</label>
        <input id="loc" className="input" placeholder="e.g. Rampur village, Lucknow, UP" required minLength={3} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      </div>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn w-full bg-violet-500 py-3 text-white shadow-[0_0_28px_-6px_rgba(139,92,246,0.8)] hover:bg-violet-400" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : <ShieldCheck className="h-4 w-4" />} Submit for verification
      </button>
      <p className="text-center text-xs text-slate-500">Demo app: please don't enter a real document number. Operators only see it to check eligibility.</p>
    </form>
  );
}

export default function Welfare() {
  const user = useAuth((s) => s.user);
  const { data, setData, loading } = useApi<Welfare | null>(user ? '/welfare' : null);
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-violet-400/30 bg-violet-500/10 shadow-[0_0_40px_-10px_rgba(139,92,246,0.9)]">
          <BadgePercent className="h-8 w-8 text-violet-300" />
        </div>
        <div className="hud mt-6 text-violet-300">Direct benefit pricing</div>
        <h1 className="mt-2 text-4xl font-bold text-white">Welfare subsidy</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Families below the poverty line (BPL), Scheduled Castes (SC), Scheduled Tribes (ST) and the Economically Weaker Section (EWS) get <b className="text-white">30–50% off their monthly MediDrop Care plan</b>{' '}
          once an operator verifies the document. Every emergency delivery stays free.
        </p>
      </div>

      <div className="card mt-10 p-6 sm:p-8">
        {!user ? (
          <div className="text-center">
            <p className="text-slate-300">Log in to apply.</p>
            <Link to="/login?next=/welfare" className="btn-primary mt-4">
              Log in
            </Link>
          </div>
        ) : loading && data === null ? (
          <PageLoader />
        ) : data && !editing ? (
          (() => {
            const s = STATUS[data.status];
            return (
              <div className="space-y-5">
                <div className={cx('flex items-start gap-4 rounded-2xl border p-5', s.tone)}>
                  <s.icon className="h-7 w-7 shrink-0" />
                  <div className="flex-1">
                    <div className="text-lg font-bold text-white">{s.title}</div>
                    <div className="text-sm">
                      {data.label} · <span className="font-mono">{data.doc_id}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {data.full_name} · {data.location} · applied {dateTime(data.created_at)}
                    </div>
                    {data.status === 'verified' && <div className="mt-3 font-mono text-sm font-bold text-emerald-300">−{data.discountPct}% on your Care plan is active</div>}
                    {data.status === 'rejected' && data.note && <div className="mt-2 text-sm">Reason: {data.note}</div>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.status === 'verified' && (
                    <Link to="/plans" className="btn-primary">
                      See my discounted plans
                    </Link>
                  )}
                  {data.status !== 'verified' && (
                    <button className="btn-secondary" onClick={() => setEditing(true)}>
                      Edit & resubmit
                    </button>
                  )}
                  <button
                    className="btn-ghost text-rose-300"
                    onClick={async () => {
                      await api('/welfare', { method: 'DELETE' });
                      setData(null);
                      toast({ tone: 'info', title: 'Welfare status removed' });
                    }}
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <WelfareForm
            onSaved={(w) => {
              setData(w);
              setEditing(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
