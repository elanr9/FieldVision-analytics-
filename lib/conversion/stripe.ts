import type Stripe from 'stripe';
import { stripeClient } from '../stripe-revenue';

/** What Stripe knows about one subscription that Supabase does not record. */
export interface StripeSubFacts {
  subscriptionId: string;
  customerId: string | null;
  /** metadata.user_id set by the checkout, null for subscriptions created by hand */
  userId: string | null;
  planType: string | null;
  status: Stripe.Subscription.Status;
  createdAt: string;
  trialEndAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  /** cancellation_details.reason: cancellation_requested, payment_disputed, payment_failed */
  cancelReason: string | null;
  /** cancellation_details.feedback: too_expensive, unused, missing_features, switched_service, ... */
  cancelFeedback: string | null;
  cancelComment: string | null;
  /** Latest invoice is unpaid after at least one attempt, or the subscription is past due or unpaid */
  paymentFailed: boolean;
  /** Every succeeded charge on this customer was refunded in full */
  refunded: boolean;
  /** Sum of succeeded charges on this customer, net of refunds */
  chargedCents: number;
  /** When the first successful charge landed, null when never charged */
  firstChargeAt: string | null;
}

export interface StripeFacts {
  configured: boolean;
  error: string | null;
  bySubscriptionId: Map<string, StripeSubFacts>;
  byUserId: Map<string, StripeSubFacts>;
  byCustomerId: Map<string, StripeSubFacts>;
}

export const EMPTY_STRIPE_FACTS: StripeFacts = {
  configured: false,
  error: null,
  bySubscriptionId: new Map(),
  byUserId: new Map(),
  byCustomerId: new Map(),
};

const PAGE = 100;
const MAX_PAGES = 50;

function iso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

async function listAllSubscriptions(stripe: Stripe): Promise<Stripe.Subscription[]> {
  const all: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await stripe.subscriptions.list({
      status: 'all',
      limit: PAGE,
      starting_after: startingAfter,
      expand: ['data.latest_invoice'],
    });
    all.push(...batch.data);
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1].id;
  }
  return all;
}

async function listAllCharges(stripe: Stripe): Promise<Stripe.Charge[]> {
  const all: Stripe.Charge[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await stripe.charges.list({ limit: PAGE, starting_after: startingAfter });
    all.push(...batch.data);
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1].id;
  }
  return all;
}

interface CustomerCharges {
  chargedCents: number;
  grossCents: number;
  refundedCents: number;
  failed: boolean;
  firstChargeAt: string | null;
}

function chargesByCustomer(charges: Stripe.Charge[]): Map<string, CustomerCharges> {
  const map = new Map<string, CustomerCharges>();
  for (const c of charges) {
    const customerId = idOf(c.customer);
    if (!customerId) continue;
    const current = map.get(customerId) ?? { chargedCents: 0, grossCents: 0, refundedCents: 0, failed: false, firstChargeAt: null };
    if (c.status === 'succeeded' && c.amount > 0) {
      current.chargedCents += c.amount - c.amount_refunded;
      current.grossCents += c.amount;
      current.refundedCents += c.amount_refunded;
      const at = new Date(c.created * 1000).toISOString();
      if (!current.firstChargeAt || at < current.firstChargeAt) current.firstChargeAt = at;
    } else if (c.status === 'failed') {
      current.failed = true;
    }
    map.set(customerId, current);
  }
  return map;
}

function latestInvoiceFailed(sub: Stripe.Subscription): boolean {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === 'string') return false;
  return invoice.status === 'open' && (invoice.attempt_count ?? 0) > 0;
}

function toFacts(sub: Stripe.Subscription, charges: CustomerCharges | undefined): StripeSubFacts {
  const customerId = idOf(sub.customer);
  const details = sub.cancellation_details;
  return {
    subscriptionId: sub.id,
    customerId,
    userId: sub.metadata?.user_id ?? null,
    planType: sub.metadata?.plan_type ?? null,
    status: sub.status,
    createdAt: new Date(sub.created * 1000).toISOString(),
    trialEndAt: iso(sub.trial_end),
    canceledAt: iso(sub.canceled_at) ?? iso(sub.ended_at),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelReason: details?.reason ?? null,
    cancelFeedback: details?.feedback ?? null,
    cancelComment: details?.comment?.trim() || null,
    paymentFailed:
      sub.status === 'past_due' ||
      sub.status === 'unpaid' ||
      sub.status === 'incomplete_expired' ||
      details?.reason === 'payment_failed' ||
      latestInvoiceFailed(sub) ||
      (charges?.failed === true && (charges?.chargedCents ?? 0) === 0),
    refunded: (charges?.grossCents ?? 0) > 0 && (charges?.chargedCents ?? 0) === 0,
    chargedCents: charges?.chargedCents ?? 0,
    firstChargeAt: charges?.firstChargeAt ?? null,
  };
}

/**
 * Loads every Stripe subscription with its cancellation details and the customer's charge history.
 * Read only. Returns an unconfigured result when the key is missing and an error result when Stripe fails,
 * so the Supabase side of the conversion report still renders.
 */
export async function loadStripeFacts(): Promise<StripeFacts> {
  const stripe = stripeClient();
  if (!stripe) return EMPTY_STRIPE_FACTS;

  try {
    const [subs, charges] = await Promise.all([listAllSubscriptions(stripe), listAllCharges(stripe)]);
    const byCustomer = chargesByCustomer(charges);
    const facts: StripeFacts = {
      configured: true,
      error: null,
      bySubscriptionId: new Map(),
      byUserId: new Map(),
      byCustomerId: new Map(),
    };
    // Newest first so the latest subscription wins when a user or customer has several.
    const newestFirst = [...subs].sort((a, b) => b.created - a.created);
    for (const sub of newestFirst) {
      const f = toFacts(sub, byCustomer.get(idOf(sub.customer) ?? ''));
      facts.bySubscriptionId.set(f.subscriptionId, f);
      if (f.userId && !facts.byUserId.has(f.userId)) facts.byUserId.set(f.userId, f);
      if (f.customerId && !facts.byCustomerId.has(f.customerId)) facts.byCustomerId.set(f.customerId, f);
    }
    return facts;
  } catch (e) {
    return { ...EMPTY_STRIPE_FACTS, configured: true, error: e instanceof Error ? e.message : String(e) };
  }
}
