import { CloudRain, Thermometer, Wind } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cx } from '../lib/format';
import { offsetFrom, type Conditions, type PublicDrone } from '../lib/live';
import { PHASE_LABELS } from '../lib/phases';
import type { LatLon } from '../lib/types';

const CALL_TONE = {
  GO: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  CAUTION: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
  'NO-GO': 'border-rose-400/40 bg-rose-500/10 text-rose-300',
} as const;

/** Small pill: "Flight conditions GO · wind 4 km/h". */
export function ConditionsPill({ c, className }: { c: Conditions | null; className?: string }) {
  if (!c?.available || !c.call) return null;
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold', CALL_TONE[c.call], className)}>
      <Wind className="h-3.5 w-3.5" /> FLIGHT {c.call} · {Math.round(c.windKmh ?? 0)} km/h
    </span>
  );
}

/** Larger weather card for the ops dashboard and the live page. */
export function ConditionsCard({ c }: { c: Conditions | null }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="hud">Flight conditions · hub</div>
          <div className={cx('mt-1 font-[family-name:var(--font-display)] text-3xl font-bold', c?.call ? CALL_TONE[c.call].split(' ').at(-1) : 'text-slate-500')}>
            {c?.call ?? (c ? 'N/A' : '…')}
          </div>
        </div>
        {c?.call && <span className={cx('h-3 w-3 animate-glow rounded-full', c.call === 'GO' ? 'bg-emerald-400' : c.call === 'CAUTION' ? 'bg-amber-400' : 'bg-rose-500')} />}
      </div>
      {c?.available ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.04] p-2">
              <Wind className="mx-auto h-4 w-4 text-cyan-300" />
              <div className="mt-1 font-mono text-sm font-semibold text-white">{Math.round(c.windKmh ?? 0)}</div>
              <div className="text-[10px] text-slate-500">wind km/h · gust {Math.round(c.gustKmh ?? 0)}</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-2">
              <Thermometer className="mx-auto h-4 w-4 text-orange-300" />
              <div className="mt-1 font-mono text-sm font-semibold text-white">{c.temperatureC?.toFixed(0)}°</div>
              <div className="text-[10px] text-slate-500">temp °C</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-2">
              <CloudRain className="mx-auto h-4 w-4 text-sky-300" />
              <div className="mt-1 font-mono text-sm font-semibold text-white">{c.precipitationMm}</div>
              <div className="text-[10px] text-slate-500">rain mm</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">{c.reasons.join(' · ')}</p>
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500">{c?.reasons[0] ?? 'Loading live weather…'}</p>
      )}
    </div>
  );
}

/** Animated count-up for headline numbers. */
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number | null | undefined; decimals?: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (value == null) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null) return <>—</>;
  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  );
}

/** Radar scope: drones plotted around the hub with a rotating sweep. */
export function Radar({ hub, radiusKm, drones, className }: { hub: LatLon; radiusKm: number; drones: PublicDrone[]; className?: string }) {
  const R = 140; // svg units for the outer ring
  const rangeM = radiusKm * 1000 * 1.15;
  const atBase = drones.filter((d) => !d.armed).length;

  return (
    <div className={cx('relative aspect-square w-full', className)}>
      {/* sweep */}
      <div className="absolute inset-[3%] overflow-hidden rounded-full">
        <div className="absolute inset-0 animate-sweep rounded-full bg-[conic-gradient(from_0deg,rgba(34,229,211,0.35),rgba(34,229,211,0)_25%,transparent)]" />
      </div>
      <svg viewBox="-150 -150 300 300" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="rd-bg">
            <stop offset="0" stopColor="#22e5d3" stopOpacity=".08" />
            <stop offset="1" stopColor="#22e5d3" stopOpacity=".01" />
          </radialGradient>
        </defs>
        <circle r={R} fill="url(#rd-bg)" stroke="#22e5d3" strokeOpacity=".35" />
        {[0.25, 0.5, 0.75].map((f) => (
          <circle key={f} r={R * f} fill="none" stroke="#22e5d3" strokeOpacity=".14" />
        ))}
        {/* service area */}
        <circle r={(radiusKm * 1000 * R) / rangeM} fill="none" stroke="#8b5cf6" strokeOpacity=".7" strokeDasharray="4 5" />
        <line x1={-R} x2={R} y1="0" y2="0" stroke="#22e5d3" strokeOpacity=".12" />
        <line y1={-R} y2={R} x1="0" x2="0" stroke="#22e5d3" strokeOpacity=".12" />
        <text x="4" y={-R + 12} fill="#22e5d3" fillOpacity=".6" fontSize="8" fontFamily="JetBrains Mono, monospace">
          N
        </text>
        <text x={(radiusKm * 1000 * R) / rangeM + 3} y="-3" fill="#a78bfa" fillOpacity=".8" fontSize="7" fontFamily="JetBrains Mono, monospace">
          {radiusKm} km
        </text>
        {/* hub */}
        <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#0a111e" stroke="#e2e8f0" strokeWidth="1.5" />
        {atBase > 0 && (
          <text x="9" y="14" fill="#94a3b8" fontSize="7" fontFamily="JetBrains Mono, monospace">
            {atBase} AT BASE
          </text>
        )}
        {drones
          .filter((d) => d.armed)
          .map((d) => {
            const o = offsetFrom(hub, d.position);
            const x = (o.east / rangeM) * R;
            const y = (-o.north / rangeM) * R;
            return (
              <g key={d.id} transform={`translate(${x} ${y})`}>
                <circle r="9" fill="#22e5d3" opacity=".15">
                  <animate attributeName="r" values="5;13;5" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <g transform={`rotate(${d.headingDeg})`}>
                  <path d="M0 -6 L4 4 L0 2 L-4 4 Z" fill="#5af7e6" />
                </g>
                <text x="8" y="-6" fill="#e2e8f0" fontSize="7.5" fontFamily="JetBrains Mono, monospace">
                  {d.id} · {Math.round(d.altM)}m
                </text>
                <text x="8" y="3" fill="#94a3b8" fontSize="6.5" fontFamily="JetBrains Mono, monospace">
                  {PHASE_LABELS[d.phase].toUpperCase()}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}
