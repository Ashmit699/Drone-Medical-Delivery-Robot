import { Cpu, Plane, Radio, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ErrorNote, PageLoader } from '../../components/ui';
import { api } from '../../lib/api';
import { cx } from '../../lib/format';
import { PHASE_LABELS } from '../../lib/phases';
import type { Drone } from '../../lib/types';
import { useFleet } from '../../lib/useFleet';

const STATUS_TONE: Record<Drone['status'], string> = {
  idle: 'bg-emerald-100 text-emerald-700',
  in_flight: 'bg-indigo-100 text-indigo-700',
  charging: 'bg-amber-100 text-amber-700',
  maintenance: 'bg-slate-200 text-slate-600',
};

const ADAPTERS = [
  { key: 'sim', label: 'Simulator', icon: Cpu },
  { key: 'bridge', label: 'Radio bridge', icon: Radio },
] as const;

export default function Fleet() {
  const { drones, setDrones, error } = useFleet();
  const [actionError, setActionError] = useState<string | null>(null);

  const patch = async (id: string, body: Partial<Pick<Drone, 'adapter' | 'status'>>) => {
    setActionError(null);
    try {
      const updated = await api<Drone>(`/ops/drones/${id}`, { method: 'PATCH', body });
      setDrones((ds) => ds.map((d) => (d.id === id ? { ...d, ...updated } : d)));
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  if (drones.length === 0 && !error) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Fleet</h1>
        <p className="text-sm text-slate-500">
          Each drone has an adapter: <b>Simulator</b> (software drone, used for the demo) or <b>Radio bridge</b> (the real drone via drone-bridge + SiK telemetry).
        </p>
      </div>
      <ErrorNote>{error ?? actionError}</ErrorNote>
      <div className="grid gap-4 lg:grid-cols-3">
        {drones.map((d) => {
          const t = d.telemetry;
          const flying = d.status === 'in_flight';
          const battery = t?.batteryPct ?? 0;
          return (
            <div key={d.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className={cx('grid h-12 w-12 place-items-center rounded-2xl', flying ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500')}>
                  <Plane className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold">{d.name}</div>
                  <div className="text-xs text-slate-500">
                    {d.id} · {d.model}
                  </div>
                </div>
                <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold capitalize', STATUS_TONE[d.status])}>{d.status.replace('_', ' ')}</span>
              </div>

              <div className="mt-5">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-500">Battery</span>
                  <span className="font-semibold tabular-nums">{t ? `${Math.round(battery)}% · ${t.batteryV.toFixed(1)} V` : '—'}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={cx('h-full rounded-full transition-all', battery < 30 ? 'bg-red-500' : battery < 60 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${battery}%` }} />
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 py-2">
                  <dt className="text-slate-500">Link</dt>
                  <dd className={cx('font-semibold', t?.connected ? 'text-emerald-600' : 'text-red-600')}>{t?.connected ? 'Online' : 'Offline'}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <dt className="text-slate-500">Missions</dt>
                  <dd className="font-semibold">{d.missions}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <dt className="text-slate-500">Max load</dt>
                  <dd className="font-semibold">{d.max_payload_g} g</dd>
                </div>
              </dl>
              {flying && t && (
                <div className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  {PHASE_LABELS[t.phase]} · {d.active_order}
                </div>
              )}

              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate-500">Adapter</div>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    {ADAPTERS.map((a) => (
                      <button
                        key={a.key}
                        disabled={flying}
                        onClick={() => d.adapter !== a.key && patch(d.id, { adapter: a.key })}
                        className={cx('flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50', d.adapter === a.key ? 'bg-white shadow-sm' : 'text-slate-500')}
                      >
                        <a.icon className="h-3.5 w-3.5" /> {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-slate-400" />
                  <select
                    className="input py-1.5"
                    value={d.status}
                    disabled={flying}
                    onChange={(e) => patch(d.id, { status: e.target.value as Drone['status'] })}
                    aria-label={`${d.name} status`}
                  >
                    {flying && <option value="in_flight">In flight</option>}
                    <option value="idle">Available</option>
                    <option value="charging">Charging</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
