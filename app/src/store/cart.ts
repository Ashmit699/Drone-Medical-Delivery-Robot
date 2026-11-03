import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../lib/types';

export interface CartLine {
  productId: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  weightG: number;
  rxRequired: boolean;
  icon: string;
  stock: number;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  add: (p: Product, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (p, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.productId === p.id);
          if (existing) {
            return { lines: s.lines.map((l) => (l.productId === p.id ? { ...l, qty: Math.min(l.qty + qty, p.stock, 20) } : l)) };
          }
          const line: CartLine = {
            productId: p.id,
            slug: p.slug,
            name: p.name,
            category: p.category,
            price: p.price,
            weightG: p.weight_g,
            rxRequired: !!p.rx_required,
            icon: p.icon,
            stock: p.stock,
            qty: Math.min(qty, p.stock),
          };
          return { lines: [...s.lines, line] };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          lines: qty <= 0 ? s.lines.filter((l) => l.productId !== productId) : s.lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, l.stock, 20) } : l)),
        })),
      remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'medidrop-cart' },
  ),
);

export const cartTotals = (lines: CartLine[]) => ({
  count: lines.reduce((s, l) => s + l.qty, 0),
  subtotal: lines.reduce((s, l) => s + l.price * l.qty, 0),
  weightG: lines.reduce((s, l) => s + l.weightG * l.qty, 0),
  rxRequired: lines.some((l) => l.rxRequired),
});
