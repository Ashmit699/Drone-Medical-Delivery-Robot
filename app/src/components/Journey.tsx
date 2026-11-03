import { Check } from 'lucide-react';
import { cx, time } from '../lib/format';
import { JOURNEY, journeyStep, journeyTimes } from '../lib/phases';
import type { OrderDetail } from '../lib/types';

export function Journey({ order }: { order: OrderDetail }) {
  const step = journeyStep(order);
  const times = journeyTimes(order);
  const stopped = ['rejected', 'cancelled', 'failed'].includes(order.status);

  return (
    <ol className="relative">
      {JOURNEY.map((j, i) => {
        const done = i < step || (i === step && order.status === 'delivered');
        const current = i === step && !done && !stopped;
        return (
          <li key={j.key} className="relative flex gap-4 pb-5 last:pb-0">
            {i < JOURNEY.length - 1 && <span className={cx('absolute left-[15px] top-8 h-[calc(100%-24px)] w-0.5', i < step ? 'bg-brand-500' : 'bg-slate-200')} />}
            <span
              className={cx(
                'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold',
                done ? 'bg-brand-600 text-white' : current ? 'bg-white text-brand-700 ring-4 ring-brand-100 border-2 border-brand-500' : 'bg-slate-100 text-slate-400',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : current ? <span className="h-2.5 w-2.5 animate-ping rounded-full bg-brand-500" /> : i + 1}
            </span>
            <div className="pt-1">
              <div className={cx('text-sm font-semibold', !done && !current && 'text-slate-400')}>{j.title}</div>
              <div className="text-xs text-slate-500">
                {times[i] && (done || current) ? `${time(times[i]!)} · ` : ''}
                {j.hint}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
