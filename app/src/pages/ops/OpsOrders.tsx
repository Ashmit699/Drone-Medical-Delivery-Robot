import { Check, CheckCircle2, CircleX, ExternalLink, FileImage, Hand, Inbox, MapPin, Phone, Plane, Rocket, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Journey } from '../../components/Journey';
import { LiveMap } from '../../components/maps';
import { Empty, ErrorNote, HoldButton, Modal, PageLoader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { api, getSocket, useApi, useAppConfig } from '../../lib/api';
import { cx, km, rupees, time, timeAgo } from '../../lib/format';
import { PHASE_LABELS } from '../../lib/phases';
import type { Drone, OrderDetail, OrderSummary } from '../../lib/types';
import { useFleet } from '../../lib/useFleet';
import { useLiveOrder } from '../../lib/useLiveOrder';

const TABS = [
  { key: '', label: 'All' },
  { key: 'placed', label: 'Needs approval' },
  { key: 'approved', label: 'Ready to dispatch' },
  { key: 'in_flight', label: 'In flight' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'failed', label: 'Failed' },
  { key: 'rejected', label: 'Rejected' },
];

const MANUAL_CHECKS = ['Package hooked & gripper locked', 'Props and arms checked', 'Launch pad clear of people', 'Wind below 20 km/h, no rain'];

function DispatchModal({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: (o: OrderDetail) => void }) {
  const { drones } = useFleet();
  const [droneId, setDroneId] = useState<string | null>(null);
  const [manual, setManual] = useState(MANUAL_CHECKS.map(() => false));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const available = drones.filter((d) => d.status === 'idle');
  useEffect(() => {
    if (!droneId && available.length) setDroneId([...available].sort((a, b) => (b.telemetry?.batteryPct ?? 0) - (a.telemetry?.batteryPct ?? 0))[0].id);
  }, [available, droneId]);

  const drone = drones.find((d) => d.id === droneId);
  const t = drone?.telemetry;
  const auto = drone
    ? [
        { label: `Drone link connected (${drone.adapter === 'sim' ? 'simulator' : 'radio bridge'})`, ok: !!t?.connected },
        { label: `Battery ≥ 40% (${t ? Math.round(t.batteryPct) : '?'}%)`, ok: (t?.batteryPct ?? 0) >= 40 },
        { label: `GPS lock ≥ 10 satellites (${t?.gpsSats ?? 0})`, ok: (t?.gpsSats ?? 0) >= 10 },
        { label: `Payload ${order.weight_g} g ≤ ${drone.max_payload_g} g`, ok: order.weight_g <= drone.max_payload_g },
        { label: 'Winch homed, rope retracted', ok: t?.payload.winch === 'homed' && (t?.payload.ropeM ?? 0) === 0 },
      ]
    : [];
  const ready = !!drone && auto.every((c) => c.ok) && manual.every(Boolean);

  const launch = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await api<OrderDetail>(`/ops/orders/${order.id}/dispatch`, { body: { droneId } }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Pre-flight · ${order.code}`} wide>
      <div className="space-y-5">
        <div>
          <div className="label">Drone</div>
          {available.length === 0 ? (
            <ErrorNote>No idle drones. Wait for one to land or take one out of maintenance in Fleet.</ErrorNote>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {available.map((d: Drone) => (
                <button
                  key={d.id}
                  onClick={() => setDroneId(d.id)}
                  className={cx('rounded-xl border p-3 text-left text-sm', droneId === d.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200')}
                >
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-slate-500">
                    {d.id} · {d.telemetry ? Math.round(d.telemetry.batteryPct) : '?'}% · {d.adapter}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {drone && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="label">Automatic checks</div>
              <ul className="space-y-1.5 text-sm">
                {auto.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    <span className={c.ok ? '' : 'text-red-700'}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">Operator checks</div>
              <div className="space-y-1.5">
                {MANUAL_CHECKS.map((c, i) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={manual[i]} onChange={(e) => setManual(manual.map((m, j) => (j === i ? e.target.checked : m)))} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <HoldButton disabled={!ready || busy} onComplete={launch} className="btn-primary px-6">
            {busy ? <Spinner className="h-4 w-4 text-white" /> : <Rocket className="h-4 w-4" />} Hold to launch
          </HoldButton>
        </div>
      </div>
    </Modal>
  );
}

function OrderDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const config = useAppConfig();
  const { order, setOrder, telemetry: t, error } = useLiveOrder(id, '/ops/orders');
  const [rx, setRx] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (path: string, body: unknown = {}) => {
    setActionError(null);
    try {
      setOrder(await api<OrderDetail>(path, { body }));
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const phase = order?.status === 'in_flight' ? (t?.phase ?? order.mission_phase) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {!order || !config ? (
          error ? <div className="p-6"><ErrorNote>{error}</ErrorNote></div> : <PageLoader />
        ) : (
          <>
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{order.code}</h2>
                  <StatusBadge status={order.status} />
                  <PriorityBadge priority={order.priority} />
                </div>
                <div className="text-xs text-slate-500">Placed {timeAgo(order.created_at)}</div>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Actions */}
              <ErrorNote>{actionError}</ErrorNote>
              {order.status === 'placed' && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary flex-1" onClick={() => act(`/ops/orders/${order.id}/approve`)}>
                    <Check className="h-4 w-4" /> {order.has_rx ? 'Prescription OK, approve' : 'Approve'}
                  </button>
                  <button className="btn-secondary text-red-600" onClick={() => setRejecting(true)}>
                    <CircleX className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
              {order.status === 'approved' && (
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 py-3" onClick={() => setDispatching(true)}>
                    <Rocket className="h-4 w-4" /> Load & dispatch
                  </button>
                  <button className="btn-secondary text-red-600" onClick={() => setRejecting(true)}>
                    Reject
                  </button>
                </div>
              )}
              {phase === 'awaiting_clearance' && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-900">Drone is waiting for “area clear”</div>
                  <p className="mt-1 text-xs text-amber-800">The customer can confirm from their phone. Only confirm yourself if you've verified the drop zone (e.g. by call).</p>
                  <HoldButton className="btn mt-3 bg-amber-500 text-white hover:bg-amber-600" onComplete={() => act(`/orders/${order.id}/clearance`)}>
                    <Hand className="h-4 w-4" /> Hold: confirm area clear
                  </HoldButton>
                </div>
              )}

              {order.has_rx && (
                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-left text-sm text-violet-900"
                  onClick={async () => setRx((await api<{ image: string }>(`/ops/orders/${order.id}/rx`)).image)}
                >
                  <FileImage className="h-5 w-5" /> Prescription attached: <span className="font-semibold underline">view</span>
                </button>
              )}

              {['in_flight', 'delivered'].includes(order.status) && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <LiveMap hub={config.hub} targets={[{ lat: order.lat, lon: order.lon }]} drones={t ? [t] : []} className="h-56 w-full" />
                  {phase && t && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 px-4 py-2 text-xs text-slate-600">
                      <b className="text-indigo-700">{PHASE_LABELS[phase]}</b>
                      <span>{t.mode}</span>
                      <span>{t.altM.toFixed(1)} m</span>
                      <span>{Math.round(t.batteryPct)}%</span>
                      {t.markerErrorCm != null && <span>marker ±{Math.round(t.markerErrorCm)} cm</span>}
                      <Link to="/ops/monitor" className="ml-auto font-semibold text-brand-700">
                        Monitor →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <section className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</div>
                  <div className="mt-1 font-semibold">{order.customer_name}</div>
                  {order.customer_phone && (
                    <div className="flex items-center gap-1 text-slate-500">
                      <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Drop location</div>
                  <div className="mt-1 flex items-start gap-1 font-semibold">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 text-brand-600" /> {order.address_label}
                  </div>
                  <div className="text-slate-500">{order.address_line}</div>
                  <div className="text-xs text-slate-400">{km(order.distance_m)} from hub</div>
                </div>
              </section>
              {order.notes && <div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="font-semibold">Note: </span>{order.notes}</div>}

              <section>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Items · {order.weight_g} g</div>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm">
                  {order.items.map((i) => (
                    <li key={i.product_id} className="flex justify-between px-3 py-2">
                      <span>
                        {i.qty} × {i.name}
                      </span>
                      <span className="text-slate-500">{rupees(i.qty * i.price)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between px-3 py-2 font-semibold">
                    <span>Total ({order.payment_method}, {order.payment_status})</span>
                    <span>{rupees(order.total)}</span>
                  </li>
                </ul>
              </section>

              <section>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Progress</div>
                <Journey order={order} />
              </section>

              <section>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Event log</div>
                <ul className="space-y-1.5 text-xs">
                  {[...order.events].reverse().map((e) => (
                    <li key={e.id} className="flex gap-3">
                      <span className="w-14 shrink-0 tabular-nums text-slate-400">{time(e.created_at)}</span>
                      <span>{e.message}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <Modal open={rejecting} onClose={() => setRejecting(false)} title={`Reject ${order.code}`}>
              <label className="label" htmlFor="reason">Reason (shown to the customer)</label>
              <input id="reason" className="input" placeholder="e.g. Prescription unclear, please re-upload" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['Prescription unclear', 'Out of service area', 'Weather unsafe for flight'].map((r) => (
                  <button key={r} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs hover:bg-slate-200" onClick={() => setReason(r)}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setRejecting(false)}>
                  Back
                </button>
                <button
                  className="btn-danger"
                  disabled={reason.trim().length < 3}
                  onClick={async () => {
                    await act(`/ops/orders/${order.id}/reject`, { reason });
                    setRejecting(false);
                  }}
                >
                  Reject order
                </button>
              </div>
            </Modal>
            <Modal open={!!rx} onClose={() => setRx(null)} title="Prescription" wide>
              {rx && <img src={rx} alt="Prescription" className="w-full rounded-xl" />}
            </Modal>
            {dispatching && <DispatchModal order={order} onClose={() => setDispatching(false)} onDone={setOrder} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function OpsOrders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const openId = params.get('open') ? Number(params.get('open')) : null;
  const { data, loading, reload } = useApi<OrderSummary[]>(`/ops/orders${status ? `?status=${status}` : ''}`);

  useEffect(() => {
    const s = getSocket();
    s.on('order:update', reload);
    return () => {
      s.off('order:update', reload);
    };
  }, [reload]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => set('status', t.key)}
            className={cx('shrink-0 rounded-lg px-3 py-2 text-sm font-medium', status === t.key ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : data?.length === 0 ? (
        <Empty icon={<Inbox className="h-6 w-6" />} title="No orders here" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Drop</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => set('open', String(o.id))}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {o.code} <PriorityBadge priority={o.priority} />
                    </div>
                    <div className="text-xs text-slate-400">{timeAgo(o.created_at)}</div>
                  </td>
                  <td className="px-4 py-3">{o.customer_name}</td>
                  <td className="max-w-[240px] px-4 py-3">
                    <div className="line-clamp-1 text-slate-600">{o.summary}</div>
                    <div className="text-xs text-slate-400">
                      {o.weight_g} g{!!o.has_rx && <span className="ml-1 font-semibold text-violet-600">· Rx</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {o.address_label}
                    <div className="text-xs text-slate-400">{km(o.distance_m)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                    {o.status === 'in_flight' && o.mission_phase && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600">
                        <Plane className="h-3 w-3" /> {PHASE_LABELS[o.mission_phase]}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{rupees(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId != null && <OrderDrawer id={openId} onClose={() => set('open', null)} />}
      <p className="flex items-center gap-1 text-xs text-slate-400">
        <ExternalLink className="h-3 w-3" /> Click a row to open it. Updates arrive live.
      </p>
    </div>
  );
}
