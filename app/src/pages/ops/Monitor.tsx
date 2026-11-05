import { Anchor, Battery, Compass, Crosshair, Gauge, Hand, Home, Lock, Mountain, Package, PackageOpen, Pause, Play, Plane, Satellite, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LiveMap } from '../../components/maps';
import { ErrorNote, HoldButton, PageLoader, Stat } from '../../components/ui';
import { api, getSocket, useApi, useAppConfig } from '../../lib/api';
import { cx } from '../../lib/format';
import { PHASE_LABELS } from '../../lib/phases';
import type { LatLon, OrderSummary, Telemetry } from '../../lib/types';
import { useFleet } from '../../lib/useFleet';

const CAN_PAUSE = ['cruise', 'approach', 'returning'];
// Same rule as the bridge: the box opens only on the ground (loading) or hovering over the drop point.
const BOX_OPEN_PHASES = ['awaiting_clearance', 'lowering', 'releasing', 'retracting'];
const CAN_RTL = ['preflight', 'takeoff', 'cruise', 'approach', 'aligning', 'awaiting_clearance', 'lowering'];

export default function Monitor() {
  const config = useAppConfig();
  const { drones } = useFleet();
  const { data: flights, reload } = useApi<OrderSummary[]>('/ops/orders?status=in_flight');
  const [targets, setTargets] = useState<Record<number, LatLon>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();
    s.on('order:update', reload);
    return () => {
      s.off('order:update', reload);
    };
  }, [reload]);

  // Drop-zone coordinates for active flights.
  useEffect(() => {
    flights?.forEach((f) => {
      if (!targets[f.id]) api<LatLon>(`/ops/orders/${f.id}`).then((o) => setTargets((t) => ({ ...t, [f.id]: { lat: o.lat, lon: o.lon } })));
    });
  }, [flights, targets]);

  useEffect(() => {
    if (!selected && drones.length) setSelected((drones.find((d) => d.status === 'in_flight') ?? drones[0]).id);
  }, [drones, selected]);

  const targetList = useMemo(() => (flights ?? []).map((f) => targets[f.id]).filter((x): x is LatLon => !!x), [flights, targets]);

  if (!config || drones.length === 0) return <PageLoader />;
  const drone = drones.find((d) => d.id === selected) ?? drones[0];
  const t = drone.telemetry;
  const flight = flights?.find((f) => f.drone_id === drone.id);
  const ropePct = t ? Math.min(100, (t.payload.ropeM / config.flight.dropAltM) * 100) : 0;

  const command = async (type: 'PAUSE' | 'RESUME' | 'RTL' | 'BOX_OPEN' | 'BOX_CLOSE') => {
    setError(null);
    try {
      await api(`/ops/drones/${drone.id}/command`, { body: { type } });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Live monitor</h1>
        <div className="flex gap-2">
          {drones.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold',
                d.id === drone.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-line bg-panel text-slate-300',
              )}
            >
              <span className={cx('h-2 w-2 rounded-full', d.telemetry?.armed ? 'animate-pulse bg-emerald-500' : d.telemetry?.connected ? 'bg-slate-400' : 'bg-red-500')} />
              {d.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden">
          <LiveMap
            hub={config.hub}
            targets={targetList}
            drones={drones.map((d) => d.telemetry).filter((x): x is Telemetry => x != null)}
            activeDroneId={drone.id}
            onSelectDrone={setSelected}
            className="h-[420px] w-full xl:h-[calc(100vh-180px)]"
          />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold">
                  {drone.name} <span className="text-sm font-normal text-slate-500">{drone.id}</span>
                </div>
                <div className="text-xs text-slate-400">{drone.model}</div>
              </div>
              <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold', t?.armed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-400')}>
                {t?.armed ? 'ARMED' : 'DISARMED'}
              </span>
            </div>
            {!t?.connected && (
              <div className="mt-3">
                <ErrorNote>No link to this drone.{drone.adapter === 'bridge' ? ' Start drone-bridge/bridge.py.' : ''}</ErrorNote>
              </div>
            )}
            {t && (
              <>
                <div className="mt-4 rounded-xl bg-ink px-4 py-3 text-white">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">Phase · mode</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="font-semibold">{t.paused ? 'Paused, holding position' : PHASE_LABELS[t.phase]}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">{t.mode}</span>
                  </div>
                  {flight && (
                    <Link to={`/ops/orders?open=${flight.id}`} className="mt-1 block text-xs text-brand-300 hover:underline">
                      Delivering {flight.code} → {flight.address_label}
                    </Link>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat icon={<Mountain className="h-3.5 w-3.5" />} label="Altitude" value={`${t.altM.toFixed(1)} m`} />
                  <Stat icon={<Gauge className="h-3.5 w-3.5" />} label="Speed" value={`${t.groundSpeedMs.toFixed(1)} m/s`} />
                  <Stat icon={<Compass className="h-3.5 w-3.5" />} label="Heading" value={`${Math.round(t.headingDeg)}°`} />
                  <Stat
                    icon={<Battery className="h-3.5 w-3.5" />}
                    label="Battery"
                    value={<span className={t.batteryPct < 30 ? 'text-red-400' : ''}>{Math.round(t.batteryPct)}%</span>}
                    hint={`${t.batteryV.toFixed(2)} V`}
                  />
                  <Stat icon={<Satellite className="h-3.5 w-3.5" />} label="GPS" value={`${t.gpsSats} sats`} />
                  <Stat icon={<Crosshair className="h-3.5 w-3.5" />} label="Marker" value={t.markerErrorCm != null ? `±${Math.round(t.markerErrorCm)} cm` : '—'} />
                </div>
              </>
            )}
          </div>

          {t && (
            <div className="card p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Anchor className="h-4 w-4 text-brand-400" /> Payload · winch
              </div>
              <div className="mt-3 flex gap-3">
                <div className="relative h-28 w-10 overflow-hidden rounded-lg bg-white/[0.06]" aria-label={`Rope ${ropePct.toFixed(0)}% out`}>
                  <div className="absolute inset-x-0 top-0 bg-brand-500/25 transition-all" style={{ height: `${ropePct}%` }} />
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <dt className="text-xs text-slate-400">Rope out</dt>
                    <dd className="font-semibold tabular-nums">{t.payload.ropeM.toFixed(2)} m</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <dt className="text-xs text-slate-400">Winch</dt>
                    <dd className="font-semibold capitalize">{t.payload.winch}</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <dt className="text-xs text-slate-400">Gripper</dt>
                    <dd className={cx('font-semibold capitalize', t.payload.gripper === 'open' && 'text-amber-400')}>{t.payload.gripper}</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <dt className="text-xs text-slate-400">Package</dt>
                    <dd className="font-semibold">{t.payload.loaded ? 'On board' : 'None'}</dd>
                  </div>
                </dl>
              </div>
              <div className="mt-4 rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {t.payload.box === 'open' ? <PackageOpen className="h-4 w-4 text-amber-400" /> : <Package className="h-4 w-4 text-brand-400" />}
                    Storage box
                  </span>
                  <span
                    className={cx(
                      'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase',
                      t.payload.box === 'open' ? 'bg-amber-500/15 text-amber-300' : t.payload.box === 'closed' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-400',
                    )}
                  >
                    {t.payload.box === 'unknown' ? 'No servo signal' : t.payload.box}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="btn-secondary"
                    disabled={t.armed && !BOX_OPEN_PHASES.includes(t.phase)}
                    title={t.armed && !BOX_OPEN_PHASES.includes(t.phase) ? 'Only on the ground or hovering over the drop point' : undefined}
                    onClick={() => command('BOX_OPEN')}
                  >
                    <PackageOpen className="h-4 w-4" /> Open box
                  </button>
                  <button className="btn-secondary" onClick={() => command('BOX_CLOSE')}>
                    <Lock className="h-4 w-4" /> Close box
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Servo on output 8. During a delivery the box opens by itself after "Area clear" and closes before the drone climbs away.
                </p>
              </div>
            </div>
          )}

          {t && (
            <div className="card space-y-3 p-5">
              <div className="font-semibold">Controls</div>
              <ErrorNote>{error}</ErrorNote>
              {t.phase === 'awaiting_clearance' && flight && (
                <HoldButton
                  className="btn w-full bg-amber-500 text-white hover:bg-amber-600"
                  onComplete={() => api(`/orders/${flight.id}/clearance`, { body: {} }).catch((e) => setError(e.message))}
                >
                  <Hand className="h-4 w-4" /> Hold: area clear, lower package
                </HoldButton>
              )}
              <div className="grid grid-cols-2 gap-2">
                {t.paused ? (
                  <button className="btn-secondary" onClick={() => command('RESUME')}>
                    <Play className="h-4 w-4" /> Resume
                  </button>
                ) : (
                  <button className="btn-secondary" disabled={!CAN_PAUSE.includes(t.phase)} onClick={() => command('PAUSE')}>
                    <Pause className="h-4 w-4" /> Pause (hold)
                  </button>
                )}
                <HoldButton className="btn-danger" disabled={!CAN_RTL.includes(t.phase)} onComplete={() => command('RTL')}>
                  <Home className="h-4 w-4" /> Hold: return home
                </HoldButton>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-slate-400">
                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Return home reels the rope in first if a package is being lowered. On the real drone, the RC safety pilot can always take over.
              </p>
            </div>
          )}
          {!t?.armed && (
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-sm text-slate-300">
              <Plane className="h-4 w-4 shrink-0" /> On the ground. Dispatch an approved order from{' '}
              <Link to="/ops/orders?status=approved" className="font-semibold text-brand-300">
                Orders
              </Link>
              .
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
