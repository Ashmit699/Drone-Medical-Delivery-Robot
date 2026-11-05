import {
  ArrowRight, BadgeCheck, Baby, Clock, Crosshair, HeartPulse, PackageCheck, Quote, Radar as RadarIcon, Search, ShieldCheck, Siren, Snowflake, Star, Syringe, Timer, Zap,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DroneArt } from '../components/DroneArt';
import { CountUp } from '../components/live';
import { ProductCard } from '../components/ProductCard';
import { CATEGORY_TONE, categoryIcon } from '../components/ProductIcon';
import { useApi, useAppConfig } from '../lib/api';
import { cx, rupees } from '../lib/format';
import { usePublicStats } from '../lib/live';
import type { Product } from '../lib/types';
import { useUi } from '../store/ui';

const STEPS = [
  { icon: PackageCheck, title: 'Tell us what you need', text: 'Pick the medicine or kit and drop a pin where you are.' },
  { icon: Zap, title: 'Auto-approved instantly', text: 'Every order is an emergency. No queue, no payment screen.' },
  { icon: Timer, title: 'Full-speed flight', text: 'The next drone takes off at top speed, straight over traffic.' },
  { icon: Crosshair, title: 'Lowered to your hands', text: 'It hovers above you and winches the box down on a rope.' },
];

const ADS = [
  {
    icon: Syringe,
    tag: 'Diabetes care',
    title: 'Insulin running low at midnight?',
    text: 'Cold-chain insulin pens and glucose gel, kept at 2–8 °C all the way to your door.',
    cta: 'Diabetes essentials',
    to: '/shop?q=glucose',
    tone: 'from-sky-500/25 border-sky-400/30 text-sky-300',
  },
  {
    icon: HeartPulse,
    tag: 'Heart & breathing',
    title: 'Chest pain or an asthma attack?',
    text: 'Chewable aspirin and reliever inhalers flown to you while you call 108.',
    cta: 'Critical medicines',
    to: '/shop?category=Emergency',
    tone: 'from-rose-500/25 border-rose-400/30 text-rose-300',
  },
  {
    icon: Baby,
    tag: 'Mother & baby',
    title: 'Baby has a fever tonight?',
    text: 'Paediatric fever drops, ORS and a digital thermometer: no late-night pharmacy run.',
    cta: 'Mother & baby',
    to: '/shop?category=Mother%20%26%20Baby',
    tone: 'from-violet-500/25 border-violet-400/30 text-violet-300',
  },
];

const REVIEWS = [
  { name: 'Priya S.', place: 'Sector 9', text: 'My father’s inhaler ran out at 11 pm. The drone was over our terrace in 7 minutes. We paid nothing.' },
  { name: 'Dr. R. Mehta', place: 'Primary Health Centre', text: 'Anti-venom reached our PHC faster than the ambulance could have. It changes how we handle snakebites.' },
  { name: 'Anil K.', place: 'Lake View Road', text: 'The Family plan costs less than one auto ride a week. It’s peace of mind for my parents.' },
];

function HeroSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop');
  };
  return (
    <form onSubmit={submit} role="search" className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-line bg-white/[0.04] p-2 backdrop-blur">
      <Search className="ml-2 h-5 w-5 shrink-0 text-slate-500" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search medicines, kits, inhalers…"
        className="min-w-0 flex-1 bg-transparent px-1 py-2 text-white outline-none placeholder:text-slate-500"
        aria-label="Search medicines"
      />
      <button className="btn-primary shrink-0 px-5">Search</button>
    </form>
  );
}

