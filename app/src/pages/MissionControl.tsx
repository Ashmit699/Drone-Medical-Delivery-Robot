// Full-screen exhibition display: live order feed + the drone flying it, with the exact
// ArduPilot mission and flight mode. Works with the built-in simulator or real ArduPilot
// (SITL or the drone) through the bridge; a badge says which engine is flying.
import { Battery, Compass, Gauge, Mountain, Radio, Route, Satellite, Siren, Timer } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConditionsPill } from '../components/live';
import { LiveMap } from '../components/maps';
import { Spinner } from '../components/ui';
import { api, getSocket, useAppConfig } from '../lib/api';
import { cx, km, time, timeAgo } from '../lib/format';
import { useConditions, type PublicDrone } from '../lib/live';
import { PHASE_LABELS, PRIORITY_META, STATUS_META } from '../lib/phases';
import type { MissionPhase, OrderStatus, Priority, Telemetry } from '../lib/types';

const Map3D = lazy(() => import('../components/Map3D'));

interface DisplayOrder {
  id: number;
  code: string;
  priority: Priority;
  status: OrderStatus;
  phase: MissionPhase | null;
  itemCount: number;
  weightG: number;
  place: string;
  lat: number;
  lon: number;
  distanceM: number;
  droneId: string | null;
  droneName: string | null;
  createdAt: string;
  events: { id: number; type: string; message: string; at: string }[];
}
interface MissionItem {
  seq: number;
  command: number;
  label: string;
  phase?: MissionPhase;
}
interface DisplayState {
  orders: DisplayOrder[];
  missions: Record<string, MissionItem[]>;
}

const PHASE_ORDER: MissionPhase[] = ['idle', 'preflight', 'takeoff', 'cruise', 'approach', 'aligning', 'awaiting_clearance', 'lowering', 'releasing', 'retracting', 'returning', 'landing', 'completed', 'aborted'];
const rank = (p: MissionPhase) => PHASE_ORDER.indexOf(p);

const JOURNEY: { label: string; phases: MissionPhase[] }[] = [
  { label: 'Pre-flight', phases: ['preflight'] },
  { label: 'Take off', phases: ['takeoff'] },
  { label: 'Cruise', phases: ['cruise'] },
  { label: 'Approach', phases: ['approach', 'aligning'] },
  { label: 'Area clear?', phases: ['awaiting_clearance'] },
  { label: 'Lowering', phases: ['lowering'] },
  { label: 'Release', phases: ['releasing', 'retracting'] },
  { label: 'Return', phases: ['returning', 'landing'] },
  { label: 'Landed', phases: ['completed', 'aborted'] },
];

const asTelemetry = (d: PublicDrone): Telemetry =>
  ({ ...d, droneId: d.id, missionId: null, paused: false, batteryV: 0, distanceToTargetM: null, etaToDropS: null, updatedAt: Date.now() }) as Telemetry;

/** Index of the mission item the autopilot is working on, from the reported phase. */
function currentItem(items: MissionItem[], phase: MissionPhase | null) {
  if (!phase || phase === 'idle' || phase === 'preflight') return -1;
  if (phase === 'completed' || phase === 'aborted') return items.length;
  let idx = -1;
  for (const it of items) if (it.phase && rank(it.phase) <= rank(phase)) idx = it.seq;
  return idx;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-lg tabular-nums text-slate-300">{now.toLocaleTimeString('en-IN', { hour12: false })}</span>;
}

function Gauge_({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2">
      <div className="hud flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className={cx('mt-0.5 font-mono text-xl font-semibold tabular-nums text-white', tone)}>{value}</div>
    </div>
  );
}

