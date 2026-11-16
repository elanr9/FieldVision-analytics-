import { cache } from 'react';
import Stripe from 'stripe';
import { dayKey } from './dates';
import { stripePriceLabel } from './plans';

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

export function stripeClient(): Stripe | null {
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

function isFullyDiscounted(sub: Stripe.Subscription): boolean {
  return (sub.discounts ?? []).some(d => typeof d !== 'string' && d.coupon?.percent_off === 100);
}

/** What Stripe says about one subscription right now. Supabase rows lag or omit all of this. */
export interface SubscriptionState {
  id: string;
  /** metadata.user_id set by the checkout; null on subscriptions created by hand. */
  userId: string | null;
  status: Stripe.Subscription.Status;
  /** Running on a 100 percent off coupon, e.g. an internal tester. */
  fullyDiscounted: boolean;
  hasDiscount: boolean;
  trialStartAt: string | null;
  trialEndAt: string | null;
  /** Still active, but set to end when the paid period runs out. */
  cancelAtPeriodEnd: boolean;
  /** When access ends for a scheduled cancellation. */
  cancelAt: string | null;
  canceledAt: string | null;
  /** "$299 annual" from the live price. */
  priceLabel: string | null;
  /** Monthly normalized amount in cents. */
  mrrCents: number;
  planType: string | null;
  createdAt: string;
}

function unixIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function toState(sub: Stripe.Subscription): SubscriptionState {
  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  return {
    id: sub.id,
    userId: sub.metadata?.user_id ?? null,
    status: sub.status,
    fullyDiscounted: isFullyDiscounted(sub),
    hasDiscount: hasActiveDiscount(sub),
    trialStartAt: unixIso(sub.trial_start),
    trialEndAt: unixIso(sub.trial_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: unixIso(sub.cancel_at) ?? (sub.cancel_at_period_end ? unixIso(periodEnd) : null),
    canceledAt: unixIso(sub.canceled_at) ?? unixIso(sub.ended_at),
    priceLabel: stripePriceLabel(sub.items.data[0]?.price),
    mrrCents: mrrFromSubscription(sub),
    planType: sub.metadata?.plan_type ?? sub.metadata?.plan ?? null,
    createdAt: new Date(sub.created * 1000).toISOString(),
  };
}

async function listSubscriptionStates(): Promise<Map<string, SubscriptionState>> {
  const states = new Map<string, SubscriptionState>();
  const stripe = stripeClient();
  if (!stripe || keyProblem()) return states;
  let startingAfter: string | undefined;
  for (let page = 0; page < 50; page++) {
    const batch = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.discounts'],
    });
    for (const sub of batch.data) states.set(sub.id, toState(sub));
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1].id;
  }
  return states;
}

/**
 * Every Stripe subscription, keyed by id. Inkbound never records charge amounts, trial ends or scheduled
 * cancellations reliably, so only Stripe can say who is really trialing, paying or on the way out.
 * One listing per request: the user loader and the revenue snapshot share it.
 */
export const loadSubscriptionStates = cache(listSubscriptionStates);

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
  let states: Map<string, SubscriptionState>;
  try {
    [paymentIntents, states] = await Promise.all([listAllSucceededPaymentIntents(stripe), loadSubscriptionStates()]);
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

  for (const sub of states.values()) {
    if (sub.status !== 'active' && sub.status !== 'past_due') continue;
    if (sub.userId && excludedUserIds.has(sub.userId)) continue;
    if (isLifetimePlan(sub.planType)) continue;
    if (sub.hasDiscount) continue;
    // A past due subscriber who already asked to cancel will not recover; Stripe drops them from MRR too.
    if (sub.status === 'past_due' && sub.cancelAtPeriodEnd) continue;
    activeSubscriptionCount++;
    mrrCents += sub.mrrCents;
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
