import { BadgePercent, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Empty, ErrorNote, PageLoader } from '../../components/ui';
import { api, getSocket, useApi } from '../../lib/api';
import { cx, timeAgo } from '../../lib/format';

interface Row {
  id: number;
  email: string;
  category: string;
  label: string;
  discountPct: number;
  doc_id: string;
  full_name: string;
  location: string;
  status: 'pending' | 'verified' | 'rejected';
  note: string | null;
  created_at: string;
}

const TONE = { pending: 'text-amber-300 bg-amber-500/10', verified: 'text-emerald-300 bg-emerald-500/10', rejected: 'text-rose-300 bg-rose-500/10' };

export default function WelfareQueue() {
  const [status, setStatus] = useState('pending');
  const { data, loading, reload } = useApi<Row[]>(`/ops/welfare${status ? `?status=${status}` : ''}`);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();
    s.on('welfare:new', reload);
    return () => {
      s.off('welfare:new', reload);
    };
  }, [reload]);

  const act = async (id: number, action: 'verify' | 'reject') => {
    setError(null);
    const note = action === 'reject' ? window.prompt('Reason (shown to the customer)', 'Document number could not be matched') : null;
    if (action === 'reject' && note === null) return;
    try {
      await api(`/ops/welfare/${id}/${action}`, { body: { note } });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="hud text-violet-300">Direct benefit pricing</div>
        <h1 className="text-2xl font-bold text-white">Welfare verification</h1>
        <p className="text-sm text-slate-400">Check the document number against the government record, then verify. The customer is notified instantly.</p>
      </div>
      <div className="flex gap-1">
        {[
          ['pending', 'Pending'],
          ['verified', 'Verified'],
          ['rejected', 'Rejected'],
          ['', 'All'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={cx('rounded-lg px-3 py-2 text-sm font-medium', status === k ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/[0.05]')}>
            {l}
          </button>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      {loading && !data ? (
        <PageLoader />
      ) : !data?.length ? (
        <Empty icon={<BadgePercent className="h-6 w-6" />} title="Nothing here" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.map((w) => (
            <div key={w.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{w.full_name}</div>
                  <div className="text-xs text-slate-500">
                    {w.email} · {timeAgo(w.created_at)}
                  </div>
                </div>
                <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold capitalize', TONE[w.status])}>{w.status}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                  <dt className="hud">Category</dt>
                  <dd className="text-white">
                    {w.category} <span className="font-mono text-xs text-violet-300">−{w.discountPct}%</span>
                  </dd>
                </div>
                <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                  <dt className="hud">Document</dt>
                  <dd className="font-mono text-white">{w.doc_id}</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-white/[0.04] px-3 py-2">
                  <dt className="hud">Location</dt>
                  <dd className="text-white">{w.location}</dd>
                </div>
              </dl>
              {w.note && <p className="mt-2 text-xs text-slate-500">Note: {w.note}</p>}
              {w.status === 'pending' && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button className="btn-primary" onClick={() => act(w.id, 'verify')}>
                    <Check className="h-4 w-4" /> Verify
                  </button>
                  <button className="btn-secondary text-rose-300" onClick={() => act(w.id, 'reject')}>
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
