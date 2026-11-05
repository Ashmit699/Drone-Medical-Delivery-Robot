import { useEffect, useRef } from 'react';
import { useAuth } from '../store/auth';
import { toast, type ToastTone } from '../store/ui';
import { getSocket } from './api';
import type { OrderDetail } from './types';

// Which order events are worth a pop-up, and how they look.
const CUSTOMER: Record<string, ToastTone> = {
  approved: 'success',
  rejected: 'error',
  dispatched: 'info',
  'phase:approach': 'info',
  'phase:awaiting_clearance': 'warning',
  'phase:releasing': 'success',
  failed: 'error',
};
const OPERATOR: Record<string, ToastTone> = {
  placed: 'info',
  'phase:awaiting_clearance': 'warning',
  failed: 'error',
};

/** Live pop-ups for the logged-in user: their order milestones, or new work for operators. */
export function useNotifications() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const seen = useRef(new Set<number>());

  useEffect(() => {
    if (!user) return;
    const s = getSocket();
    const onOrder = (o: OrderDetail) => {
      const e = o.events.at(-1);
      if (!e || seen.current.has(e.id)) return;
      seen.current.add(e.id);
      const isOps = user.role === 'operator';
      const tone = isOps ? OPERATOR[e.type] : o.user_id === user.id ? CUSTOMER[e.type] : undefined;
      if (!tone) return;
      toast({
        tone,
        title: isOps && e.type === 'placed' ? `New ${o.priority} order ${o.code}` : `${o.code}: ${e.message}`,
        body: isOps ? `${o.customer_name} · ${o.address_label}` : e.type === 'phase:awaiting_clearance' ? 'Tap to confirm the drop zone is clear' : undefined,
        href: isOps ? `/ops/orders?open=${o.id}` : `/orders/${o.id}`,
      });
    };
    const onWelfare = (w: { status: string; discountPct: number; note: string | null }) =>
      toast(
        w.status === 'verified'
          ? { tone: 'success', title: `Welfare verified: ${w.discountPct}% off`, body: 'Your Aerolift Care plan is now cheaper', href: '/plans' }
          : { tone: 'error', title: 'Welfare request not approved', body: w.note ?? 'Please check your document details', href: '/welfare' },
      );
    const onWelfareNew = (w: { name: string; category: string }) =>
      toast({ tone: 'info', title: 'New welfare verification request', body: `${w.name} · ${w.category}`, href: '/ops/welfare' });

    s.on('order:update', onOrder);
    s.on('welfare:update', onWelfare);
    s.on('welfare:new', onWelfareNew);
    return () => {
      s.off('order:update', onOrder);
      s.off('welfare:update', onWelfare);
      s.off('welfare:new', onWelfareNew);
    };
  }, [user, token]);
}
