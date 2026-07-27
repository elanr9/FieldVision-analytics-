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

const FIELDVISION_TYPE = 'fieldvision_subscription';

function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

function subscriptionFromInvoice(
  invoice: Stripe.Invoice,
): string | Stripe.Subscription | null {
  return invoice.parent?.subscription_details?.subscription ?? null;
}

function invoiceMeta(invoice: Stripe.Invoice): Stripe.Metadata | null {
  return (
    invoice.parent?.subscription_details?.metadata ??
    invoice.metadata ??
    null
  );
}

function userIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = subscriptionFromInvoice(invoice);
  if (sub && typeof sub !== 'string' && sub.metadata?.user_id) {
    return sub.metadata.user_id;
  }
  const meta = invoiceMeta(invoice);
  if (meta?.user_id) return meta.user_id;
  return null;
}

function planTypeFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = subscriptionFromInvoice(invoice);
  if (sub && typeof sub !== 'string' && sub.metadata?.plan_type) {
    return sub.metadata.plan_type;
  }
  const meta = invoiceMeta(invoice);
  return meta?.plan_type ?? null;
}

function isFieldVisionSubscriptionInvoice(invoice: Stripe.Invoice): boolean {
  const sub = subscriptionFromInvoice(invoice);
  if (sub && typeof sub !== 'string') {
    if (sub.metadata?.type === FIELDVISION_TYPE) return true;
  }
  const meta = invoiceMeta(invoice);
  if (meta?.type === FIELDVISION_TYPE) return true;
  if (invoice.metadata?.type === FIELDVISION_TYPE) return true;
  const desc = invoice.lines?.data?.[0]?.description?.toLowerCase() ?? '';
  if (desc.includes('fieldvision') || desc.includes('field vision')) return true;
  return false;
}

async function listAllPaidInvoices(stripe: Stripe): Promise<Stripe.Invoice[]> {
  const all: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < 50; page++) {
    const batch = await stripe.invoices.list({
      status: 'paid',
      limit: 100,
      expand: ['data.parent.subscription_details.subscription'],
      starting_after: startingAfter,
    });
    all.push(...batch.data);
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1].id;
  }

  return all;
}

function mrrFromSubscription(sub: Stripe.Subscription): number {
  let mrr = 0;
  for (const item of sub.items.data) {
    const price = item.price;
    if (!price?.unit_amount) continue;
    const amount = price.unit_amount * (item.quantity ?? 1);
    if (price.recurring?.interval === 'year') {
      mrr += Math.round(amount / 12);
    } else if (price.recurring?.interval === 'month') {
      mrr += amount;
    }
  }
  return mrr;
}

/**
 * Loads Stripe revenue for FieldVision Pro only. Excludes $0 invoices and
 * any payment tied to demo, ambassador, or admin user IDs.
 */
export async function loadRevenueSnapshot(
  excludedUserIds: Set<string>,
): Promise<RevenueSnapshot> {
  const stripe = stripeClient();
  if (!stripe) {
    return { configured: false, mrrCents: 0, activeSubscriptionCount: 0, events: [] };
  }

  let invoices: Stripe.Invoice[];
  let searchResult: Stripe.ApiSearchResult<Stripe.Subscription>;
  try {
    [invoices, searchResult] = await Promise.all([
      listAllPaidInvoices(stripe),
      stripe.subscriptions.search({
        query: `metadata['type']:'${FIELDVISION_TYPE}' AND status:'active'`,
        limit: 100,
        expand: ['data.items.data.price'],
      }),
    ]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      configured: true,
      mrrCents: 0,
      activeSubscriptionCount: 0,
      events: [],
      error: message,
    };
  }

  const events: RevenueEvent[] = [];

  for (const invoice of invoices) {
    if ((invoice.amount_paid ?? 0) <= 0) continue;
    if (!isFieldVisionSubscriptionInvoice(invoice)) continue;

    const userId = userIdFromInvoice(invoice);
    if (userId && excludedUserIds.has(userId)) continue;

    const paidAt = invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : new Date(invoice.created * 1000).toISOString();

    events.push({
      paidAt,
      cents: invoice.amount_paid ?? 0,
      planType: planTypeFromInvoice(invoice),
      userId,
    });
  }

  events.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  let mrrCents = 0;
  let activeSubscriptionCount = 0;

  for (const sub of searchResult.data) {
    const userId = sub.metadata?.user_id;
    if (userId && excludedUserIds.has(userId)) continue;
    activeSubscriptionCount++;
    mrrCents += mrrFromSubscription(sub);
  }

  return {
    configured: true,
    mrrCents,
    activeSubscriptionCount,
    events,
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
