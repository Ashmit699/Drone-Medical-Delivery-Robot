import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';
export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  href?: string;
}

interface UiState {
  toasts: Toast[];
  cartOpen: boolean;
  sosOpen: boolean;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setCartOpen: (open: boolean) => void;
  setSosOpen: (open: boolean) => void;
}

let nextId = 1;

export const useUi = create<UiState>()((set, get) => ({
  toasts: [],
  cartOpen: false,
  sosOpen: false,
  pushToast: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), t.tone === 'error' ? 7000 : 5000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setSosOpen: (sosOpen) => set({ sosOpen }),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUi.getState().pushToast(t);
