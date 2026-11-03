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

// Each category glows in its own neon colour.
export const CATEGORY_TONE: Record<string, { tile: string; glow: string }> = {
  Emergency: { tile: 'from-rose-500/25 via-rose-500/5 to-transparent text-rose-300', glow: 'shadow-[0_0_40px_-12px_rgba(244,63,94,0.6)]' },
  'First Aid': { tile: 'from-orange-500/25 via-orange-500/5 to-transparent text-orange-300', glow: 'shadow-[0_0_40px_-12px_rgba(249,115,22,0.6)]' },
  Medicines: { tile: 'from-brand-400/25 via-brand-400/5 to-transparent text-brand-300', glow: 'shadow-[0_0_40px_-12px_rgba(34,229,211,0.6)]' },
  Diagnostics: { tile: 'from-violet-500/25 via-violet-500/5 to-transparent text-violet-300', glow: 'shadow-[0_0_40px_-12px_rgba(139,92,246,0.6)]' },
  'Cold Chain': { tile: 'from-sky-500/25 via-sky-500/5 to-transparent text-sky-300', glow: 'shadow-[0_0_40px_-12px_rgba(14,165,233,0.6)]' },
  'Relief & Survival': { tile: 'from-amber-500/25 via-amber-500/5 to-transparent text-amber-300', glow: 'shadow-[0_0_40px_-12px_rgba(245,158,11,0.6)]' },
  'Mother & Baby': { tile: 'from-pink-500/25 via-pink-500/5 to-transparent text-pink-300', glow: 'shadow-[0_0_40px_-12px_rgba(236,72,153,0.6)]' },
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
      <Icon className={cx('relative drop-shadow-[0_0_12px_currentColor]', glyph)} strokeWidth={1.5} />
    </div>
  );
}
