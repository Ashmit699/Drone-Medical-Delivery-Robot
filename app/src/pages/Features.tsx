import {
  Activity,
  Anchor,
  BatteryCharging,
  Bell,
  ClipboardCheck,
  Crosshair,
  FileCheck2,
  Gauge,
  Hand,
  LayoutDashboard,
  Map as MapIcon,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Snowflake,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const GROUPS = [
  {
    title: 'For patients & clinics',
    tone: 'bg-brand-600',
    items: [
      { icon: ShoppingCart, title: 'Full pharmacy cart', text: 'Search, filter by category, add to cart and check out in under a minute.' },
      { icon: Gauge, title: 'Live payload meter', text: 'The cart shows the weight against the drone’s 300 g limit as you shop.' },
      { icon: MapIcon, title: 'Pin-drop delivery', text: 'Choose the exact drop spot on a map, or use GPS. Save addresses for next time.' },
      { icon: FileCheck2, title: 'Prescription upload', text: 'Rx medicines need a prescription photo, which a pharmacist verifies before dispatch.' },
      { icon: Activity, title: 'Live flight tracking', text: 'See the drone move in real time, with ETA, altitude, battery and each flight phase.' },
      { icon: Hand, title: '“Area clear” safety gate', text: 'The drone waits overhead until you press-and-hold to confirm nobody is under it.' },
    ],
  },
  {
    title: 'For the base-station operator',
    tone: 'bg-indigo-600',
    items: [
      { icon: LayoutDashboard, title: 'Ops dashboard', text: 'Orders today, success rate, average delivery time, fleet health and low-stock alerts.' },
      { icon: ClipboardCheck, title: 'Pre-flight checklist', text: 'Launch stays locked until battery, GPS, link and payload checks all pass.' },
      { icon: Radio, title: 'Live flight monitor', text: 'HUD with flight mode, altitude, speed, GPS satellites, marker error and winch state.' },
      { icon: ShieldCheck, title: 'Intervene any time', text: 'Pause (hold position) or Return-to-base with deliberate hold-to-confirm buttons.' },
      { icon: Siren, title: 'Priority queue', text: 'Emergency orders jump to the top and are auto-approved when no Rx is involved.' },
      { icon: BatteryCharging, title: 'Fleet management', text: 'Battery, status and maintenance mode per drone. Each drone can be simulated or real.' },
    ],
  },
  {
    title: 'On the drone',
    tone: 'bg-rose-600',
    items: [
      { icon: Anchor, title: 'Winch + 2-hook gripper', text: 'A worm-gear pulley lowers the box on a rope. Hooks open only once it is on the ground.' },
      { icon: Crosshair, title: 'Precision alignment', text: 'A downward camera finds an ArUco marker and centres the drone to about 20 cm.' },
      { icon: Snowflake, title: 'Cold-chain ready', text: 'Insulated pouches keep insulin and vials at 2–8 °C during the short flight.' },
      { icon: Bell, title: 'Failsafes built in', text: 'Lost link, low battery or a geofence breach means it reels the rope in and returns home automatically.' },
    ],
  },
];

export default function Features() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Features</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Everything needed to fly medicine safely</h1>
        <p className="mt-4 text-lg text-slate-600">A customer app, an operator console and the drone itself, designed as one system.</p>
      </div>

      <div className="mt-14 space-y-14">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-6 text-xl font-bold">{g.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((f) => (
                <div key={f.title} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl text-white ${g.tone}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{f.text}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 flex flex-wrap gap-3">
        <Link to="/shop" className="btn-primary px-6 py-3">
          Try it: place an order
        </Link>
        <Link to="/technology" className="btn-secondary px-6 py-3">
          How the drone works
        </Link>
      </div>
    </div>
  );
}
