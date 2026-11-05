// Welfare subsidy: BPL / SC / ST / EWS families get a discount on their monthly Aerolift Care
// plan once an operator has checked their document.
import { one } from './db';

export type WelfareCategory = 'BPL' | 'SC' | 'ST' | 'EWS';
export const WELFARE_DISCOUNT: Record<WelfareCategory, number> = { BPL: 50, SC: 40, ST: 40, EWS: 30 };
export const WELFARE_LABEL: Record<WelfareCategory, string> = {
  BPL: 'Below Poverty Line family',
  SC: 'Scheduled Caste beneficiary',
  ST: 'Scheduled Tribe beneficiary',
  EWS: 'Economically Weaker Section',
};

export interface WelfareRow {
  id: number;
  user_id: number;
  category: WelfareCategory;
  doc_id: string;
  full_name: string;
  location: string;
  status: 'pending' | 'verified' | 'rejected';
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Active discount for a user, or null if not verified. */
export function welfareDiscount(userId: number | undefined): { pct: number; category: WelfareCategory } | null {
  if (!userId) return null;
  const w = one<WelfareRow>(`SELECT * FROM welfare WHERE user_id = ? AND status = 'verified'`, userId);
  return w ? { pct: WELFARE_DISCOUNT[w.category], category: w.category } : null;
}

/** Customers only ever see the last 4 characters of their document number. */
export const maskDoc = (doc: string) => (doc.length <= 4 ? doc : `${'•'.repeat(Math.min(8, doc.length - 4))}${doc.slice(-4)}`);
