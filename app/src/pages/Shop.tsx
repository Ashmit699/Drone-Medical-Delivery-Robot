import { Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Empty, ErrorNote, PageLoader } from '../components/ui';
import { useApi } from '../lib/api';
import { cx } from '../lib/format';
import type { Product } from '../lib/types';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? '';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const urlQ = params.get('q') ?? '';
  useEffect(() => setQ(urlQ), [urlQ]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const { data: categories } = useApi<{ name: string; count: number }[]>('/categories');
  const query = new URLSearchParams({ ...(category && { category }), ...(sort && { sort }), ...(debouncedQ && { q: debouncedQ }) }).toString();
  const { data: products, loading, error } = useApi<Product[]>(`/products?${query}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Pharmacy</h1>
          <p className="mt-1 text-slate-400">Every item is light enough to fly. Up to 300 g per delivery.</p>
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1 md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="Search fever, asthma, wound…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          </label>
          <select className="input w-auto" value={sort} onChange={(e) => update('sort', e.target.value)} aria-label="Sort">
            <option value="">Recommended</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="weight">Lightest first</option>
          </select>
        </div>
      </div>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ name: '', count: categories?.reduce((s, c) => s + c.count, 0) ?? 0 }, ...(categories ?? [])].map((c) => (
          <button
            key={c.name || 'all'}
            onClick={() => update('category', c.name)}
            className={cx(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition',
              category === c.name ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-panel text-slate-300 hover:border-white/20',
            )}
          >
            {c.name || 'All'} <span className="opacity-60">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <ErrorNote>{error}</ErrorNote>
        {loading && !products ? (
          <PageLoader />
        ) : products?.length === 0 ? (
          <Empty icon={<SearchX className="h-6 w-6" />} title="Nothing found">
            Try another search or category.
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products?.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
