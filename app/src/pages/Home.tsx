import { ArrowRight, Crosshair, Hospital, MapPin, PackageCheck, ShieldCheck, Siren, Snowflake, Timer, Trees } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DroneArt } from '../components/DroneArt';
import { ProductCard } from '../components/ProductCard';
import { useApi } from '../lib/api';
import type { Product } from '../lib/types';

const STEPS = [
  { icon: PackageCheck, title: 'Order in seconds', text: 'Pick medicines or a first-aid kit, drop a pin where you are, choose priority.' },
  { icon: ShieldCheck, title: 'Pharmacist approves', text: 'Prescriptions are checked, the package is loaded into the drone’s gripper.' },
  { icon: MapPin, title: 'Drone flies to you', text: 'GPS autopilot at 25 m. Watch it live on the map with ETA and battery.' },
  { icon: Crosshair, title: 'Precision rope drop', text: 'It hovers over your marker and lowers the box on a winch. No landing needed.' },
];

const USES = [
  { icon: Trees, title: 'Remote villages', text: 'Reach PHCs and homes cut off by bad roads or floods.' },
  { icon: Siren, title: 'Emergencies', text: 'Snakebite kits, epinephrine, glucose: minutes matter.' },
  { icon: Snowflake, title: 'Cold-chain', text: 'Insulin and vials in insulated pouches, delivered fast.' },
  { icon: Hospital, title: 'Hospital logistics', text: 'Move samples and supplies between buildings and camps.' },
];

export default function Home() {
  const { data: featured } = useApi<Product[]>('/products?category=Emergency');

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-slate-50">
        <div className="absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /> Autonomous medical delivery
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Medicines from the sky, <span className="text-brand-600">in minutes.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">
              MediDrop flies essential medicines and first-aid to clinics, villages and homes, then lowers them on a rope to the exact spot.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary px-6 py-3 text-base">
                Order now <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/technology" className="btn-secondary px-6 py-3 text-base">
                See how it works
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                ['~4 min', 'within 2 km'],
                ['300 g', 'per flight'],
                ['±20 cm', 'drop target'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-bold text-ink">{v}</dt>
                  <dd className="text-sm text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <DroneArt className="mx-auto w-full max-w-md" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">From tap to doorstep in four steps</h2>
          <p className="mt-3 text-slate-600">The app, the autopilot and the winch work together. A human confirms safety at every critical moment.</p>
        </div>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <span className="absolute right-5 top-5 text-4xl font-black text-slate-100">{i + 1}</span>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Emergency band */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-red-600 to-rose-500 p-8 text-white md:flex-row md:items-center md:p-10">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20">
              <Siren className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Emergency? Delivery is free and goes first.</h3>
              <p className="mt-1 text-red-50">Emergency orders skip the queue and take the next available drone.</p>
            </div>
          </div>
          <Link to="/shop?category=Emergency" className="btn shrink-0 bg-white px-6 py-3 text-red-600 hover:bg-red-50">
            Emergency supplies <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Featured */}
      {featured && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Emergency essentials</h2>
              <p className="mt-2 text-slate-600">All light enough to fly.</p>
            </div>
            <Link to="/shop" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">
              Browse all →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {featured.slice(0, 5).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Use cases */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-3xl bg-ink p-8 text-white md:p-12">
          <h2 className="text-3xl font-bold tracking-tight">Built for places roads don’t reach fast</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {USES.map((u) => (
              <div key={u.title}>
                <u.icon className="h-7 w-7 text-brand-400" />
                <h3 className="mt-3 font-semibold">{u.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{u.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-white/10 pt-8 text-sm text-slate-400">
            <Timer className="h-4 w-4 text-brand-400" /> A 2 km trip that takes 25 min by road takes about 4 min by air.
          </div>
        </div>
      </section>
    </>
  );
}
