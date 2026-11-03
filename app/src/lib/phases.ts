import type { MissionPhase, OrderDetail, OrderStatus, Priority } from './types';

export const PHASE_LABELS: Record<MissionPhase, string> = {
  idle: 'Idle at base',
  preflight: 'Pre-flight checks',
  takeoff: 'Taking off',
  cruise: 'En route',
  approach: 'Approaching drop zone',
  aligning: 'Aligning over marker',
  awaiting_clearance: 'Waiting for area clear',
  lowering: 'Lowering package',
  releasing: 'Releasing package',
  retracting: 'Reeling rope in',
  returning: 'Returning to base',
  landing: 'Landing',
  completed: 'Mission complete',
  aborted: 'Mission aborted',
};

export const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  placed: { label: 'Awaiting approval', tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  approved: { label: 'Approved · packing', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  in_flight: { label: 'In flight', tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  delivered: { label: 'Delivered', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'Rejected', tone: 'bg-red-50 text-red-700 ring-red-200' },
  cancelled: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-500 ring-slate-200' },
  failed: { label: 'Failed · returned', tone: 'bg-red-50 text-red-700 ring-red-200' },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: string; blurb: string }> = {
  standard: { label: 'Standard', tone: 'bg-slate-100 text-slate-700', blurb: 'Dispatched in order' },
  express: { label: 'Express', tone: 'bg-amber-100 text-amber-800', blurb: 'Skips the standard queue' },
  emergency: { label: 'Emergency', tone: 'bg-red-100 text-red-700', blurb: 'Next drone out, free of charge' },
};

/** Customer-facing journey. Each step completes when the order reaches one of its phases/statuses. */
export const JOURNEY = [
  { key: 'placed', title: 'Order placed', hint: 'We have received your request' },
  { key: 'approved', title: 'Approved & packed', hint: 'Pharmacist checked your items' },
  { key: 'dispatched', title: 'Drone took off', hint: 'Package secured in the gripper' },
  { key: 'cruise', title: 'On the way', hint: 'Flying by GPS at cruise altitude' },
  { key: 'arriving', title: 'Arriving', hint: 'Precision alignment over your marker' },
  { key: 'clearance', title: 'Waiting for you', hint: 'Confirm the drop area is clear' },
  { key: 'lowering', title: 'Lowering package', hint: 'Winch lowers the box on a rope' },
  { key: 'delivered', title: 'Delivered', hint: 'Hooks released, drone heading home' },
] as const;

const PHASE_STEP: Partial<Record<MissionPhase, number>> = {
  preflight: 2,
  takeoff: 2,
  cruise: 3,
  approach: 4,
  aligning: 4,
  awaiting_clearance: 5,
  lowering: 6,
  releasing: 7,
  retracting: 7,
  returning: 7,
  landing: 7,
  completed: 7,
};

/** Index of the current journey step (all earlier steps are done). */
export function journeyStep(o: Pick<OrderDetail, 'status' | 'mission_phase'>): number {
  if (o.status === 'delivered') return 7;
  if (o.status === 'in_flight' && o.mission_phase) return PHASE_STEP[o.mission_phase] ?? 2;
  if (o.status === 'approved') return 1;
  return 0;
}

/** When did each journey step happen? Derived from the order's event log. */
export function journeyTimes(o: OrderDetail): (string | undefined)[] {
  const at = (...types: string[]) => o.events.find((e) => types.includes(e.type))?.created_at;
  return [
    at('placed'),
    at('approved'),
    at('phase:takeoff', 'dispatched'),
    at('phase:cruise'),
    at('phase:approach'),
    at('phase:awaiting_clearance'),
    at('phase:lowering'),
    at('phase:releasing'),
  ];
}
