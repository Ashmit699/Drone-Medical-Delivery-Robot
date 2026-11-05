import { ArrowRight, FileCheck2, ShoppingCart, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QtyStepper } from '../components/ProductCard';
import { ProductIcon } from '../components/ProductIcon';
import { Empty, PayloadMeter } from '../components/ui';
import { useAppConfig } from '../lib/api';
import { rupees } from '../lib/format';
import { useAuth } from '../store/auth';
import { cartTotals, useCart } from '../store/cart';

export default function Cart() {
  const { lines, setQty, remove, clear } = useCart();
  const totals = cartTotals(lines);
  const config = useAppConfig();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const maxG = config?.maxPayloadG ?? 300;
  const tooHeavy = totals.weightG > maxG;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Empty icon={<ShoppingCart className="h-6 w-6" />} title="Your cart is empty">
          <Link to="/shop" className="btn-primary mt-4">
            Browse the pharmacy
          </Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Cart</h1>
        <button className="text-sm font-medium text-slate-400 hover:text-red-400" onClick={clear}>
          Clear cart
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <ul className="card divide-y divide-line">
          {lines.map((l) => (
            <li key={l.productId} className="flex items-center gap-4 p-4">
              <Link to={`/shop/${l.slug}`}>
                <ProductIcon icon={l.icon} category={l.category} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/shop/${l.slug}`} className="line-clamp-1 font-semibold hover:text-brand-300">
                  {l.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{rupees(l.price)} each</span>·<span>{l.weightG * l.qty} g</span>
                  {l.rxRequired && <span className="rounded bg-violet-500/15 px-1.5 font-semibold text-violet-300">Rx</span>}
                </div>
              </div>
              <QtyStepper size="sm" qty={l.qty} max={Math.min(l.stock, 20)} onChange={(q) => setQty(l.productId, q)} />
              <div className="hidden w-20 text-right font-semibold sm:block">{rupees(l.price * l.qty)}</div>
              <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => remove(l.productId)} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-24">
          <PayloadMeter weightG={totals.weightG} maxG={maxG} />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Supplies ({totals.count})</dt>
              <dd className="font-medium">{rupees(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Covered by Aerolift Care</dt>
              <dd className="font-mono text-emerald-400">−{rupees(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Drone delivery</dt>
              <dd className="font-semibold text-emerald-400">Free with your plan</dd>
            </div>
          </dl>
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <span>You pay</span>
            <span>{rupees(0)}</span>
          </div>
          {totals.rxRequired && (
            <div className="flex gap-2 rounded-xl bg-violet-500/10 p-3 text-xs text-violet-200">
              <FileCheck2 className="h-4 w-4 shrink-0" /> Your cart has prescription items. Have a photo of your prescription ready.
            </div>
          )}
          <button className="btn-primary w-full py-3" disabled={tooHeavy} onClick={() => navigate(user ? '/checkout' : '/login?next=/checkout')}>
            {user ? 'Checkout' : 'Log in to checkout'} <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </div>
  );
}
