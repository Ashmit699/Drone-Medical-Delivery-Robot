import { AlertTriangle, ArrowRight, Battery, CheckCircle2, Clock, IndianRupee, Package, Plane, Star, Timer } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConditionsCard } from '../../components/live';
import { PageLoader, PriorityBadge } from '../../components/ui';
import { getSocket, useApi } from '../../lib/api';
import { cx, rupees, timeAgo } from '../../lib/format';
import { PHASE_LABELS } from '../../lib/phases';
import type { OrderSummary, Stats } from '../../lib/types';
import { useConditions } from '../../lib/live';
import { useFleet } from '../../lib/useFleet';

const PIE_COLORS = ['#22e5d3', '#8b5cf6', '#f59e0b', '#f43f5e', '#38bdf8', '#ec4899', '#a3e635'];
const TOOLTIP = { borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)', background: '#0a111e', color: '#e2e8f0' };

function Kpi({ label, value, icon, tone, sub }: { label: string; value: ReactNode; icon: ReactNode; tone: string; sub?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <span className={cx('grid h-9 w-9 place-items-center rounded-xl', tone)}>{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, reload } = useApi<Stats>('/ops/stats');
  const { data: queue, reload: reloadQueue } = useApi<OrderSummary[]>('/ops/orders');
  const { drones } = useFleet();
  const conditions = useConditions();

  useEffect(() => {
    const s = getSocket();
    const onUpdate = () => {
      reload();
      reloadQueue();
    };
    s.on('order:update', onUpdate);
    return () => {
      s.off('order:update', onUpdate);
    };
  }, [reload, reloadQueue]);

  if (!stats) return <PageLoader />;

  const actionable = (queue ?? []).filter((o) => o.status === 'placed' || o.status === 'approved').slice(0, 6);
  const chartDays = stats.ordersByDay.map((d) => ({ ...d, label: new Date(d.day).toLocaleDateString('en-IN', { weekday: 'short' }) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link to="/ops/monitor" className="btn-primary">
          <Plane className="h-4 w-4" /> Live monitor
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Orders today" value={stats.ordersToday} icon={<Package className="h-4.5 w-4.5" />} tone="bg-brand-500/10 text-brand-300" sub={`${stats.deliveredToday} delivered`} />
        <Kpi label="In flight" value={stats.inFlight} icon={<Plane className="h-4.5 w-4.5" />} tone="bg-indigo-500/10 text-indigo-400" sub={`${stats.readyToDispatch} ready to dispatch`} />
        <Kpi
          label="Needs approval"
          value={stats.pendingApproval}
          icon={<Clock className="h-4.5 w-4.5" />}
          tone={stats.pendingApproval ? 'bg-amber-500/10 text-amber-400' : 'bg-white/[0.06] text-slate-400'}
          sub={stats.pendingApproval ? <Link to="/ops/orders?status=placed" className="font-semibold text-amber-300">Review now →</Link> : 'All caught up'}
        />
        <Kpi label="Avg. delivery" value={stats.avgDeliveryMin != null ? `${stats.avgDeliveryMin} min` : '—'} icon={<Timer className="h-4.5 w-4.5" />} tone="bg-sky-500/10 text-sky-400" sub="dispatch → package on ground" />
        <Kpi label="Success rate" value={stats.successRate != null ? `${stats.successRate}%` : '—'} icon={<CheckCircle2 className="h-4.5 w-4.5" />} tone="bg-emerald-500/10 text-emerald-400" sub={`${stats.totalDelivered} deliveries total`} />
        <Kpi label="Plan income / month" value={rupees(stats.planRevenueMonthly)} icon={<IndianRupee className="h-4.5 w-4.5" />} tone="bg-violet-500/10 text-violet-400" sub={`${stats.activeMembers} active member${stats.activeMembers === 1 ? '' : 's'}`} />
        <Kpi label="Avg. rating" value={stats.avgRating ?? '—'} icon={<Star className="h-4.5 w-4.5" />} tone="bg-amber-500/10 text-amber-500" sub="from customers" />
        <Kpi
          label="Fleet ready"
          value={`${stats.fleet.idle ?? 0}/${Object.values(stats.fleet).reduce((a, b) => a + b, 0)}`}
          icon={<Battery className="h-4.5 w-4.5" />}
          tone="bg-white/[0.06] text-slate-300"
          sub={stats.fleet.maintenance ? `${stats.fleet.maintenance} in maintenance` : 'all drones available'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h2 className="font-bold">Orders, last 7 days</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDays} barGap={4}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={TOOLTIP} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="orders" name="Orders" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="delivered" name="Delivered" fill="#22e5d3" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">What people order</h2>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.byCategory} dataKey="qty" nameKey="category" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false} stroke="none">
                  {stats.byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {stats.welfarePending > 0 && (
        <Link to="/ops/welfare" className="flex items-center justify-between rounded-2xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 text-sm text-violet-200 hover:bg-violet-500/15">
          <span>
            <b>{stats.welfarePending}</b> welfare verification request{stats.welfarePending > 1 ? 's' : ''} waiting
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Action queue</h2>
            <Link to="/ops/orders" className="text-sm font-semibold text-brand-300">
              All orders →
            </Link>
          </div>
          {actionable.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">Nothing waiting. New orders appear here instantly.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {actionable.map((o) => (
                <li key={o.id}>
                  <Link to={`/ops/orders?open=${o.id}`} className="flex items-center gap-3 py-3 hover:bg-white/[0.03]">
                    <span className={cx('h-2.5 w-2.5 rounded-full', o.status === 'placed' ? 'bg-amber-500' : 'bg-sky-500')} />
                    <span className="w-20 font-semibold">{o.code}</span>
                    <PriorityBadge priority={o.priority} />
                    <span className="line-clamp-1 flex-1 text-sm text-slate-300">{o.summary}</span>
                    <span className="hidden text-xs text-slate-500 sm:block">{timeAgo(o.created_at)}</span>
                    <span className="text-sm font-semibold text-brand-300">{o.status === 'placed' ? 'Review' : 'Dispatch'}</span>
                    <ArrowRight className="h-4 w-4 text-slate-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
        <ConditionsCard c={conditions} />
        <div className="card p-5">
          <h2 className="font-bold">Fleet</h2>
          <ul className="mt-4 space-y-3">
            {drones.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <div className={cx('grid h-9 w-9 place-items-center rounded-lg', d.status === 'in_flight' ? 'bg-indigo-600 text-white' : 'bg-panel text-slate-400')}>
                  <Plane className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {d.name} <span className="font-normal text-slate-500">{d.id}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {d.status === 'in_flight' && d.telemetry ? PHASE_LABELS[d.telemetry.phase] : d.status.replace('_', ' ')}
                    {d.active_order && ` · ${d.active_order}`}
                  </div>
                </div>
                <div className="text-right text-xs font-semibold tabular-nums">{d.telemetry ? `${Math.round(d.telemetry.batteryPct)}%` : '—'}</div>
              </li>
            ))}
          </ul>
          {stats.lowStock.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <AlertTriangle className="h-4 w-4" /> Low stock
              </div>
              <ul className="mt-2 space-y-1 text-xs text-amber-100">
                {stats.lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="font-semibold">{p.stock}</span>
                  </li>
                ))}
              </ul>
              <Link to="/ops/inventory" className="mt-2 inline-block text-xs font-semibold text-amber-200">
                Restock →
              </Link>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
