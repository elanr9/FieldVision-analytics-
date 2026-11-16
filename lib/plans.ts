/**
 * Every plan Inkbound has sold, keyed by `user_subscriptions.payment_type`. The one place the dashboard
 * writes a price down. Current prices mirror the athlete app (inkbound-web src/lib/plans.ts and
 * supabase/functions/_shared/stripe.ts); the rest are plans people are still billed on or once were.
 *
 * The same payment_type can sit on different Stripe prices (inkbound_elite_annual is $299 today and $300
 * for subscribers from before the price change), so a label read from the live Stripe price always wins
 * over this table. See stripePriceLabel.
 */
export type PlanPeriod = 'weekly' | 'monthly' | 'quarterly' | 'semester' | 'annual' | 'lifetime';

export interface PlanDef {
  /** Whole dollars per billing period. */
  dollars: number;
  period: PlanPeriod;
  /** Card-on-file free trial the checkout grants, in days. 0 means charged at checkout. */
  trialDays: number;
  /** Sold on a paywall today. */
  current: boolean;
}

export const PLANS: Record<string, PlanDef> = {
  // Sold today: the web paywall is Elite only.
  inkbound_elite_annual: { dollars: 299, period: 'annual', trialDays: 3, current: true },
  inkbound_elite_monthly: { dollars: 49, period: 'monthly', trialDays: 0, current: true },
  // Still sold by the mobile app and parent invites.
  inkbound_annual: { dollars: 200, period: 'annual', trialDays: 0, current: true },
  inkbound_monthly: { dollars: 20, period: 'monthly', trialDays: 0, current: true },
  // Wheel-era fixed promo prices; the wheel now applies a $30 or $150 credit to elite annual instead.
  inkbound_elite_annual_promo: { dollars: 100, period: 'annual', trialDays: 0, current: false },
  inkbound_elite_annual_promo_10: { dollars: 270, period: 'annual', trialDays: 0, current: false },
  inkbound_basic_annual: { dollars: 200, period: 'annual', trialDays: 0, current: false },
  inkbound_basic_monthly: { dollars: 25, period: 'monthly', trialDays: 0, current: false },
  inkbound_semester: { dollars: 120, period: 'semester', trialDays: 3, current: false },
  inkbound_offer: { dollars: 60, period: 'semester', trialDays: 3, current: false },
  inkbound_quarterly: { dollars: 60, period: 'quarterly', trialDays: 3, current: false },
  inkbound_weekly: { dollars: 10, period: 'weekly', trialDays: 0, current: false },
  // FieldVision era.
  yearly_240_trial: { dollars: 240, period: 'annual', trialDays: 7, current: false },
  monthly_29_99: { dollars: 30, period: 'monthly', trialDays: 7, current: false },
  monthly_99: { dollars: 99, period: 'monthly', trialDays: 0, current: false },
  lifetime_499: { dollars: 499, period: 'lifetime', trialDays: 0, current: false },
  monthly_499: { dollars: 499, period: 'lifetime', trialDays: 0, current: false },
  lifetime_trial: { dollars: 499, period: 'lifetime', trialDays: 0, current: false },
  lifetime: { dollars: 499, period: 'lifetime', trialDays: 0, current: false },
  one_time: { dollars: 499, period: 'lifetime', trialDays: 0, current: false },
};

/** payment_type values the billing functions write as a state, not a plan. */
const STATE_PAYMENT_TYPES = /^(canceled|trial_expired|subscription|stripe_sync|checkout)$|pending|expired/;

export function isPlanKey(paymentType: string | null | undefined): paymentType is string {
  return Boolean(paymentType) && !STATE_PAYMENT_TYPES.test(paymentType as string);
}

/** "$299 annual". Falls back to a readable version of the key for a plan this table has not met. */
export function planLabel(paymentType: string | null | undefined): string | null {
  if (!paymentType) return null;
  const def = PLANS[paymentType];
  if (def) return `$${def.dollars} ${def.period}`;
  if (!isPlanKey(paymentType)) return null;
  const words = paymentType.replace(/^inkbound_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Days of card-on-file trial a plan grants, or null when the plan is unknown. */
export function planTrialDays(paymentType: string | null | undefined): number | null {
  return paymentType && PLANS[paymentType] ? PLANS[paymentType].trialDays : null;
}

/** The plans a paywall sells today, most expensive first. */
export function currentPlanKeys(): string[] {
  return Object.entries(PLANS)
    .filter(([, def]) => def.current)
    .sort(([, a], [, b]) => b.dollars - a.dollars)
    .map(([key]) => key);
}

const INTERVAL_WORDS: Record<string, string> = { day: 'daily', week: 'weekly', month: 'monthly', year: 'annual' };

export interface StripePriceShape {
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number } | null;
}

/** "$299 annual" from a live Stripe price, so a price change can never leave a stale label. */
export function stripePriceLabel(price: StripePriceShape | null | undefined): string | null {
  if (!price?.unit_amount || !price.recurring) return null;
  const dollars = Math.round(price.unit_amount / 100);
  const { interval, interval_count: count } = price.recurring;
  if (interval === 'month' && count === 3) return `$${dollars} quarterly`;
  if (interval === 'month' && count === 6) return `$${dollars} semester`;
  if (count !== 1) return `$${dollars} every ${count} ${interval}s`;
  return `$${dollars} ${INTERVAL_WORDS[interval] ?? interval}`;
}

const PERIOD_MONTHS: Record<PlanPeriod, number> = { weekly: 12 / 52, monthly: 1, quarterly: 3, semester: 6, annual: 12, lifetime: 0 };

/** Monthly normalized catalogue price in cents. Lifetime is a one time charge, so 0. */
export function planMonthlyCents(paymentType: string): number | null {
  const def = PLANS[paymentType];
  if (!def) return null;
  const months = PERIOD_MONTHS[def.period];
  return months === 0 ? 0 : Math.round((def.dollars * 100) / months);
}
