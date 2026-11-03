import { ArrowRight, BadgePercent, Crosshair, MapPin, PackageCheck, Radar as RadarIcon, ShieldCheck, Siren, Snowflake, Timer, Trees, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DroneArt } from '../components/DroneArt';
import { ConditionsCard, ConditionsPill, CountUp, Radar } from '../components/live';
import { ProductCard } from '../components/ProductCard';
import { CATEGORY_TONE, categoryIcon } from '../components/ProductIcon';
import { useApi, useAppConfig } from '../lib/api';
import { cx } from '../lib/format';
import { useConditions, usePublicFleet, usePublicStats } from '../lib/live';
import { PHASE_LABELS } from '../lib/phases';
import type { Product } from '../lib/types';
import { useUi } from '../store/ui';

const STEPS = [
  { icon: PackageCheck, title: 'Order in seconds', text: 'Pick medicines or a relief kit, drop a pin in 2D or 3D, choose priority.' },
  { icon: ShieldCheck, title: 'Pharmacist approves', text: 'Prescriptions are checked and the package is hooked into the gripper.' },
  { icon: MapPin, title: 'Autonomous flight', text: 'GPS autopilot at 25 m. Watch it live with ETA, altitude and battery.' },
  { icon: Crosshair, title: 'Precision rope drop', text: 'It hovers over your marker and winches the box down. No landing needed.' },
];

const USES = [
  { icon: Trees, title: 'Remote villages', text: 'Reach PHCs and homes cut off by bad roads.' },
  { icon: Waves, title: 'Flood relief', text: 'Purification tablets, blankets and kits to stranded families.' },
  { icon: Siren, title: 'Emergencies', text: 'Snakebite kits, epinephrine, glucose: minutes matter.' },
  { icon: Snowflake, title: 'Cold-chain', text: 'Insulin and vials in insulated 2–8 °C pouches.' },
];

