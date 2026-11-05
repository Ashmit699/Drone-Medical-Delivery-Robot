import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  Battery,
  CheckCircle2,
  Clock,
  Gauge,
  Hand,
  MapPin,
  Mountain,
  PartyPopper,
  Route,
  Star,
  XCircle,
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Journey } from '../components/Journey';
import { LiveMap } from '../components/maps';
import { ErrorNote, HoldButton, PageLoader, PriorityBadge, Spinner, Stat, StatusBadge } from '../components/ui';
import { api, useAppConfig } from '../lib/api';
import { cx, dateTime, duration, km, rupees, time } from '../lib/format';
import { PHASE_LABELS } from '../lib/phases';
import type { OrderDetail } from '../lib/types';
import { useLiveOrder } from '../lib/useLiveOrder';

const Map3D = lazy(() => import('../components/Map3D'));


function RateBox({ order, onRated }: { order: OrderDetail; onRated: (o: OrderDetail) => void }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  if (order.rating) {
    return (
      <div className="flex items-center gap-1 text-amber-500">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cx('h-5 w-5', n <= order.rating! && 'fill-current')} />
        ))}
        <span className="ml-2 text-sm text-emerald-200">Thanks for rating!</span>
      </div>
    );
  }
  return (
    <div>
      <div className="text-sm font-semibold text-emerald-100">How was your delivery?</div>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="text-amber-500">
            <Star className={cx('h-7 w-7 transition', n <= rating && 'fill-current')} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <div className="mt-3 flex gap-2">
          <input className="input bg-panel" placeholder="Anything we can improve? (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              onRated(await api<OrderDetail>(`/orders/${order.id}/rate`, { body: { rating, feedback: feedback || undefined } }));
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

export default function Track() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
  const config = useAppConfig();
  const { order, setOrder, telemetry: t, error } = useLiveOrder(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [view3d, setView3d] = useState(false);

  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorNote>{error}</ErrorNote></div>;
  if (!order || !config) return <PageLoader />;

  const phase = order.status === 'in_flight' ? (t?.phase ?? order.mission_phase) : null;
  const dropAlt = config.flight.dropAltM;

  const act = async (path: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      setOrder(await api<OrderDetail>(path, { body: {} }));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> My orders
      </Link>

      {params.get('new') && order.status !== 'delivered' && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-400 p-4 text-slate-950">
          <PartyPopper className="h-6 w-6 shrink-0" />
          <div>
            <div className="font-semibold">Order placed!</div>
            <div className="text-sm text-brand-50">
              {order.status === 'approved' ? 'Emergency order auto-approved. A drone is being prepared.' : 'A pharmacist will review it shortly. You can watch everything live on this page.'}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Order {order.code}</h1>
        <StatusBadge status={order.status} />
        <PriorityBadge priority={order.priority} />
        <span className="text-sm text-slate-500">Placed {dateTime(order.created_at)}</span>
        {['placed', 'approved'].includes(order.status) && (
          <button className="btn-ghost ml-auto text-red-400" disabled={busy} onClick={() => act(`/orders/${order.id}/cancel`, 'Cancel this order?')}>
            Cancel order
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Live map */}
          <div className="card overflow-hidden">
            <div className="relative">
              {view3d ? (
                <Suspense fallback={<div className="grid h-[340px] place-items-center sm:h-[420px]"><Spinner /></div>}>
                  <Map3D config={config} target={{ lat: order.lat, lon: order.lon, groundAltM: order.ground_alt_m }} drone={t} className="h-[340px] w-full sm:h-[420px]" />
                </Suspense>
              ) : (
                <LiveMap hub={config.hub} targets={[{ lat: order.lat, lon: order.lon }]} drones={t && order.status !== 'placed' ? [t] : []} className="h-[340px] w-full sm:h-[420px]" />
              )}
              <button type="button" onClick={() => setView3d(!view3d)} className="btn-secondary absolute bottom-3 right-3 z-[400] px-3 py-1.5 text-xs shadow">
                {view3d ? '2D map' : '3D view'}
              </button>
              {phase && (
                <div className="absolute left-3 top-3 z-[400] flex items-center gap-2 rounded-full bg-ink/90 px-3 py-1.5 text-xs font-semibold text-white shadow">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  {t?.paused ? 'Holding position (operator)' : PHASE_LABELS[phase]}
                </div>
              )}
            </div>
            {order.status === 'in_flight' && t && (
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5">
                <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Arrives in" value={t.etaToDropS != null ? duration(t.etaToDropS) : phase && ['returning', 'landing'].includes(phase) ? 'Delivered' : 'Overhead'} />
                <Stat icon={<Route className="h-3.5 w-3.5" />} label="Distance" value={t.distanceToTargetM != null ? km(t.distanceToTargetM) : '—'} />
                <Stat icon={<Mountain className="h-3.5 w-3.5" />} label="Altitude" value={`${t.altM.toFixed(1)} m`} />
                <Stat icon={<Gauge className="h-3.5 w-3.5" />} label="Speed" value={`${(t.groundSpeedMs * 3.6).toFixed(0)} km/h`} />
                <Stat icon={<Battery className="h-3.5 w-3.5" />} label="Battery" value={`${Math.round(t.batteryPct)}%`} />
              </div>
            )}
          </div>

          <ErrorNote>{actionError}</ErrorNote>

          {/* Context card for the current moment */}
          {order.status === 'placed' && (
            <div className="card flex items-center gap-4 p-5">
              <Spinner />
              <div>
                <div className="font-semibold">Waiting for pharmacist approval</div>
                <div className="text-sm text-slate-400">{order.has_rx ? 'Your prescription is being verified.' : 'Usually takes under a minute.'}</div>
              </div>
            </div>
          )}
          {order.status === 'approved' && (
            <div className="card flex items-center gap-4 p-5">
              <Spinner />
              <div>
                <div className="font-semibold">Packing & loading the drone</div>
                <div className="text-sm text-slate-400">Your package is being hooked into the gripper and the drone is running pre-flight checks.</div>
              </div>
            </div>
          )}
          {phase === 'awaiting_clearance' && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-500/10 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400 text-white">
                  <Hand className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-amber-50">Your drone is overhead</h2>
                  <p className="mt-1 text-sm text-amber-100">
                    It is hovering {dropAlt} m above your marker. Make sure nobody is standing under it and step back 5 m. Then hold the button to lower your package.
                  </p>
                  <HoldButton className="btn mt-4 w-full bg-amber-500 py-4 text-base text-white hover:bg-amber-600 sm:w-auto sm:px-8" holdMs={1200} disabled={busy} onComplete={() => act(`/orders/${order.id}/clearance`)}>
                    <Hand className="h-5 w-5" /> Hold: area is clear
                  </HoldButton>
                </div>
              </div>
            </div>
          )}
          {phase === 'lowering' && t && (
            <div className="card p-5">
              <div className="flex items-center gap-2 font-semibold">
                <ArrowDownToLine className="h-5 w-5 text-brand-400" /> Lowering your package. Stay back
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (t.payload.ropeM / (dropAlt - 0.2)) * 100)}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-slate-400">
                Rope {t.payload.ropeM.toFixed(1)} m of {(dropAlt - 0.2).toFixed(1)} m
              </div>
            </div>
          )}
          {order.status === 'delivered' && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                <div>
                  <h2 className="text-lg font-bold text-emerald-50">Delivered{order.delivered_at ? ` at ${time(order.delivered_at)}` : ''}</h2>
                  <p className="text-sm text-emerald-200">Unhook the box from the ground. The drone is heading back to base.</p>
                </div>
              </div>
              <div className="mt-5 border-t border-emerald-500/30 pt-5">
                <RateBox order={order} onRated={setOrder} />
              </div>
            </div>
          )}
          {['rejected', 'cancelled', 'failed'].includes(order.status) && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              {order.status === 'failed' ? <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" /> : <XCircle className="h-6 w-6 shrink-0 text-red-400" />}
              <div>
                <div className="font-semibold text-red-100">
                  {order.status === 'failed' ? 'Delivery could not be completed' : order.status === 'rejected' ? 'Order rejected' : 'Order cancelled'}
                </div>
                <div className="text-sm text-red-200">
                  {order.reject_reason ?? (order.status === 'failed' ? 'The drone brought your package back to base safely. We will contact you to redeliver.' : 'Nothing was charged. Your plan delivery was not used.')}
                </div>
              </div>
            </div>
          )}

          {/* Activity log */}
          <div className="card p-5">
            <button className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setShowLog(!showLog)}>
              Flight log ({order.events.length} events) <span className="text-slate-500">{showLog ? 'Hide' : 'Show'}</span>
            </button>
            {showLog && (
              <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                {[...order.events].reverse().map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="w-16 shrink-0 tabular-nums text-slate-500">{time(e.created_at)}</span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-4 font-bold">Delivery progress</h2>
            <Journey order={order} />
          </div>
          <div className="card space-y-4 p-5 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-brand-400" />
              <div>
                <div className="font-semibold">{order.address_label}</div>
                <div className="text-slate-400">{order.address_line}</div>
                <div className="text-xs text-slate-500">
                  {km(order.distance_m)} from hub · ~{duration(order.eta_s)} flight
                </div>
              </div>
            </div>
            {order.drone_name && (
              <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                Flying on <b>{order.drone_name}</b> ({order.drone_id})
              </div>
            )}
            <ul className="space-y-1.5 border-t border-line pt-4">
              {order.items.map((i) => (
                <li key={i.product_id} className="flex justify-between gap-2">
                  <span className="text-slate-300">
                    {i.qty} × {i.name}
                  </span>
                  <span>{rupees(i.qty * i.price)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line pt-4">
              <div className="flex justify-between">
                <dt className="text-slate-400">Emergency drone delivery</dt>
                <dd className="font-semibold text-emerald-400">Free</dd>
              </div>
              <div className="flex justify-between font-bold">
                <dt>You pay</dt>
                <dd>{rupees(order.total)}</dd>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <dt>Supplies worth {rupees(order.items_total)}</dt>
                <dd>Covered by your plan</dd>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <dt>Package weight</dt>
                <dd>{order.weight_g} g</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
