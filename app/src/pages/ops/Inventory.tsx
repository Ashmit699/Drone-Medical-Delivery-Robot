import { Search } from 'lucide-react';
import { useState } from 'react';
import { ProductIcon } from '../../components/ProductIcon';
import { ErrorNote, PageLoader } from '../../components/ui';
import { api, useApi } from '../../lib/api';
import { cx } from '../../lib/format';
import type { Product } from '../../lib/types';

function NumberCell({ value, onSave, prefix }: { value: number; onSave: (n: number) => Promise<void>; prefix?: string }) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const dirty = draft !== String(value);
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Number(draft);
        if (!Number.isInteger(n) || n < 0) return setDraft(String(value));
        setSaving(true);
        await onSave(n);
        setSaving(false);
      }}
    >
      {prefix && <span className="text-slate-500">{prefix}</span>}
      <input className={cx('input w-20 px-2 py-1 tabular-nums', dirty && 'border-amber-400')} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} />
      {dirty && (
        <button className="btn-primary px-2 py-1 text-xs" disabled={saving}>
          Save
        </button>
      )}
    </form>
  );
}

export default function Inventory() {
  const { data, setData, loading } = useApi<Product[]>('/products');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async (id: number, body: { stock?: number; price?: number }) => {
    setError(null);
    try {
      const p = await api<Product>(`/ops/products/${id}`, { method: 'PATCH', body });
      setData((ps) => (ps ?? []).map((x) => (x.id === id ? p : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading && !data) return <PageLoader />;
  const rows = (data ?? []).filter((p) => !q || `${p.name} ${p.category}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inventory</h1>
          <p className="text-sm text-slate-400">{data?.filter((p) => p.stock <= 5).length ?? 0} items low on stock</p>
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
        </label>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Weight</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((p) => (
              <tr key={p.id} className={cx(p.stock <= 5 && 'bg-amber-500/5')}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <ProductIcon icon={p.icon} category={p.category} size="sm" />
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      {!!p.rx_required && <span className="text-xs font-semibold text-violet-400">Prescription required</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-300">{p.category}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-300">{p.weight_g} g</td>
                <td className="px-4 py-2.5">
                  <NumberCell key={`p${p.price}`} value={p.price} prefix="₹" onSave={(price) => save(p.id, { price })} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <NumberCell key={`s${p.stock}`} value={p.stock} onSave={(stock) => save(p.id, { stock })} />
                    {p.stock <= 5 && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">{p.stock === 0 ? 'OUT' : 'LOW'}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
