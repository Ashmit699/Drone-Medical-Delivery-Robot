import { ArrowLeft, FileCheck2, Package, Scale, ShoppingCart, Snowflake } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProductCard, QtyStepper } from '../components/ProductCard';
import { ProductIcon } from '../components/ProductIcon';
import { ErrorNote, PageLoader } from '../components/ui';
import { useApi } from '../lib/api';
import { rupees } from '../lib/format';
import type { Product } from '../lib/types';
import { useCart } from '../store/cart';

export default function ProductPage() {
  const { slug } = useParams();
  const { data: p, error, loading } = useApi<Product & { related: Product[] }>(`/products/${slug}`);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.lines.find((l) => l.productId === p?.id)?.qty ?? 0);
  const navigate = useNavigate();

  if (loading) return <PageLoader />;
  if (error || !p) return <div className="mx-auto max-w-3xl p-6"><ErrorNote>{error ?? 'Not found'}</ErrorNote></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="card aspect-square p-4">
          <ProductIcon icon={p.icon} category={p.category} size="lg" />
        </div>
        <div>
          <Link to={`/shop?category=${encodeURIComponent(p.category)}`} className="text-sm font-semibold uppercase tracking-wide text-brand-400">
            {p.category}
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{p.name}</h1>
          <div className="mt-4 text-3xl font-bold">{rupees(p.price)}</div>
          <p className="mt-5 text-slate-300">{p.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5">
              <Scale className="h-4 w-4 text-slate-400" /> {p.weight_g} g flight weight
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5">
              <Package className="h-4 w-4 text-slate-400" /> {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
            </div>
            {!!p.rx_required && (
              <div className="col-span-2 flex items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2.5 text-violet-200">
                <FileCheck2 className="h-4 w-4" /> Prescription required. You'll upload a photo at checkout.
              </div>
            )}
            {p.category === 'Cold Chain' && (
              <div className="col-span-2 flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2.5 text-sky-200">
                <Snowflake className="h-4 w-4" /> Flies in an insulated 2–8 °C pouch
              </div>
            )}
          </div>

          {p.stock > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <QtyStepper qty={qty} max={Math.max(1, Math.min(p.stock - inCart, 20))} onChange={(q) => setQty(Math.max(1, q))} />
              <button className="btn-primary px-6 py-3" onClick={() => add(p, qty)}>
                <ShoppingCart className="h-4 w-4" /> Add to cart
              </button>
              <button
                className="btn-secondary px-6 py-3"
                onClick={() => {
                  add(p, qty);
                  navigate('/cart');
                }}
              >
                Buy now
              </button>
            </div>
          )}
          {inCart > 0 && <p className="mt-3 text-sm text-brand-300">{inCart} already in your cart</p>}
        </div>
      </div>

      {p.related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">More in {p.category}</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {p.related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
