import {
  Activity,
  Baby,
  Bandage,
  BriefcaseMedical,
  Droplet,
  HeartPulse,
  Package,
  Pill,
  ShieldPlus,
  Snowflake,
  Syringe,
  TestTube,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../lib/format';

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  baby: Baby,
  bandage: Bandage,
  'briefcase-medical': BriefcaseMedical,
  droplet: Droplet,
  'heart-pulse': HeartPulse,
  pill: Pill,
  'shield-plus': ShieldPlus,
  snowflake: Snowflake,
  syringe: Syringe,
  'test-tube': TestTube,
  thermometer: Thermometer,
  wind: Wind,
};

export const CATEGORY_TONE: Record<string, string> = {
  Emergency: 'from-red-100 to-rose-50 text-red-600',
  'First Aid': 'from-orange-100 to-amber-50 text-orange-600',
  Medicines: 'from-brand-100 to-brand-50 text-brand-700',
  Diagnostics: 'from-violet-100 to-indigo-50 text-violet-600',
  'Cold Chain': 'from-sky-100 to-cyan-50 text-sky-600',
  'Mother & Baby': 'from-pink-100 to-fuchsia-50 text-pink-600',
};

export function ProductIcon({ icon, category, size = 'md' }: { icon: string; category: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[icon] ?? Package;
  const box = { sm: 'h-12 w-12 rounded-xl', md: 'h-full w-full rounded-2xl', lg: 'h-full w-full rounded-3xl' }[size];
  const glyph = { sm: 'h-6 w-6', md: 'h-12 w-12', lg: 'h-24 w-24' }[size];
  return (
    <div className={cx('grid shrink-0 place-items-center bg-gradient-to-br', box, CATEGORY_TONE[category] ?? 'from-slate-100 to-slate-50 text-slate-500')}>
      <Icon className={glyph} strokeWidth={1.6} />
    </div>
  );
}
