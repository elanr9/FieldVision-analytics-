import Stripe from 'stripe';
import { dayKey } from './dates';

export interface RevenueEvent {
  paidAt: string;
  cents: number;
  planType: string | null;
  userId: string | null;
}

export interface RevenueSnapshot {
  configured: boolean;
  mrrCents: number;
  activeSubscriptionCount: number;
  events: RevenueEvent[];
  /** Set when the Stripe API call failed. UI shows this instead of numbers. */
  error?: string;
}

// TEMPORARY: inflates all displayed revenue. Set back to 1 to restore real numbers.
const TEMP_DISPLAY_MULTIPLIER = 1;

/**
 * Strips every character that cannot appear in a real Stripe key. Pasting
 * from some sources adds invisible characters (zero width spaces, line
 * breaks) that corrupt the Authorization header and surface as a generic
 * "connection to Stripe" error.
 */
function cleanKey(): string | null {
  const raw = process.env.STRIPE_SECRET_KEY;
  if (!raw) return null;
  const key = raw.replace(/[^\x21-\x7e]/g, '');
  return key.length > 0 ? key : null;
}

/** Returns a human-readable problem with the configured key, or null if it looks fine. */
function keyProblem(): string | null {
  const key = cleanKey();
  if (!key) return null;
  if (key.startsWith('pk_')) {
    return 'STRIPE_SECRET_KEY is set to the publishable key (pk_...). It needs the secret key, which starts with sk_live_. Find it in Stripe Dashboard under Developers, API keys.';
  }
  if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
    return `STRIPE_SECRET_KEY does not look like a Stripe key (it starts with "${key.slice(0, 6)}" and is ${key.length} characters). Paste the sk_live_ secret key from Stripe Dashboard.`;
  }
  return null;
}

function stripeClient(): Stripe | null {
  const key = cleanKey();
  if (!key) return null;
  return new Stripe(key, {
    // Pinned so response shapes match the SDK types regardless of the
    // account's default API version.
    apiVersion: '2025-08-27.basil',
    timeout: 20000,
    maxNetworkRetries: 2,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** Lifetime is sold as a one-time charge but left on a monthly price in Stripe. */
function isLifetimePlan(planType: string | null | undefined): boolean {
  if (!planType) return false;
  return (
    planType.startsWith('lifetime') ||
    planType === 'monthly_499' ||
    planType === 'one_time'
  );
}

function hasActiveDiscount(sub: Stripe.Subscription): boolean {
  return (sub.discounts?.length ?? 0) > 0;
}

async function listAllSucceededPaymentIntents(
  stripe: Stripe,
): Promise<Stripe.PaymentIntent[]> {
  const all: Stripe.PaymentIntent[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < 50; page++) {
    const batch = await stripe.paymentIntents.list({
      limit: 100,
      starting_after: startingAfter,
    });
    all.push(...batch.data);
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1].id;
  }

  return all;
}

/** Months covered by one billing period, e.g. a 6 month price is 6, a yearly price is 12. */
function monthsPerPeriod(recurring: Stripe.Price.Recurring): number | null {
  const count = recurring.interval_count;
  switch (recurring.interval) {
    case 'month':
      return count;
    case 'year':
      return count * 12;
    case 'week':
      return (count * 7) / (365 / 12);
    default:
      return null;
  }
}

/** Monthly normalized amount in cents, floored the same way Stripe does. */
function mrrFromSubscription(sub: Stripe.Subscription): number {
  let mrr = 0;
  for (const item of sub.items.data) {
    const price = item.price;
    if (!price?.unit_amount || !price.recurring) continue;
    const months = monthsPerPeriod(price.recurring);
    if (months === null) continue;
    const amount = price.unit_amount * (item.quantity ?? 1);
    mrr += Math.floor(amount / months);
  }
  return mrr;
}

/**
 * A past due subscriber who has already asked to cancel will not recover, so
 * Stripe drops them from MRR immediately instead of waiting for the cancel.
 */
function isAbandoned(sub: Stripe.Subscription): boolean {
  return sub.status === 'past_due' && sub.cancel_at_period_end;
}

/**
 * Loads Stripe revenue for the whole account. Cash collected comes from
 * succeeded PaymentIntents (matches Stripe gross volume). MRR follows the
 * Stripe Billing definition: active and past_due subscriptions, monthly
 * normalized, ignoring lifetime plans and 100% discounted subscriptions.
 */
export async function loadRevenueSnapshot(
  excludedUserIds: Set<string>,
): Promise<RevenueSnapshot> {
  const stripe = stripeClient();
  if (!stripe) {
    return { configured: false, mrrCents: 0, activeSubscriptionCount: 0, events: [] };
  }

  const problem = keyProblem();
  if (problem) {
    return {
      configured: true,
      mrrCents: 0,
      activeSubscriptionCount: 0,
      events: [],
      error: problem,
    };
  }

  let paymentIntents: Stripe.PaymentIntent[];
  let searchResult: Stripe.ApiSearchResult<Stripe.Subscription>;
  try {
    [paymentIntents, searchResult] = await Promise.all([
      listAllSucceededPaymentIntents(stripe),
      stripe.subscriptions.search({
        query: "status:'active' OR status:'past_due'",
        limit: 100,
      }),
    ]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const key = cleanKey() ?? '';
    const keyInfo = ` (key starts with ${key.slice(0, 8)}..., ${key.length} characters)`;
    return {
      configured: true,
      mrrCents: 0,
      activeSubscriptionCount: 0,
      events: [],
      error: message + keyInfo,
    };
  }

  const events: RevenueEvent[] = [];

  for (const pi of paymentIntents) {
    if (pi.status !== 'succeeded') continue;
    const cents = pi.amount_received ?? 0;
    if (cents <= 0) continue;

    const userId = pi.metadata?.user_id ?? null;
    if (userId && excludedUserIds.has(userId)) continue;

    events.push({
      paidAt: new Date(pi.created * 1000).toISOString(),
      cents,
      planType: pi.metadata?.plan_type ?? null,
      userId,
    });
  }

  events.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  let mrrCents = 0;
  let activeSubscriptionCount = 0;

  for (const sub of searchResult.data) {
    const userId = sub.metadata?.user_id;
    if (userId && excludedUserIds.has(userId)) continue;
    if (isLifetimePlan(sub.metadata?.plan_type)) continue;
    if (hasActiveDiscount(sub)) continue;
    if (isAbandoned(sub)) continue;
    activeSubscriptionCount++;
    mrrCents += mrrFromSubscription(sub);
  }

  return {
    configured: true,
    mrrCents: mrrCents * TEMP_DISPLAY_MULTIPLIER,
    activeSubscriptionCount,
    events: events.map(e => ({ ...e, cents: e.cents * TEMP_DISPLAY_MULTIPLIER })),
  };
}

export function aggregateRevenueInRange(
  events: RevenueEvent[],
  from: Date,
  to: Date,
): { totalCents: number; byDay: { day: string; label: string; cents: number }[] } {
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const byDay = new Map<string, number>();
  let totalCents = 0;

  for (const e of events) {
    const t = new Date(e.paidAt).getTime();
    if (t < fromMs || t > toMs) continue;
    totalCents += e.cents;
    const key = dayKey(new Date(e.paidAt));
    byDay.set(key, (byDay.get(key) ?? 0) + e.cents);
  }

  const byDayList = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, cents]) => ({
      day,
      label: new Date(`${day}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      cents,
    }));

  return { totalCents, byDay: byDayList };
}

export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}
