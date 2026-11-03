// Public "mission control" view: every drone on the map, an onboard chase-cam of the selected one,
// live telemetry, weather go/no-go and the radar. Anonymous: no customer data.
import { Battery, Crosshair, Gauge, Lock, Mountain, Satellite, Unlock, Wind } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConditionsCard, Radar } from '../components/live';
import { LiveMap } from '../components/maps';
import { PageLoader, Spinner } from '../components/ui';
import { useAppConfig } from '../lib/api';
import { cx } from '../lib/format';
import { useConditions, usePublicFleet, type PublicDrone } from '../lib/live';
import { PHASE_LABELS } from '../lib/phases';
import type { Telemetry } from '../lib/types';

const Map3D = lazy(() => import('../components/Map3D'));

const asTelemetry = (d: PublicDrone): Telemetry =>
  ({ ...d, droneId: d.id, missionId: null, paused: false, batteryV: 0, distanceToTargetM: null, etaToDropS: null, updatedAt: Date.now() }) as Telemetry;

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] p-3">
      <div className="hud flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className={cx('mt-1 font-mono text-base font-semibold text-white', tone)}>{value}</div>
    </div>
  );
}

export default function Live() {
  const config = useAppConfig();
  const fleet = usePublicFleet(700);
  const conditions = useConditions();
  const [selected, setSelected] = useState<string | null>(null);

  // Follow the first airborne drone unless the viewer picked one.
  useEffect(() => {
    if (!fleet?.length) return;
    if (!selected || !fleet.some((d) => d.id === selected)) setSelected((fleet.find((d) => d.armed) ?? fleet[0]).id);
  }, [fleet, selected]);

  const telemetry = useMemo(() => (fleet ?? []).map(asTelemetry), [fleet]);
  if (!config || !fleet) return <PageLoader />;

  const d = fleet.find((x) => x.id === selected) ?? fleet[0];
  const airborne = fleet.filter((x) => x.armed).length;
  const secured = d.payload.gripper === 'closed';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="hud flex items-center gap-2 text-emerald-300">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" /> Live telemetry feed
          </div>
          <h1 className="mt-2 text-4xl font-bold text-white">Live airspace</h1>
          <p className="mt-1 text-slate-400">Every MediDrop drone in real time, with an onboard chase-cam of the one you select.</p>
        </div>
        <div className="flex gap-2">
          {[
            ['Airborne', airborne],
            ['Online', fleet.filter((x) => x.connected).length],
            ['Service zone', `${config.serviceRadiusKm} km`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-white/[0.04] px-4 py-2.5 text-center backdrop-blur">
              <div className="hud">{k}</div>
              <div className="font-mono text-lg font-semibold text-white">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Map */}
        <div className="card relative overflow-hidden">
          <LiveMap hub={config.hub} drones={telemetry} activeDroneId={d.id} onSelectDrone={setSelected} className="h-[440px] w-full lg:h-[560px]" />
          <div className="absolute right-3 top-3 z-[400] flex gap-1.5">
            {fleet.map((x) => (
              <button
                key={x.id}
                onClick={() => setSelected(x.id)}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold backdrop-blur',
                  x.id === d.id ? 'border-brand-400/60 bg-brand-400/15 text-brand-200' : 'border-white/10 bg-ink/70 text-slate-400',
                )}
              >
                <span className={cx('h-1.5 w-1.5 rounded-full', x.armed ? 'animate-pulse bg-emerald-400' : 'bg-slate-500')} />
                {x.id}
              </button>
            ))}
          </div>
          <div className="absolute inset-x-3 bottom-3 z-[400] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink/80 px-4 py-3 backdrop-blur-xl">
            <div>
              <div className="hud text-brand-400/80">{d.name} · {d.id}</div>
              <div className="text-sm font-semibold text-white">{d.status === 'maintenance' ? 'In maintenance' : PHASE_LABELS[d.phase]}</div>
            </div>
            <div className="flex gap-5 font-mono text-sm">
              <div>
                <div className="hud">Alt</div>
                <div className="text-white">{d.altM.toFixed(1)} m</div>
              </div>
              <div>
                <div className="hud">Speed</div>
                <div className="text-white">{(d.groundSpeedMs * 3.6).toFixed(0)} km/h</div>
              </div>
              <div>
                <div className="hud">Mode</div>
                <div className="text-brand-300">{d.mode}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Onboard cam + telemetry */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="font-semibold text-white">Onboard chase-cam</div>
              <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-rose-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> REC
              </span>
            </div>
            <div className="relative h-64">
              <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
                <Map3D config={config} target={null} drone={asTelemetry(d)} chase className="h-64 w-full" />
              </Suspense>
              {/* scanlines + HUD overlay */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.22)_50%)] [background-size:100%_3px]" />
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <Crosshair className="h-10 w-10 text-brand-300/60" strokeWidth={1} />
              </div>
              <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-ink/70 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                CAM_01 // {d.id} // {d.armed ? 'TRACKING' : 'STANDBY'}
              </div>
              <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-ink/70 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                {d.position.lat.toFixed(5)}°N {d.position.lon.toFixed(5)}°E
              </div>
            </div>
            {!d.armed && (
              <div className="border-t border-line px-4 py-3 text-xs text-slate-400">
                No drone is airborne right now. <Link to="/shop" className="font-semibold text-brand-300">Place an order</Link> and watch it fly here.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Tile icon={<Battery className="h-3 w-3" />} label="Battery" value={`${Math.round(d.batteryPct)}%`} tone={d.batteryPct < 30 ? 'text-rose-300' : undefined} />
            <Tile icon={<Wind className="h-3 w-3" />} label="Wind" value={conditions?.available ? `${Math.round(conditions.windKmh ?? 0)} km/h` : '—'} />
            <Tile icon={<Satellite className="h-3 w-3" />} label="GPS" value={`${d.gpsSats} sats`} />
            <Tile icon={<Gauge className="h-3 w-3" />} label="Marker lock" value={d.markerErrorCm != null ? `±${Math.round(d.markerErrorCm)} cm` : '—'} />
            <Tile icon={<Mountain className="h-3 w-3" />} label="Rope out" value={`${d.payload.ropeM.toFixed(2)} m`} />
            <Tile
              icon={secured ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              label="Payload"
              value={d.payload.loaded ? (secured ? 'SECURED' : 'RELEASING') : 'EMPTY'}
              tone={d.payload.loaded ? 'text-brand-300' : 'text-slate-400'}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="card flex items-center justify-center p-6">
          <Radar hub={config.hub} radiusKm={config.serviceRadiusKm} drones={fleet} className="max-w-[420px]" />
        </div>
        <ConditionsCard c={conditions} />
      </div>
    </div>
  );
}
