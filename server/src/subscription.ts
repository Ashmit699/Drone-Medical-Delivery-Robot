// MediDrop Care plans: members pay a monthly subscription (like health insurance for deliveries)
// and every emergency drone delivery, supplies included, is free whenever they need it.
import { one, run } from './db';
import { welfareDiscount } from './welfare';

export type PlanId = 'personal' | 'family' | 'care_plus';

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  members: number;
  /** Free emergency deliveries per month (fair use). null = unlimited. */
  deliveriesPerMonth: number | null;
  /** Value of supplies covered per delivery (₹). */
  coverPerDelivery: number;
  perks: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'personal',
    name: 'Personal',
    priceMonthly: 99,
    members: 1,
    deliveriesPerMonth: 4,
    coverPerDelivery: 1000,
    perks: ['4 free emergency deliveries / month', 'Supplies up to ₹1,000 per delivery covered', '24×7 SOS button', 'Live drone tracking'],
  },
  {
    id: 'family',
    name: 'Family',
    priceMonthly: 249,
    members: 5,
    deliveriesPerMonth: 10,
    coverPerDelivery: 1500,
    popular: true,
    perks: ['Up to 5 family members', '10 free emergency deliveries / month', 'Supplies up to ₹1,500 per delivery covered', 'Saved home, school & office drop points'],
  },
  {
    id: 'care_plus',
    name: 'Care+',
    priceMonthly: 449,
    members: 5,
    deliveriesPerMonth: null,
    coverPerDelivery: 3000,
    perks: ['Unlimited emergency deliveries', 'Supplies up to ₹3,000 per delivery covered', 'Cold-chain insulin & vaccines', 'Priority pharmacist call-back'],
  },
];

export const getPlan = (id: string) => PLANS.find((p) => p.id === id);

export interface SubscriptionRow {
  id: number;
  user_id: number;
  plan: PlanId;
  status: 'active' | 'cancelled';
  price_paid: number;
  started_at: string;
  renews_at: string;
}

/** Monthly price for this user: verified welfare families get their discount on the plan. */
export function planPrice(plan: Plan, userId?: number) {
  const w = welfareDiscount(userId);
  return w ? Math.round(plan.priceMonthly * (1 - w.pct / 100)) : plan.priceMonthly;
}

/** The user's plan if it is active and paid up, with how many free deliveries are left this period. */
export function activeSubscription(userId: number | undefined) {
  if (!userId) return null;
  const s = one<SubscriptionRow>(`SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' AND renews_at > datetime('now')`, userId);
  const plan = s && getPlan(s.plan);
  if (!s || !plan) return null;
  const used =
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND created_at >= datetime(?, '-1 month') AND status NOT IN ('rejected','cancelled')`,
      userId, s.renews_at,
    )?.n ?? 0;
  return {
    ...s,
    planName: plan.name,
    deliveriesPerMonth: plan.deliveriesPerMonth,
    coverPerDelivery: plan.coverPerDelivery,
    used,
    remaining: plan.deliveriesPerMonth == null ? null : Math.max(0, plan.deliveriesPerMonth - used),
  };
}

/** Start or switch plan. Payment is simulated for the exhibition (UPI autopay). */
export function subscribe(userId: number, planId: PlanId) {
  const plan = getPlan(planId)!;
  run(
    `INSERT INTO subscriptions (user_id, plan, status, price_paid, started_at, renews_at) VALUES (?, ?, 'active', ?, datetime('now'), datetime('now', '+1 month'))
     ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, status = 'active', price_paid = excluded.price_paid,
       started_at = excluded.started_at, renews_at = excluded.renews_at`,
    userId, plan.id, planPrice(plan, userId),
  );
}
