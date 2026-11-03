// Exhibition explainer: the hardware, how the pieces talk, and how the app plugs into the real drone.
import { ArrowDown, ArrowRight, CheckCircle2, CircleDashed, Cpu, Radio, Smartphone, Server, Plane, Anchor } from 'lucide-react';
import type { ReactNode } from 'react';
import { PHASE_LABELS } from '../lib/phases';
import type { MissionPhase } from '../lib/types';

const HARDWARE = [
  ['Flight controller', 'Radiolink CrossFlight v1.1 running ArduCopter'],
  ['GPS + compass', 'Radiolink PS100'],
  ['Motors', '4 × Readytosky RS2312 920 KV'],
  ['ESCs', '4 × Readytosky 40 A'],
  ['Frame / power', 'S500 frame · CrossFlight power distribution board · 4S LiPo'],
  ['Telemetry', 'SiK radio pair (MAVLink, ~1 km)'],
  ['Manual control', 'Radiolink RC transmitter (safety pilot)'],
  ['Payload', 'ESP32 + worm-gear winch with encoder + 2-hook servo gripper'],
  ['Precision (next)', 'Raspberry Pi + downward camera + TF-Luna rangefinder'],
];

const PHASES: MissionPhase[] = ['preflight', 'takeoff', 'cruise', 'approach', 'aligning', 'awaiting_clearance', 'lowering', 'releasing', 'retracting', 'returning', 'landing'];

function Box({ icon, title, sub, tone = 'border-line bg-panel' }: { icon: ReactNode; title: string; sub: string; tone?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${tone}`}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-white">{icon}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

function Link_({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-slate-400 md:flex-col md:px-1 md:py-0">
      <ArrowDown className="h-4 w-4 md:hidden" />
      <ArrowRight className="hidden h-4 w-4 md:block" />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function Technology() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">How it works</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">One app, one drone, one rope</h1>
        <p className="mt-4 text-lg text-slate-300">
          The drone never lands at the destination. It hovers about 4 m above a printed marker, a human confirms the area is clear, and a winch lowers the
          package. Here is how every piece connects.
        </p>
      </div>

      {/* System diagram */}
      <section className="card mt-12 p-6 md:p-8">
        <h2 className="text-xl font-bold">System architecture</h2>
        <p className="mt-1 text-sm text-slate-400">Each layer only talks to its neighbour, so any one piece can be swapped or tested on its own.</p>
        <div className="mt-8 flex flex-col items-stretch md:flex-row md:items-center">
          <Box icon={<Smartphone className="h-5 w-5" />} title="MediDrop app" sub="React · phone + laptop" tone="border-brand-500/30 bg-brand-500/10" />
          <Link_ label="HTTPS + live socket" />
          <Box icon={<Server className="h-5 w-5" />} title="App backend" sub="Node + SQLite · orders, fleet" tone="border-brand-500/30 bg-brand-500/10" />
          <Link_ label="DroneAdapter" />
          <Box icon={<Cpu className="h-5 w-5" />} title="Drone bridge" sub="Python + pymavlink" />
          <Link_ label="SiK radio · MAVLink" />
          <Box icon={<Plane className="h-5 w-5" />} title="CrossFlight FC" sub="ArduCopter autopilot" />
          <Link_ label="serial" />
          <Box icon={<Anchor className="h-5 w-5" />} title="Payload ESP32" sub="Winch + gripper" />
        </div>
      </section>

      {/* Integration seam */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6 md:p-8">
          <h2 className="text-xl font-bold">How we plug in the real drone</h2>
          <p className="mt-2 text-sm text-slate-300">
            The backend only talks to a <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">DroneAdapter</code>. Today every drone uses the
            simulator, a software drone that flies the exact same phases. To fly for real, the operator switches a drone to the <b>bridge</b> adapter in
            the Fleet page. The bridge turns app commands into MAVLink for the flight controller. Nothing else in the app changes.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border-2 border-brand-500 bg-brand-500/10 p-4">
              <div className="font-semibold text-brand-200">SimDroneAdapter</div>
              <div className="mt-1 text-xs text-brand-300">Live now · used in this demo</div>
            </div>
            <div className="rounded-xl border-2 border-dashed border-white/20 p-4">
              <div className="font-semibold">BridgeDroneAdapter</div>
              <div className="mt-1 text-xs text-slate-400">Ready · connects to the real drone</div>
            </div>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              [true, 'App, backend, orders, live tracking, operator console'],
              [true, 'Drone simulator with real mission phases + failsafes'],
              [true, 'Bridge protocol + adapter in the backend'],
              [false, 'Bridge: mission upload over MAVLink'],
              [false, 'Raspberry Pi: camera marker alignment'],
              [false, 'ESP32 winch firmware on the drone'],
            ].map(([done, t]) => (
              <li key={t as string} className="flex items-center gap-2">
                {done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <CircleDashed className="h-4 w-4 text-slate-500" />}
                <span className={done ? '' : 'text-slate-400'}>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-6 md:p-8">
          <h2 className="text-xl font-bold">Our drone</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            {HARDWARE.map(([k, v]) => (
              <div key={k} className="flex gap-4 py-2.5">
                <dt className="w-36 shrink-0 font-medium text-slate-400">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Mission phases */}
      <section className="card mt-8 p-6 md:p-8">
        <h2 className="text-xl font-bold">A delivery, phase by phase</h2>
        <p className="mt-1 text-sm text-slate-400">These are the exact phases the app shows during tracking. The simulator and the real drone report the same ones.</p>
        <ol className="mt-6 flex flex-wrap gap-2">
          {PHASES.map((p, i) => (
            <li
              key={p}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${p === 'awaiting_clearance' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/[0.06] text-slate-200'}`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-panel text-[11px] font-bold">{i + 1}</span>
              {PHASE_LABELS[p]}
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            [Radio, 'GPS to the area', 'Autopilot flies to the drop point at 25 m (~2–3 m accuracy).'],
            [Cpu, 'Camera to the spot', 'The camera sees the ArUco marker and nudges the drone to within ~20 cm.'],
            [Anchor, 'Rope to the ground', 'The winch lowers at 0.25 m/s. Slack means touchdown, then the hooks open and it reels in.'],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Radio;
            return (
              <div key={t as string} className="rounded-2xl bg-white/[0.03] p-5">
                <I className="h-6 w-6 text-brand-400" />
                <div className="mt-3 font-semibold">{t as string}</div>
                <p className="mt-1 text-sm text-slate-300">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
