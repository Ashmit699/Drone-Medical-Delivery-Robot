import {
  Activity,
  Baby,
  Bandage,
  BriefcaseMedical,
  Compass,
  Droplet,
  Flashlight,
  HeartPulse,
  Package,
  Pill,
  ShieldPlus,
  Snowflake,
  Sprout,
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
  compass: Compass,
  droplet: Droplet,
  flashlight: Flashlight,
  'heart-pulse': HeartPulse,
  pill: Pill,
  'shield-plus': ShieldPlus,
  snowflake: Snowflake,
  sprout: Sprout,
  syringe: Syringe,
  'test-tube': TestTube,
  thermometer: Thermometer,
  wind: Wind,
};

// Category tints, kept within the palette: coral is reserved for Emergency.
export const CATEGORY_TONE: Record<string, { tile: string; glow: string }> = {
  Emergency: { tile: 'from-rose-500/15 to-transparent text-rose-400', glow: '' },
  'First Aid': { tile: 'from-emerald-300/10 to-transparent text-emerald-300', glow: '' },
  Medicines: { tile: 'from-brand-400/15 to-transparent text-brand-400', glow: '' },
  Diagnostics: { tile: 'from-violet-400/15 to-transparent text-violet-300', glow: '' },
  'Cold Chain': { tile: 'from-brand-200/10 to-transparent text-brand-200', glow: '' },
  'Relief & Survival': { tile: 'from-slate-400/15 to-transparent text-slate-300', glow: '' },
  'Mother & Baby': { tile: 'from-violet-300/10 to-transparent text-violet-200', glow: '' },
};
const FALLBACK = { tile: 'from-slate-500/20 to-transparent text-slate-300', glow: '' };

export const categoryIcon = (category: string): LucideIcon =>
  ({
    Emergency: HeartPulse,
    'First Aid': BriefcaseMedical,
    Medicines: Pill,
    Diagnostics: Activity,
    'Cold Chain': Snowflake,
    'Relief & Survival': ShieldPlus,
    'Mother & Baby': Baby,
  })[category] ?? Package;

export function ProductIcon({ icon, category, size = 'md' }: { icon: string; category: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[icon] ?? Package;
  const tone = CATEGORY_TONE[category] ?? FALLBACK;
  const box = { sm: 'h-12 w-12 rounded-xl', md: 'h-full w-full rounded-2xl', lg: 'h-full w-full rounded-3xl' }[size];
  const glyph = { sm: 'h-6 w-6', md: 'h-12 w-12', lg: 'h-24 w-24' }[size];
  return (
    <div className={cx('relative grid shrink-0 place-items-center overflow-hidden border border-white/[0.06] bg-gradient-to-br', box, tone.tile)}>
      {size !== 'sm' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:12px_12px]" />
      )}
      <Icon className={cx('relative', glyph)} strokeWidth={1.5} />
    </div>
  );
}
