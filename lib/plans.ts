/**
 * The live Inkbound plans, keyed by the Stripe payment_type the checkout writes to user_subscriptions.
 * Single source for every plan name the dashboard prints: the paywall tiles, the Users and profile
 * screens, the conversion report and the founder notifications all read this map, so a price change
 * is one edit instead of four that drift apart.
 */
export const PLAN_LABELS: Record<string, string> = {
  inkbound_semester: '$120 semester',
  inkbound_offer: '$60 semester',
  inkbound_monthly: '$40 monthly',
  inkbound_quarterly: '$60 quarterly',
  inkbound_weekly: '$10 weekly',
  yearly_240_trial: '$240 yearly',
  monthly_29_99: '$30 monthly',
  lifetime_499: '$499 lifetime',
  lifetime: '$499 lifetime',
  one_time: '$499 lifetime',
};

/** Label for a payment_type, falling back to a readable form of the slug so a new price still reads fine. */
export function planLabelFor(paymentType: string): string {
  const known = PLAN_LABELS[paymentType];
  if (known) return known;
  const words = paymentType.replace(/^inkbound_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
