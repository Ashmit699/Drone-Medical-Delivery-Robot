// Small shared UI pieces.
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/format';
import { PRIORITY_META, STATUS_META } from '../lib/phases';
import type { OrderStatus, Priority } from '../lib/types';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', m.tone)}>{m.label}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', m.tone)}>{m.label}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-brand-400', className ?? 'h-6 w-6')} />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{children}</div>;
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-400">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="mt-2 max-w-sm text-sm text-slate-400">{children}</div>}
    </div>
  );
}

/** Payload weight vs. what the drone can lift. */
export function PayloadMeter({ weightG, maxG, compact }: { weightG: number; maxG: number; compact?: boolean }) {
  const pct = Math.min(100, (weightG / maxG) * 100);
  const over = weightG > maxG;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
        <span className="text-slate-400">{compact ? 'Payload' : 'Drone payload'}</span>
        <span className={over ? 'text-red-400' : 'text-slate-200'}>
          {weightG} / {maxG} g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cx('h-full rounded-full transition-all duration-500', over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-brand-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && !compact && <p className="mt-1.5 text-xs text-red-400">Too heavy for one flight. Remove {weightG - maxG} g to continue.</p>}
    </div>
  );
}

/** Safety-critical actions need a deliberate press-and-hold, not a tap. */
export function HoldButton({
  onComplete,
  children,
  className,
  holdMs = 1000,
  disabled,
}: {
  onComplete: () => void;
  children: ReactNode;
  className?: string;
  holdMs?: number;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef<number>(0);

  const cancel = () => {
    start.current = null;
    cancelAnimationFrame(raf.current);
    setProgress(0);
  };

  const step = () => {
    if (start.current == null) return;
    const p = Math.min(1, (performance.now() - start.current) / holdMs);
    setProgress(p);
    if (p >= 1) {
      start.current = null;
      setProgress(0);
      onComplete();
    } else {
      raf.current = requestAnimationFrame(step);
    }
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <button
      type="button"
      disabled={disabled}
      className={cx('relative select-none overflow-hidden', className ?? 'btn-primary')}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = performance.now();
        raf.current = requestAnimationFrame(step);
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && start.current == null) {
          e.preventDefault();
          start.current = performance.now();
          raf.current = requestAnimationFrame(step);
        }
      }}
      onKeyUp={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${progress * 100}%` }} />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

export function Stat({ label, value, icon, hint }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={cx('card max-h-[90vh] w-full overflow-y-auto p-6', wide ? 'max-w-2xl' : 'max-w-md')} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
