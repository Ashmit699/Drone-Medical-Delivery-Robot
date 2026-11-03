import { ChevronRight, Package, Plane, RotateCcw, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, ErrorNote, PageLoader, PriorityBadge, StatusBadge } from '../components/ui';
import { api, getSocket, useApi } from '../lib/api';
import { cx, dateTime, rupees } from '../lib/format';
import { PHASE_LABELS } from '../lib/phases';
import type { OrderDetail, OrderSummary, Product } from '../lib/types';
import { useCart } from '../store/cart';
import { toast, useUi } from '../store/ui';

const ACTIVE = ['placed', 'approved', 'in_flight'];

export default function Orders() {
  const { data, error, loading, reload } = useApi<OrderSummary[]>('/orders');
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const add = useCart((s) => s.add);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const navigate = useNavigate();

  // Put a past order's items back in the cart (skipping anything now out of stock).
  const reorder = async (id: number) => {
    const [order, products] = await Promise.all([api<OrderDetail>(`/orders/${id}`), api<Product[]>('/products')]);
    let added = 0;
    for (const item of order.items) {
      const p = products.find((x) => x.id === item.product_id);
      if (p && p.stock > 0) {
        add(p, Math.min(item.qty, p.stock));
        added++;
      }
    }
    toast(added ? { tone: 'success', title: `${order.code} items back in your cart` } : { tone: 'error', title: 'Those items are out of stock' });
    if (added) setCartOpen(true);
    else navigate('/shop');
  };

  // Refresh the list when any of my orders changes.
  useEffect(() => {
    const s = getSocket();
    data?.filter((o) => ACTIVE.includes(o.status)).forEach((o) => s.emit('track', o.id));
    const onUpdate = () => reload();
    s.on('order:update', onUpdate);
    return () => {
      s.off('order:update', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.length]);

  if (loading && !data) return <PageLoader />;
  const active = data?.filter((o) => ACTIVE.includes(o.status)) ?? [];
  const past = data?.filter((o) => !ACTIVE.includes(o.status)) ?? [];
  const list = tab === 'active' ? active : past;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">My orders</h1>
      <div className="mt-6 inline-flex rounded-xl bg-white/[0.06] p-1">
        {(['active', 'past'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('rounded-lg px-4 py-2 text-sm font-semibold capitalize', tab === t ? 'bg-panel shadow-sm' : 'text-slate-400')}>
            {t} <span className="text-slate-500">{t === 'active' ? active.length : past.length}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <ErrorNote>{error}</ErrorNote>
        {list.length === 0 ? (
          <Empty icon={<Package className="h-6 w-6" />} title={tab === 'active' ? 'No active deliveries' : 'No past orders yet'}>
            <Link to="/shop" className="btn-primary mt-4">
              Start shopping
            </Link>
          </Empty>
        ) : (
          list.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-md sm:p-5">
              <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-xl', o.status === 'in_flight' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-white/[0.06] text-slate-400')}>
                {o.status === 'in_flight' ? <Plane className="h-5 w-5" /> : <Package className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{o.code}</span>
                  <StatusBadge status={o.status} />
                  {o.priority !== 'standard' && <PriorityBadge priority={o.priority} />}
                </div>
                <div className="mt-1 line-clamp-1 text-sm text-slate-300">{o.summary}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {dateTime(o.created_at)} · to {o.address_label}
                  {o.status === 'in_flight' && o.mission_phase && <span className="font-semibold text-indigo-400"> · {PHASE_LABELS[o.mission_phase]}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-white">{rupees(o.total)}</div>
                {['delivered', 'failed', 'cancelled'].includes(o.status) && (
                  <button
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      reorder(o.id);
                    }}
                  >
                    <RotateCcw className="h-3 w-3" /> Reorder
                  </button>
                )}
                {o.rating && (
                  <div className="mt-1 flex items-center justify-end gap-0.5 text-xs text-amber-500">
                    <Star className="h-3 w-3 fill-current" /> {o.rating}
                  </div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
