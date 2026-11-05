import { BadgePercent, Check, ShieldCheck, Siren, Smartphone, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNote, Modal, PageLoader, Spinner } from '../components/ui';
import { api, useApi, useAppConfig } from '../lib/api';
import { cx, dateTime, rupees } from '../lib/format';
import type { Plan, PlanId, PlanState } from '../lib/types';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';

const FAQ = [
  ['Do I pay for medicines or the flight?', 'No. Your monthly plan covers the emergency flight and the supplies up to your plan’s limit per delivery.'],
  ['Is there a waiting period?', 'No. Cover starts the moment your plan is active, even for the very first emergency.'],
  ['Can I cancel?', 'Yes, any time from this page. Cover continues until the end of the month you paid for.'],
  ['I can’t afford a plan.', 'BPL, SC/ST and EWS families get 30–50% off every plan after a quick document check.'],
];

export default function Plans() {
  const user = useAuth((s) => s.user);
  const config = useAppConfig();
  const { data, setData } = useApi<PlanState>(user ? '/subscription' : null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [buying, setBuying] = useState<(Plan & { price: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans: (Plan & { price: number })[] = data?.plans ?? config?.plans.map((p) => ({ ...p, price: p.priceMonthly })) ?? [];
  const current = data?.current ?? null;

  const subscribe = async (id: PlanId) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api<PlanState>('/subscription', { body: { plan: id } });
      setData(s);
      setBuying(null);
      toast({ tone: 'success', title: `${s.current?.planName} plan active`, body: 'Every emergency delivery is now free for you' });
      const next = params.get('next');
      if (next) navigate(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setData(await api<PlanState>('/subscription', { method: 'DELETE' }));
    toast({ tone: 'info', title: 'Plan cancelled' });
  };

  if (!config) return <PageLoader />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10">
          <ShieldCheck className="h-8 w-8 text-emerald-300" />
        </div>
        <div className="hud mt-6 text-emerald-300">Aerolift Care</div>
        <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl">Pay a little every month. Never pay in an emergency.</h1>
        <p className="mt-4 text-slate-400">
          Like insurance for medical deliveries: when someone at home needs medicine urgently, an emergency drone flies it to you at full speed, supplies and flight included, for free.
        </p>
      </div>

      {current && (
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <ShieldCheck className="h-8 w-8 text-emerald-300" />
          <div className="min-w-[220px] flex-1">
            <div className="font-semibold text-white">Your plan: {current.planName} · active</div>
            <div className="text-sm text-slate-300">
              {current.remaining == null ? 'Unlimited deliveries' : `${current.remaining} of ${current.deliveriesPerMonth} free deliveries left`} · renews {dateTime(current.renews_at)} · {rupees(current.price_paid)}/month
            </div>
          </div>
          <Link to="/shop" className="btn-primary">Order now</Link>
          <button className="text-xs text-slate-400 underline" onClick={cancel}>Cancel plan</button>
        </div>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = current?.plan === p.id;
          return (
            <div
              key={p.id}
              className={cx(
                'card relative flex flex-col p-6',
                p.popular && 'border-brand-400/50',
                isCurrent && 'ring-2 ring-emerald-400/50',
              )}
            >
              {p.popular && <span className="absolute -top-3 left-6 rounded-full bg-brand-400 px-3 py-0.5 text-xs font-bold text-ink">Most popular</span>}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{p.name}</h2>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5" /> {p.members === 1 ? '1 person' : `Up to ${p.members}`}
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold text-white">{rupees(p.price)}</span>
                <span className="text-sm text-slate-400">/ month</span>
                {p.price < p.priceMonthly && <span className="font-mono text-sm text-slate-500 line-through">{rupees(p.priceMonthly)}</span>}
              </div>
              {p.price < p.priceMonthly && (
                <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-violet-300">
                  <BadgePercent className="h-3.5 w-3.5" /> Welfare discount applied
                </div>
              )}
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2 text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {perk}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="mt-6 rounded-xl bg-emerald-500/10 py-2.5 text-center text-sm font-semibold text-emerald-300">Your current plan</div>
              ) : user ? (
                <button className={cx('mt-6 w-full py-3', p.popular ? 'btn-primary' : 'btn-secondary')} onClick={() => setBuying(p)}>
                  {current ? 'Switch to' : 'Get'} {p.name}
                </button>
              ) : (
                <Link to="/login?next=/plans" className={cx('mt-6 w-full py-3', p.popular ? 'btn-primary' : 'btn-secondary')}>
                  Log in to subscribe
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><Siren className="h-3.5 w-3.5 text-red-400" /> Every order is an emergency flight at {Math.round(config.flight.cruiseSpeedMs * 3.6)} km/h</span>
        <span>Within {config.serviceRadiusKm} km of {config.hub.name}</span>
        <Link to="/welfare" className="font-semibold text-violet-300 hover:underline">Welfare discount: up to 50% off →</Link>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
        {FAQ.map(([q, a]) => (
          <div key={q} className="card p-5">
            <h3 className="font-semibold text-white">{q}</h3>
            <p className="mt-1.5 text-sm text-slate-400">{a}</p>
          </div>
        ))}
      </div>

      <Modal open={!!buying} onClose={() => setBuying(null)} title={`Aerolift Care ${buying?.name ?? ''}`}>
        {buying && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-white/[0.04] p-4">
              <span className="text-slate-300">Monthly, UPI autopay</span>
              <span className="font-mono text-xl font-bold text-white">{rupees(buying.price)}</span>
            </div>
            <p className="flex items-start gap-2 text-xs text-slate-400">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" /> Exhibition demo: no real money is charged.
            </p>
            <ErrorNote>{error}</ErrorNote>
            <button className="btn-primary w-full py-3" disabled={busy} onClick={() => subscribe(buying.id)}>
              {busy && <Spinner className="h-4 w-4" />} Pay {rupees(buying.price)} & activate
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
