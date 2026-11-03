import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { rupees } from '../lib/format';
import type { Product } from '../lib/types';
import { useCart } from '../store/cart';
import { toast } from '../store/ui';
import { ProductIcon } from './ProductIcon';

export function QtyStepper({ qty, max, onChange, size = 'md' }: { qty: number; max: number; onChange: (q: number) => void; size?: 'sm' | 'md' }) {
  const btn = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <div className="inline-flex items-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-200">
      <button type="button" className={`grid ${btn} place-items-center rounded-l-xl hover:bg-brand-500/15`} onClick={() => onChange(qty - 1)} aria-label="Decrease">
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
      <button
        type="button"
        className={`grid ${btn} place-items-center rounded-r-xl hover:bg-brand-500/15 disabled:opacity-40`}
        onClick={() => onChange(qty + 1)}
        disabled={qty >= max}
        aria-label="Increase"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ProductCard({ product: p }: { product: Product }) {
  const line = useCart((s) => s.lines.find((l) => l.productId === p.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const out = p.stock === 0;

  return (
    <div className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/shop/${p.slug}`} className="relative block aspect-[4/3] p-3">
        <ProductIcon icon={p.icon} category={p.category} />
        <div className="absolute left-5 top-5 flex gap-1.5">
          {p.badge && <span className="rounded-md border border-brand-400/30 bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-300 backdrop-blur">{p.badge}</span>}
          {!!p.rx_required && <span className="rounded-md bg-panel/85 px-1.5 py-0.5 text-[11px] font-bold text-violet-300 shadow-sm">Rx</span>}
          {p.category === 'Cold Chain' && <span className="rounded-md bg-panel/85 px-1.5 py-0.5 text-[11px] font-bold text-sky-300 shadow-sm">2–8 °C</span>}
        </div>
        <span className="absolute bottom-5 right-5 rounded-md bg-panel/85 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300 shadow-sm">{p.weight_g} g</span>
      </Link>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{p.category}</div>
        <Link to={`/shop/${p.slug}`} className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug hover:text-brand-300">
          {p.name}
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="font-bold">{rupees(p.price)}</span>
          {out ? (
            <span className="text-xs font-semibold text-slate-500">Out of stock</span>
          ) : line ? (
            <QtyStepper size="sm" qty={line.qty} max={Math.min(p.stock, 20)} onChange={(q) => setQty(p.id, q)} />
          ) : (
            <button className="btn-primary h-8 px-3 py-0 text-xs" onClick={() => {
                add(p);
                toast({ tone: 'success', title: 'Added to payload bay', body: `${p.name} · ${p.weight_g} g` });
              }}>
              <ShoppingCart className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
