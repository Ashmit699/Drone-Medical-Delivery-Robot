import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cx } from '../lib/format';
import { useUi, type ToastTone } from '../store/ui';

const TONE: Record<ToastTone, { icon: typeof Info; ring: string; iconCls: string }> = {
  info: { icon: Info, ring: 'border-cyan-400/30', iconCls: 'text-cyan-300' },
  success: { icon: CheckCircle2, ring: 'border-emerald-400/30', iconCls: 'text-emerald-300' },
  warning: { icon: AlertTriangle, ring: 'border-amber-400/40', iconCls: 'text-amber-300' },
  error: { icon: XCircle, ring: 'border-rose-400/40', iconCls: 'text-rose-300' },
};

export function Toaster() {
  const { toasts, dismissToast } = useUi();
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const m = TONE[t.tone];
        return (
          <div
            key={t.id}
            className={cx('pointer-events-auto flex animate-fade-up items-start gap-3 rounded-2xl border bg-panel/95 p-4 shadow-2xl backdrop-blur-xl', m.ring, t.href && 'cursor-pointer')}
            onClick={() => {
              if (t.href) {
                navigate(t.href);
                dismissToast(t.id);
              }
            }}
          >
            <m.icon className={cx('mt-0.5 h-5 w-5 shrink-0', m.iconCls)} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs text-slate-400">{t.body}</div>}
            </div>
            <button
              className="text-slate-500 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(t.id);
              }}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