export default function Home() {
  const config = useAppConfig();
  const stats = usePublicStats();
  const { data: featured } = useApi<Product[]>('/products?category=Emergency');
  const { data: categories } = useApi<{ name: string; count: number }[]>('/categories');
  const setSosOpen = useUi((s) => s.setSosOpen);
  const speedKmh = config ? Math.round(config.flight.cruiseSpeedMs * 3.6) : 54;

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-16">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" /> 24×7 emergency medicine delivery
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] text-white sm:text-6xl">
              Emergency medicines,
              <br />
              <span className="glow-text">at your door in minutes.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-400">
              When every minute counts, a MediDrop drone flies the medicine you need straight to you. Members never pay per order: it’s all covered by one small monthly plan.
            </p>
            <HeroSearch />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary px-6 py-3 text-base">
                Order now <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={() => setSosOpen(true)} className="btn-danger px-6 py-3 text-base">
                <Siren className="h-4 w-4" /> SOS kit
              </button>
              <Link to="/plans" className="btn-secondary px-6 py-3 text-base">
                <ShieldCheck className="h-4 w-4 text-emerald-300" /> Plans from ₹99/mo
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand-300" /> Avg. arrival <b className="text-white">{stats?.avgDeliveryMin ?? '~6'} min</b></span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-brand-300" /> Pharmacist-verified</span>
              <span className="flex items-center gap-1.5"><Snowflake className="h-4 w-4 text-brand-300" /> Cold-chain ready</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="hud-frame relative rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
              <DroneArt className="relative w-full" />
              {[
                ['TOP SPEED', `${speedKmh} km/h`, 'left-4 top-6'],
                ['YOU PAY', rupees(0), 'right-4 top-24'],
                ['APPROVAL', 'Instant', 'left-6 bottom-24'],
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

      {/* ---------------- Trust strip ---------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <dl className="grid grid-cols-2 divide-white/[0.08] rounded-2xl border border-line bg-white/[0.03] sm:grid-cols-4 sm:divide-x">
          {[
            { v: <CountUp value={stats?.delivered} />, l: 'emergencies delivered' },
            { v: <CountUp value={stats?.avgDeliveryMin} decimals={1} suffix=" min" />, l: 'average arrival' },
            { v: <CountUp value={stats?.successRate} suffix="%" />, l: 'successful drops' },
            { v: `${config?.serviceRadiusKm ?? 1.3} km`, l: 'service radius' },
          ].map((s) => (
            <div key={s.l} className="px-5 py-4">
              <dt className="font-mono text-2xl font-semibold text-white">{s.v}</dt>
              <dd className="mt-1 text-xs text-slate-400">{s.l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------- Health campaigns (ads) ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {ADS.map((a) => (
            <Link key={a.tag} to={a.to} className={cx('group relative overflow-hidden rounded-3xl border bg-gradient-to-br via-panel to-panel p-6 transition hover:-translate-y-1', a.tone)}>
              <a.icon className="h-9 w-9" />
              <div className="mt-4 text-xs font-semibold uppercase tracking-wider">{a.tag}</div>
              <h3 className="mt-1 text-xl font-bold text-white">{a.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{a.text}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-white">
                {a.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- Categories ---------------- */}
      {categories && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-bold text-white">Shop by need</h2>
            <Link to="/shop" className="text-sm font-semibold text-brand-300 hover:underline">See all →</Link>
          </div>
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
                  <Icon className="h-7 w-7" strokeWidth={1.6} />
                  <div className="mt-6 text-sm font-semibold text-white">{c.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">{c.count} items</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------- Most ordered ---------------- */}
      {featured && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm font-semibold text-rose-300">Most ordered in emergencies</div>
              <h2 className="mt-1 text-3xl font-bold text-white">Life-saving essentials</h2>
            </div>
            <Link to="/shop" className="hidden text-sm font-semibold text-brand-300 hover:underline sm:block">Browse all →</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {featured.slice(0, 5).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- How it works ---------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-white">How an emergency delivery works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card group relative overflow-hidden p-6">
              <span className="absolute right-4 top-3 font-mono text-5xl font-bold text-white/[0.04] transition group-hover:text-brand-400/10">0{i + 1}</span>
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-brand-400/30 bg-brand-400/10 text-brand-300">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-white/[0.03] p-5 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-3"><span className="w-24 text-slate-400">By road</span><div className="h-2 flex-1 rounded-full bg-slate-600" /><b className="w-16 text-right text-white">25 min</b></div>
          <div className="flex items-center gap-3"><span className="w-24 text-slate-400">By MediDrop</span><div className="h-2 w-[18%] rounded-full bg-gradient-to-r from-brand-400 to-emerald-400" /><span className="flex-1" /><b className="w-16 text-right text-brand-300">~4 min</b></div>
          <p className="text-xs text-slate-500 sm:col-span-2">Typical 2 km trip in city traffic vs a drone flying straight at {speedKmh} km/h.</p>
        </div>
      </section>

      {/* ---------------- Plans teaser ---------------- */}
      {config && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/15 via-panel to-panel p-8 md:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <ShieldCheck className="h-10 w-10 text-emerald-300" />
                <h2 className="mt-4 text-3xl font-bold text-white">MediDrop Care: insurance for emergencies</h2>
                <p className="mt-2 text-slate-400">One small monthly plan. Every emergency delivery, supplies and flight included, is free whenever you need it.</p>
                <Link to="/plans" className="btn-primary mt-6">Compare plans <ArrowRight className="h-4 w-4" /></Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {config.plans.map((p) => (
                  <Link key={p.id} to="/plans" className={cx('rounded-2xl border bg-white/[0.03] p-4 transition hover:border-white/30', p.popular ? 'border-brand-400/50' : 'border-line')}>
                    <div className="text-sm font-semibold text-white">{p.name}</div>
                    <div className="mt-2 font-mono text-2xl font-bold text-white">{rupees(p.priceMonthly)}<span className="text-xs font-normal text-slate-400">/mo</span></div>
                    <div className="mt-2 text-xs text-slate-400">{p.deliveriesPerMonth == null ? 'Unlimited' : p.deliveriesPerMonth} free deliveries · {p.members === 1 ? '1 person' : `up to ${p.members}`}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Reviews ---------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-white">Families who counted on us</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure key={r.name} className="card p-6">
              <Quote className="h-6 w-6 text-brand-400/60" />
              <blockquote className="mt-3 text-sm text-slate-300">{r.text}</blockquote>
              <figcaption className="mt-4 flex items-center justify-between text-xs">
                <span><b className="text-white">{r.name}</b> <span className="text-slate-500">· {r.place}</span></span>
                <span className="flex text-amber-300">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ---------------- Operations (kept off the main page) ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white/[0.03] p-6">
          <div>
            <h2 className="text-lg font-bold text-white">Curious how the network runs?</h2>
            <p className="text-sm text-slate-400">See drones in the air, flight conditions and the live airspace radar.</p>
          </div>
          <Link to="/live" className="btn-secondary">
            <RadarIcon className="h-4 w-4 text-brand-300" /> Live operations
          </Link>
        </div>
      </section>
    </>
  );
}