export default function Home() {
  const config = useAppConfig();
  const fleet = usePublicFleet(1500);
  const stats = usePublicStats();
  const conditions = useConditions();
  const { data: featured } = useApi<Product[]>('/products?category=Emergency');
  const { data: categories } = useApi<{ name: string; count: number }[]>('/categories');
  const setSosOpen = useUi((s) => s.setSosOpen);
  const airborne = fleet?.filter((d) => d.armed) ?? [];

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-brand-400/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-20 top-0 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-[140px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 font-mono text-[11px] font-semibold text-brand-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-300" /> LIVE · {fleet ? airborne.length : '–'} AIRBORNE · {stats?.dronesOnline ?? '–'} ONLINE
              </span>
              <ConditionsPill c={conditions} />
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Medicine,
              <br />
              <span className="glow-text">from the sky.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-slate-400">
              An autonomous drone network that flies medicines and relief supplies to clinics, villages and flood zones, then winches them down to the exact spot.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary px-6 py-3 text-base">
                Order supplies <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/live" className="btn-secondary px-6 py-3 text-base">
                <RadarIcon className="h-4 w-4 text-brand-300" /> Watch live airspace
              </Link>
            </div>
            <dl className="mt-12 grid max-w-xl grid-cols-3 divide-x divide-white/[0.08] rounded-2xl border border-line bg-white/[0.03] backdrop-blur">
              {[
                { v: <CountUp value={stats?.delivered} />, l: 'deliveries' },
                { v: <CountUp value={stats?.avgDeliveryMin} decimals={1} suffix=" min" />, l: 'avg. flight' },
                { v: <CountUp value={stats?.successRate} suffix="%" />, l: 'success rate' },
              ].map((s) => (
                <div key={s.l} className="px-4 py-4">
                  <dt className="font-mono text-2xl font-semibold text-white">{s.v}</dt>
                  <dd className="hud mt-1">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="hud-frame relative rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden rounded-[28px]">
                <div className="h-24 w-full animate-scan bg-gradient-to-b from-transparent via-brand-400/10 to-transparent" />
              </div>
              <DroneArt className="relative w-full" />
              {[
                ['ALT', '25 m', 'left-4 top-6'],
                ['PAYLOAD', '300 g', 'right-4 top-24'],
                ['DROP ACC', '±20 cm', 'left-6 bottom-24'],
              ].map(([k, v, pos]) => (
                <div key={k} className={cx('absolute rounded-lg border border-brand-400/30 bg-ink/70 px-2.5 py-1.5 backdrop-blur', pos)}>
                  <div className="hud text-[9px] text-brand-400/80">{k}</div>
                  <div className="font-mono text-sm font-semibold text-white">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Live airspace ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="hud text-brand-400">Mission control · real time</div>
            <h2 className="mt-1 text-3xl font-bold text-white">Live airspace</h2>
          </div>
          <Link to="/live" className="btn-secondary">
            Open full view <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_320px]">
          <div className="card hud-frame flex items-center justify-center p-6 lg:col-span-1">
            {config ? <Radar hub={config.hub} radiusKm={config.serviceRadiusKm} drones={fleet ?? []} className="max-w-[360px]" /> : null}
          </div>
          <div className="card p-5">
            <div className="hud mb-3">Fleet telemetry</div>
            <ul className="space-y-2.5">
              {(fleet ?? []).map((d) => (
                <li key={d.id} className="rounded-xl border border-line bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-white">
                      <span className={cx('h-2 w-2 rounded-full', d.armed ? 'animate-pulse bg-emerald-400' : d.status === 'maintenance' ? 'bg-amber-400' : 'bg-slate-500')} />
                      {d.name} <span className="font-mono text-xs font-normal text-slate-500">{d.id}</span>
                    </span>
                    <span className="font-mono text-xs text-slate-400">{Math.round(d.batteryPct)}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-slate-500">
                    <span className={d.armed ? 'text-brand-300' : ''}>{d.status === 'maintenance' ? 'MAINTENANCE' : PHASE_LABELS[d.phase].toUpperCase()}</span>
                    <span>
                      ALT {d.altM.toFixed(0)}m · {(d.groundSpeedMs * 3.6).toFixed(0)} km/h
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={cx('h-full rounded-full', d.batteryPct < 30 ? 'bg-rose-400' : 'bg-gradient-to-r from-brand-400 to-violet-500')} style={{ width: `${d.batteryPct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <ConditionsCard c={conditions} />
        </div>
      </section>

      {/* ---------------- Categories ---------------- */}
      {categories && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <h2 className="text-3xl font-bold text-white">What we fly</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {categories.map((c) => {
              const Icon = categoryIcon(c.name);
              const tone = CATEGORY_TONE[c.name];
              return (
                <Link
                  key={c.name}
                  to={`/shop?category=${encodeURIComponent(c.name)}`}
                  className={cx('group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br p-4 transition hover:-translate-y-1 hover:border-white/20', tone?.tile, tone?.glow)}
                >
                  <Icon className="h-7 w-7 drop-shadow-[0_0_10px_currentColor]" strokeWidth={1.6} />
                  <div className="mt-6 text-sm font-semibold text-white">{c.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">{c.count} items</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------- How it works ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="max-w-2xl">
          <div className="hud text-brand-400">Mission sequence</div>
          <h2 className="mt-1 text-3xl font-bold text-white">From tap to doorstep in four steps</h2>
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card group relative overflow-hidden p-6">
              <span className="absolute right-4 top-3 font-mono text-5xl font-bold text-white/[0.04] transition group-hover:text-brand-400/10">0{i + 1}</span>
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-brand-400/30 bg-brand-400/10 text-brand-300 shadow-[0_0_24px_-8px_rgba(34,229,211,0.8)]">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- Welfare + SOS ---------------- */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-600/20 via-panel to-panel p-8">
          <BadgePercent className="h-10 w-10 text-violet-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
          <h3 className="mt-4 text-2xl font-bold text-white">Welfare subsidy: up to 50% off</h3>
          <p className="mt-2 text-sm text-slate-400">BPL, SC/ST and EWS families get direct price reductions and free drone delivery once their document is verified.</p>
          <Link to="/welfare" className="btn mt-6 bg-violet-500 text-white shadow-[0_0_28px_-6px_rgba(139,92,246,0.8)] hover:bg-violet-400">
            Verify eligibility <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-600/25 via-panel to-panel p-8">
          <Siren className="h-10 w-10 text-rose-300 drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
          <h3 className="mt-4 text-2xl font-bold text-white">Emergency? One tap.</h3>
          <p className="mt-2 text-sm text-slate-400">SOS sends an emergency kit to your location: free, auto-approved, and first in the dispatch queue.</p>
          <button onClick={() => setSosOpen(true)} className="btn-danger mt-6">
            Open SOS <Siren className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ---------------- Featured ---------------- */}
      {featured && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="hud text-rose-300">Priority stock</div>
              <h2 className="mt-1 text-3xl font-bold text-white">Emergency essentials</h2>
            </div>
            <Link to="/shop" className="hidden text-sm font-semibold text-brand-300 hover:underline sm:block">
              Browse all →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {featured.slice(0, 5).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Use cases ---------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="card p-8 md:p-12">
          <h2 className="text-3xl font-bold text-white">Built for places roads don’t reach fast</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {USES.map((u) => (
              <div key={u.title}>
                <u.icon className="h-7 w-7 text-brand-300" />
                <h3 className="mt-3 font-semibold text-white">{u.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{u.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-8 font-mono text-xs text-slate-500">
            <Timer className="h-4 w-4 text-brand-300" /> A 2 km trip that takes 25 min by road takes about 4 min by air.
          </div>
        </div>
      </section>
    </>
  );
}