export default function MissionControl() {
  const config = useAppConfig();
  const conditions = useConditions();
  const [state, setState] = useState<DisplayState | null>(null);
  const [fleet, setFleet] = useState<Record<string, PublicDrone & { adapter?: string }>>({});
  const [tele, setTele] = useState<Record<string, Telemetry>>({});
  const [banner, setBanner] = useState<DisplayOrder | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [log, setLog] = useState<{ id: number; code: string; message: string; at: string; type: string }[]>([]);
  const seenEvents = useRef(new Set<number>());
  const knownOrders = useRef(new Set<number>());
  const knownMissions = useRef(new Set<number>());

  const addLog = (o: DisplayOrder, events: DisplayOrder['events']) => {
    const add = events.filter((e) => !seenEvents.current.has(e.id));
    add.forEach((e) => seenEvents.current.add(e.id));
    if (add.length) setLog((l) => [...add.map((e) => ({ ...e, code: o.code })), ...l].sort((a, b) => b.id - a.id).slice(0, 40));
  };

  // Initial state + the fleet's names/engines (refreshed every few seconds).
  useEffect(() => {
    api<DisplayState>('/display/state').then((s) => {
      s.orders.forEach((o) => knownOrders.current.add(o.id));
      Object.keys(s.missions).forEach((id) => knownMissions.current.add(Number(id)));
      setState(s);
      s.orders.forEach((o) => addLog(o, o.events.slice(-2)));
    });
    const loadFleet = () =>
      api<(PublicDrone & { adapter?: string })[]>('/public/fleet').then((f) => {
        setFleet(Object.fromEntries(f.map((d) => [d.id, d])));
        setTele((t) => ({ ...Object.fromEntries(f.map((d) => [d.id, asTelemetry(d)])), ...t }));
      });
    loadFleet();
    const id = setInterval(loadFleet, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates from the 'display' room.
  useEffect(() => {
    const s = getSocket();
    const join = () => s.emit('display');
    join();
    s.on('connect', join);
    const onTele = (t: Telemetry) => setTele((m) => ({ ...m, [t.droneId]: t }));
    const onOrder = (o: DisplayOrder) => {
      if (!knownOrders.current.has(o.id)) {
        knownOrders.current.add(o.id);
        setBanner(o);
        setFresh((f) => new Set(f).add(o.id));
        setTimeout(() => setBanner((b) => (b?.id === o.id ? null : b)), 7000);
        setTimeout(
          () =>
            setFresh((f) => {
              const n = new Set(f);
              n.delete(o.id);
              return n;
            }),
          15000,
        );
      }
      setState((st) => {
        if (!st) return st;
        const exists = st.orders.some((x) => x.id === o.id);
        return { ...st, orders: exists ? st.orders.map((x) => (x.id === o.id ? o : x)) : [o, ...st.orders].slice(0, 15) };
      });
      addLog(o, o.events.slice(-1));
      // A newly approved/dispatched order needs its ArduPilot mission plan.
      if (['approved', 'in_flight'].includes(o.status) && !knownMissions.current.has(o.id)) {
        knownMissions.current.add(o.id);
        api<DisplayState>('/display/state').then((n) => setState((cur) => (cur ? { ...cur, missions: { ...cur.missions, ...n.missions } } : n)));
      }
    };
    s.on('telemetry', onTele);
    s.on('display:order', onOrder);
    return () => {
      s.off('connect', join);
      s.off('telemetry', onTele);
      s.off('display:order', onOrder);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The order the big screen follows: the latest one in flight, else the latest approved, else the newest.
  const active = useMemo(() => {
    const os = state?.orders ?? [];
    return os.find((o) => o.status === 'in_flight') ?? os.find((o) => o.status === 'approved') ?? os[0] ?? null;
  }, [state]);

  if (!config || !state) {
    return (
      <div className="grid h-screen place-items-center bg-void">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  const drones = Object.values(tele);
  const droneId = active?.droneId ?? drones.find((d) => d.armed)?.droneId ?? 'MDR-01';
  const t = tele[droneId];
  const engine = fleet[droneId]?.adapter === 'bridge' ? 'ArduPilot · MAVLink' : 'Built-in simulator';
  const flying = active?.status === 'in_flight';
  const phase: MissionPhase | null = flying ? (t?.phase ?? active?.phase ?? null) : active?.status === 'delivered' ? 'completed' : null;
  const items = active ? state.missions[active.id] ?? [] : [];
  const cur = currentItem(items, phase);
  const journeyIdx = phase ? JOURNEY.findIndex((j) => j.phases.includes(phase)) : -1;
  const waiting = flying && phase === 'awaiting_clearance';
  const ropePct = t ? Math.min(100, (t.payload.ropeM / config.flight.dropAltM) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-void text-slate-200 2xl:h-screen 2xl:overflow-hidden">
      {/* ---------- header ---------- */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] bg-ink/70 px-4 py-3 backdrop-blur sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 font-bold text-slate-950">+</span>
          <span className="font-[family-name:var(--font-display)] text-xl font-bold text-white">
            Medi<span className="glow-text">Drop</span>
          </span>
        </Link>
        <span className="hud text-sm text-brand-400">// Mission control</span>
        <span className="ml-4 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> LIVE
        </span>
        <ConditionsPill c={conditions} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {Object.values(fleet).map((d) => (
            <span
              key={d.id}
              className={cx(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1 font-mono text-xs',
                d.adapter === 'bridge' ? 'border-violet-400/40 bg-violet-500/10 text-violet-200' : 'border-line bg-white/[0.03] text-slate-400',
              )}
            >
              <span className={cx('h-1.5 w-1.5 rounded-full', tele[d.id]?.armed ? 'animate-pulse bg-emerald-400' : tele[d.id]?.connected ? 'bg-slate-400' : 'bg-rose-500')} />
              {d.id} · {d.adapter === 'bridge' ? 'ArduPilot' : 'SIM'}
            </span>
          ))}
          <Clock />
        </div>
      </header>

      {/* ---------- body ---------- */}
      {/* TV (2xl+): feed | map | details. Narrower windows (split screen): map first, then details and feed, scrolling. */}
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2 2xl:min-h-0 2xl:flex-1 2xl:grid-cols-[360px_1fr_430px]">
        {/* Order feed */}
        <section className="card order-3 flex max-h-[480px] min-h-0 flex-col p-4 2xl:order-none 2xl:max-h-none">
          <div className="mb-3 flex items-center justify-between">
            <div className="hud text-brand-400">Incoming orders</div>
            <span className="font-mono text-xs text-slate-500">{state.orders.length} recent</span>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {state.orders.map((o) => (
              <li
                key={o.id}
                className={cx(
                  'rounded-xl border p-3 transition',
                  fresh.has(o.id) ? 'animate-fade-up border-brand-400/70 bg-brand-400/10' : o.id === active?.id ? 'border-violet-400/50 bg-violet-500/10' : 'border-line bg-white/[0.02]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-white">{o.code}</span>
                  <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold', PRIORITY_META[o.priority].tone)}>{PRIORITY_META[o.priority].label}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {o.itemCount} item{o.itemCount > 1 ? 's' : ''} · {o.weightG} g → {o.place}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', STATUS_META[o.status].tone)}>
                    {o.status === 'in_flight' && o.phase ? PHASE_LABELS[o.phase] : STATUS_META[o.status].label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{timeAgo(o.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Map */}
        <section className="card relative order-1 h-[60vh] min-h-[380px] overflow-hidden lg:col-span-2 2xl:order-none 2xl:col-span-1 2xl:h-auto 2xl:min-h-0">
          <LiveMap
            hub={config.hub}
            targets={active && ['approved', 'in_flight'].includes(active.status) ? [{ lat: active.lat, lon: active.lon }] : []}
            drones={drones}
            activeDroneId={droneId}
            className="h-full w-full"
          />
          {active && (
            <div className="absolute left-4 top-4 z-[400] rounded-2xl border border-white/10 bg-ink/85 px-4 py-3 backdrop-blur-xl">
              <div className="hud text-brand-400">{flying ? 'Mission in progress' : 'Latest order'}</div>
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
                {active.code} <span className="text-base font-medium text-slate-400">→ {active.place}</span>
              </div>
              <div className="font-mono text-xs text-slate-400">
                {km(active.distanceM)} · {active.droneName ? `${active.droneName} (${active.droneId})` : 'awaiting dispatch'}
              </div>
            </div>
          )}
          {waiting && (
            <div className="absolute inset-x-4 top-28 z-[400] mx-auto max-w-xl animate-glow rounded-2xl border-2 border-amber-400 bg-amber-500/20 px-6 py-3 text-center backdrop-blur">
              <div className="font-[family-name:var(--font-display)] text-lg font-bold text-amber-200 sm:text-2xl">HOVERING · WAITING FOR “AREA CLEAR”</div>
              <div className="text-sm text-amber-100/80">A person at the drop zone must confirm before the package is lowered</div>
            </div>
          )}
          {/* journey bar */}
          <div className="absolute inset-x-4 bottom-4 z-[400] rounded-2xl border border-white/10 bg-ink/85 p-3 backdrop-blur-xl">
            <div className="grid grid-cols-9 gap-1">
              {JOURNEY.map((j, i) => (
                <div key={j.label} className="text-center">
                  <div
                    className={cx(
                      'h-1.5 rounded-full',
                      i < journeyIdx || (i === journeyIdx && phase === 'completed') ? 'bg-brand-400' : i === journeyIdx ? (waiting ? 'animate-pulse bg-amber-400' : 'animate-pulse bg-violet-400') : 'bg-white/10',
                    )}
                  />
                  <div className={cx('mt-1.5 hidden font-mono text-[11px] sm:block', i === journeyIdx ? 'font-semibold text-white' : 'text-slate-500')}>{j.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right: chase-cam, telemetry, ArduPilot mission */}
        <section className="order-2 flex min-h-0 flex-col gap-4 2xl:order-none">
          <div className="card relative h-56 shrink-0 overflow-hidden">
            <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
              {t && <Map3D config={config} target={active && flying ? { lat: active.lat, lon: active.lon } : null} drone={t} chase className="h-56 w-full" />}
            </Suspense>
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-emerald-300">CHASE CAM // {droneId}</div>
            <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-violet-200">{engine}</div>
          </div>

          <div className="card shrink-0 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="hud text-brand-400">Telemetry · {droneId}</div>
              <span className={cx('rounded px-2 py-0.5 font-mono text-xs font-bold', t?.armed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-400')}>
                {t?.armed ? 'ARMED' : 'DISARMED'} · {t?.mode ?? '—'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Gauge_ icon={<Mountain className="h-3 w-3" />} label="Alt" value={t ? `${t.altM.toFixed(1)} m` : '—'} />
              <Gauge_ icon={<Gauge className="h-3 w-3" />} label="Speed" value={t ? `${(t.groundSpeedMs * 3.6).toFixed(0)} km/h` : '—'} />
              <Gauge_ icon={<Compass className="h-3 w-3" />} label="Heading" value={t ? `${Math.round(t.headingDeg)}°` : '—'} />
              <Gauge_ icon={<Battery className="h-3 w-3" />} label="Battery" value={t ? `${Math.round(t.batteryPct)}%` : '—'} tone={t && t.batteryPct < 30 ? 'text-rose-300' : undefined} />
              <Gauge_ icon={<Satellite className="h-3 w-3" />} label="GPS" value={t ? `${t.gpsSats} sats` : '—'} />
              <Gauge_ icon={<Timer className="h-3 w-3" />} label="ETA" value={t?.etaToDropS != null && flying ? `${t.etaToDropS}s` : '—'} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="hud w-20">Rope</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-violet-500 transition-all" style={{ width: `${ropePct}%` }} />
              </div>
              <span className="w-28 text-right font-mono text-xs text-slate-300">
                {t ? `${t.payload.ropeM.toFixed(1)} m · ${t.payload.gripper}` : '—'}
              </span>
            </div>
          </div>

          <div className="card flex min-h-0 flex-col p-4 2xl:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <div className="hud flex items-center gap-1.5 text-violet-300">
                <Route className="h-3 w-3" /> ArduPilot mission
              </div>
              <span className="font-mono text-[11px] text-slate-500">{items.length ? `${items.length} items · AUTO` : 'no mission yet'}</span>
            </div>
            <ol className="min-h-0 space-y-1 overflow-y-auto 2xl:flex-1">
              {items.map((it) => (
                <li
                  key={it.seq}
                  className={cx(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
                    it.seq === cur ? (waiting ? 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/50' : 'bg-violet-500/15 text-white ring-1 ring-violet-400/50') : it.seq < cur ? 'text-slate-500' : 'text-slate-300',
                  )}
                >
                  <span className="w-4 font-mono text-slate-500">{it.seq}</span>
                  <span className="w-12 font-mono text-brand-300">{it.command}</span>
                  <span className="flex-1">{it.label}</span>
                  {it.seq < cur && <span className="font-mono text-[10px] text-brand-400">✓</span>}
                  {it.seq === cur && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />}
                </li>
              ))}
              {!items.length && <li className="py-6 text-center text-sm text-slate-500">Waiting for an order to be approved…</li>}
            </ol>
          </div>
        </section>
      </div>

      {/* ---------- flight log ticker ---------- */}
      <footer className="flex h-24 shrink-0 gap-4 border-t border-white/[0.06] bg-ink/70 px-4 py-3 sm:px-6">
        <div className="hud hidden w-36 shrink-0 items-start gap-1.5 pt-1 text-brand-400 sm:flex">
          <Radio className="h-3 w-3" /> Flight log
        </div>
        <ul className="min-w-0 flex-1 space-y-0.5 overflow-hidden font-mono text-xs">
          {log.slice(0, 4).map((e, i) => (
            <li key={e.id} className={cx('flex gap-3 truncate', i === 0 ? 'text-white' : 'text-slate-500')}>
              <span className="tabular-nums text-slate-500">{time(e.at)}</span>
              <span className={e.type === 'placed' ? 'text-brand-300' : e.type.includes('clearance') ? 'text-amber-300' : 'text-violet-300'}>{e.code}</span>
              <span className="truncate">{e.message}</span>
            </li>
          ))}
        </ul>
        <div className="hidden w-80 shrink-0 text-right text-xs text-slate-500 xl:block">
          Engine for {droneId}: <b className="text-slate-300">{engine}</b>
          <br />
          Order on the app → watch it here
        </div>
      </footer>

      {/* ---------- new-order banner ---------- */}
      {banner && (
        <div className="pointer-events-none fixed inset-x-4 top-20 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] animate-fade-up">
          <div
            className={cx(
              'flex items-center gap-4 rounded-2xl border-2 px-8 py-4 shadow-2xl backdrop-blur-xl',
              banner.priority === 'emergency' ? 'border-rose-400 bg-rose-600/30' : 'border-brand-400 bg-brand-500/20',
            )}
          >
            {banner.priority === 'emergency' ? <Siren className="h-10 w-10 text-rose-200" /> : <span className="h-4 w-4 animate-ping rounded-full bg-brand-300" />}
            <div>
              <div className="hud text-white/70">New order received</div>
              <div className="font-[family-name:var(--font-display)] text-xl font-bold text-white sm:text-3xl">
                {banner.code} · {PRIORITY_META[banner.priority].label}
              </div>
              <div className="text-sm text-white/80">
                {banner.itemCount} item{banner.itemCount > 1 ? 's' : ''} · {banner.weightG} g → {banner.place}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
