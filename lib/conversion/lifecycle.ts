import { createClient } from '@supabase/supabase-js';
import { TRIAL_MS } from '../classify';
import { planLabelFor } from '../plans';
import type { UserRecord } from '../types';
import { loadStripeFacts, type StripeFacts, type StripeSubFacts } from './stripe';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

/** Where a real athlete ended up. Every non converting outcome gets a loss reason in reasons.ts. */
export type Outcome =
  | 'converted'
  | 'still_trialing'
  | 'paid_churned'
  | 'payment_failed'
  | 'refunded'
  | 'canceled_in_trial'
  | 'trial_expired'
  | 'stopped_at_paywall'
  | 'abandoned_onboarding'
  | 'never_opened';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  converted: 'Converted',
  still_trialing: 'Still trialing',
  paid_churned: 'Paid, then canceled',
  payment_failed: 'Card failed',
  refunded: 'Refunded',
  canceled_in_trial: 'Canceled during trial',
  trial_expired: 'Trial expired',
  stopped_at_paywall: 'Stopped at paywall',
  abandoned_onboarding: 'Abandoned onboarding',
  never_opened: 'Never opened the app',
};

/** Monthly normalized price per Stripe payment_type, in cents. Lifetime is a one time charge, so 0 here. */
export const PLAN_MONTHLY_CENTS: Record<string, number> = {
  inkbound_semester: 2000,
  inkbound_offer: 1000,
  inkbound_monthly: 4000,
  inkbound_quarterly: 2000,
  inkbound_weekly: 4333,
  yearly_240_trial: 2000,
  monthly_29_99: 2999,
  lifetime_499: 0,
};

/** The live paywall's default plan is $240 yearly, used when a canceled row no longer says which plan was tried. */
export const DEFAULT_TRIAL_MONTHLY_CENTS = 2000;

/** One time prices, in cents, for plans that are not recurring. */
export const PLAN_ONE_TIME_CENTS: Record<string, number> = {
  lifetime_499: 49900,
  lifetime: 49900,
  one_time: 49900,
};

/** payment_type values that are lifecycle states, not plans. */
const STATUS_PAYMENT_TYPES = new Set(['canceled', 'trial_expired']);

/** Raw user_subscriptions row, only what the lifecycle needs. */
export interface LifecycleSubRow {
  user_id: string;
  plan: string;
  payment_type: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  amount_cents: number | null;
  paid_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

/** Timestamps of everything one user did, gathered from the activity tables. */
export interface ActivityRows {
  /** Every sent email, including the follow ups the app sends on its own */
  emailSentAt: string[];
  /** Only the first email of each thread, the sends the athlete actually triggered */
  originalEmailAt: string[];
  replyAt: string[];
  /** Campaigns the athlete approved and sent; app generated drafts waiting for approval do not count */
  campaignSentAt: string[];
  /** Every campaign row, for the all time totals */
  listCreatedAt: string[];
  projectCreatedAt: string[];
  videosPublished: number;
  eventAt: string[];
}

export const NO_ACTIVITY: ActivityRows = {
  emailSentAt: [],
  originalEmailAt: [],
  replyAt: [],
  campaignSentAt: [],
  listCreatedAt: [],
  projectCreatedAt: [],
  videosPublished: 0,
  eventAt: [],
};

/** product_events only exist from this day, so earlier windows cannot use them for activity. */
const EVENTS_SINCE = '2026-08-10';

/** outreach_lists statuses that mean the athlete approved the campaign and it went out. */
const SENT_LIST_STATUSES = new Set(['sent', 'follow_up_1_sent', 'completed']);

/** What the user did inside their decision window (signup to the end of the trial or the cancel, whichever came first). */
export interface Engagement {
  /** Emails that went out in the window, including automated follow ups */
  emailsSent: number;
  repliesReceived: number;
  /** Campaigns the athlete approved and sent in the window */
  campaignsCreated: number;
  videosCreated: number;
  videosPublished: number;
  /** Distinct calendar days with any activity in the window */
  activeDays: number;
  firstActiveAt: string | null;
  lastActiveAt: string | null;
  /** Days between the last activity and the end of the window, null when never active */
  daysSilentBeforeEnd: number | null;
  /** Total activity across the whole account, not just the window */
  lifetimeActions: number;
  /** Whole account totals, because campaigns keep sending for weeks after the trial */
  lifetime: LifetimeTotals;
}

export interface LifetimeTotals {
  emailsSent: number;
  repliesReceived: number;
  campaignsCreated: number;
  videosCreated: number;
  videosPublished: number;
}

export interface LifecycleStripe {
  status: string;
  cancelReason: string | null;
  cancelFeedback: string | null;
  cancelComment: string | null;
  paymentFailed: boolean;
  refunded: boolean;
  chargedCents: number;
}

export interface UserLifecycle {
  userId: string;
  name: string;
  email: string;
  signupAt: string;
  lastSignInAt: string | null;
  onboarding: UserRecord['onboarding'];
  onboardingStepLabel: string | null;
  onboardingChapterLabel: string | null;
  trialStartAt: string | null;
  trialEndAt: string | null;
  canceledAt: string | null;
  firstChargeAt: string | null;
  /** Days from trial start to cancel, one decimal, null when not canceled or never trialed */
  daysToCancel: number | null;
  /** Stripe payment_type of the plan they chose at the paywall, null when unknown */
  planTried: string | null;
  planLabel: string | null;
  /** True when the plan is unknown (canceled rows overwrite payment_type) and the default trial price is assumed */
  planAssumed: boolean;
  planMonthlyCents: number;
  planOneTimeCents: number;
  outcome: Outcome;
  stripe: LifecycleStripe | null;
  engagement: Engagement;
  /** Facts that disagree between Supabase and Stripe, or rows that look incomplete */
  warnings: string[];
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS) * 10) / 10;
}

function dayOf(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function planFor(sub: LifecycleSubRow | undefined, stripe: StripeSubFacts | null): string | null {
  const raw = sub?.payment_type ?? null;
  if (raw && !STATUS_PAYMENT_TYPES.has(raw)) return raw;
  return stripe?.planType ?? null;
}

/**
 * Without Stripe there is no honest cancel timestamp: expires_at is the period end the cancel was
 * scheduled for and updated_at is often a later cleanup pass. The only usable case is a cancel at
 * period end, where expires_at sits exactly on the trial end and access really ended there.
 */
function supabaseCanceledAt(sub: LifecycleSubRow | undefined, trialStartAt: string | null): string | null {
  if (!sub || sub.payment_type !== 'canceled' || !sub.expires_at || !trialStartAt) return null;
  const gapDays = (new Date(sub.expires_at).getTime() - new Date(trialStartAt).getTime()) / DAY_MS;
  return gapDays >= 6.5 && gapDays <= 7.5 ? sub.expires_at : null;
}

function planLabelOrNull(plan: string | null): string | null {
  return plan ? planLabelFor(plan) : null;
}

function withinWindow(t: number, from: number, to: number): boolean {
  return t >= from && t <= to;
}

function buildEngagement(rows: ActivityRows, fromIso: string, toIso: string): Engagement {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const inWindow = (list: string[]) => list.filter(d => withinWindow(new Date(d).getTime(), from, to));

  const emails = inWindow(rows.emailSentAt);
  const replies = inWindow(rows.replyAt);
  const campaigns = inWindow(rows.campaignSentAt);
  const projects = inWindow(rows.projectCreatedAt);
  // Automated follow ups and app generated drafts are not the athlete showing up, so activity days
  // come from what they did themselves. Events only count once the apps started recording them.
  const events = fromIso >= EVENTS_SINCE ? inWindow(rows.eventAt) : [];
  const stamps = [...inWindow(rows.originalEmailAt), ...campaigns, ...projects, ...events].sort();
  const days = new Set(stamps.map(dayOf));
  const first = stamps[0] ?? null;
  const last = stamps[stamps.length - 1] ?? null;

  return {
    emailsSent: emails.length,
    repliesReceived: replies.length,
    campaignsCreated: campaigns.length,
    videosCreated: projects.length,
    videosPublished: rows.videosPublished,
    activeDays: days.size,
    firstActiveAt: first,
    lastActiveAt: last,
    daysSilentBeforeEnd: last ? Math.max(0, Math.round((to - new Date(last).getTime()) / DAY_MS)) : null,
    lifetimeActions: rows.originalEmailAt.length + rows.campaignSentAt.length + rows.projectCreatedAt.length + rows.eventAt.length,
    lifetime: {
      emailsSent: rows.emailSentAt.length,
      repliesReceived: rows.replyAt.length,
      campaignsCreated: rows.campaignSentAt.length,
      videosCreated: rows.projectCreatedAt.length,
      videosPublished: rows.videosPublished,
    },
  };
}

function stripeFor(user: UserRecord, sub: LifecycleSubRow | undefined, facts: StripeFacts): StripeSubFacts | null {
  if (sub?.stripe_subscription_id) {
    const bySub = facts.bySubscriptionId.get(sub.stripe_subscription_id);
    if (bySub) return bySub;
  }
  if (sub?.stripe_customer_id) {
    const byCustomer = facts.byCustomerId.get(sub.stripe_customer_id);
    if (byCustomer) return byCustomer;
  }
  return facts.byUserId.get(user.id) ?? null;
}

interface OutcomeInput {
  user: UserRecord;
  sub: LifecycleSubRow | undefined;
  stripe: StripeSubFacts | null;
}

function resolveOutcome({ user, sub, stripe }: OutcomeInput): { outcome: Outcome; warnings: string[] } {
  const warnings: string[] = [];
  const charged = (sub?.amount_cents ?? 0) > 0 || (stripe?.chargedCents ?? 0) > 0;

  if (stripe?.refunded) return { outcome: 'refunded', warnings };

  switch (user.status) {
    case 'paying': {
      if (stripe) {
        // Stripe is the truth for anyone it knows about: a subscription already set to cancel has left.
        const leaving = stripe.status === 'canceled' || stripe.status === 'unpaid' || stripe.status === 'incomplete_expired' || stripe.cancelAtPeriodEnd;
        if (leaving) {
          if (stripe.status !== 'canceled' || !stripe.cancelAtPeriodEnd) warnings.push(`Supabase says full plan, Stripe says ${stripe.cancelAtPeriodEnd ? 'canceling at period end' : stripe.status}`);
          return { outcome: stripe.paymentFailed ? 'payment_failed' : charged ? 'paid_churned' : 'canceled_in_trial', warnings };
        }
        if (stripe.paymentFailed) return { outcome: 'payment_failed', warnings };
        if (stripe.status === 'trialing') return { outcome: 'still_trialing', warnings };
        if (!charged && stripe.status === 'active') warnings.push('Stripe subscription is active but no successful charge was found');
        return { outcome: 'converted', warnings };
      }
      if (!charged) warnings.push('Counted as paying but no charge is recorded in Supabase and Stripe has no matching subscription');
      return { outcome: 'converted', warnings };
    }
    case 'trialing':
      return { outcome: 'still_trialing', warnings };
    case 'churned':
      return { outcome: stripe?.paymentFailed ? 'payment_failed' : 'paid_churned', warnings };
    case 'trial_ended': {
      if (stripe?.paymentFailed) return { outcome: 'payment_failed', warnings };
      if (sub?.payment_type === 'canceled') return { outcome: 'canceled_in_trial', warnings };
      if (!sub) warnings.push('Trial started but no subscription row was written');
      return { outcome: 'trial_expired', warnings };
    }
    case 'signed_up': {
      if (user.onboarding === 'completed') return { outcome: 'stopped_at_paywall', warnings };
      if (user.onboarding === 'in_progress') return { outcome: 'abandoned_onboarding', warnings };
      return { outcome: 'never_opened', warnings };
    }
    case 'comped':
      return { outcome: 'converted', warnings };
  }
}

/** Real athletes the conversion story is about: no internal, parent, or fake flagged accounts, and nobody comped. */
export function conversionCandidates(users: UserRecord[]): UserRecord[] {
  return users.filter(u => !u.excludedFromMetrics && !u.isParent && !u.fakeReason && u.status !== 'comped');
}

export function buildLifecycle(
  user: UserRecord,
  sub: LifecycleSubRow | undefined,
  rows: ActivityRows,
  facts: StripeFacts,
  now: Date,
): UserLifecycle {
  const stripe = stripeFor(user, sub, facts);
  const { outcome, warnings } = resolveOutcome({ user, sub, stripe });

  const trialStartAt = user.trialStartedAt ?? (stripe?.trialEndAt ? new Date(new Date(stripe.trialEndAt).getTime() - TRIAL_MS).toISOString() : null);
  const trialEndAt = stripe?.trialEndAt ?? (trialStartAt ? new Date(new Date(trialStartAt).getTime() + TRIAL_MS).toISOString() : null);

  const left = outcome === 'paid_churned' || outcome === 'canceled_in_trial' || outcome === 'payment_failed' || outcome === 'refunded';
  const canceledAt = left ? stripe?.canceledAt ?? supabaseCanceledAt(sub, trialStartAt) : null;
  if (left && !canceledAt) warnings.push('Cancel date unknown, Stripe has no matching subscription');

  const charged = (sub?.amount_cents ?? 0) > 0 || (stripe?.chargedCents ?? 0) > 0;
  // paid_at is stamped when the subscription is created, so only a Stripe charge dates the payment.
  const firstChargeAt = charged ? stripe?.firstChargeAt ?? null : null;

  // The decision window runs from signup (campaigns get built before trial_started_at is stamped)
  // to the end of the trial or the cancel, whichever came first, the same for paid and lost.
  const nowIso = now.toISOString();
  const windowStart = user.signupDate;
  const windowEnd = [canceledAt, trialEndAt].filter((d): d is string => d !== null && d > windowStart).sort()[0] ?? nowIso;
  const engagement = buildEngagement(rows, windowStart, windowEnd > nowIso ? nowIso : windowEnd);

  const daysToCancel = trialStartAt && canceledAt ? Math.max(0, daysBetween(trialStartAt, canceledAt)) : null;
  if (outcome === 'canceled_in_trial' && daysToCancel !== null && daysToCancel > 8) {
    warnings.push('Canceled well after the trial ended but no charge is recorded');
  }

  const planTried = planFor(sub, stripe);
  const planAssumed = planTried === null && trialStartAt !== null;
  if (stripe && stripe.planType && sub?.payment_type && !STATUS_PAYMENT_TYPES.has(sub.payment_type) && stripe.planType !== sub.payment_type) {
    warnings.push(`Plan mismatch: Supabase ${sub.payment_type}, Stripe ${stripe.planType}`);
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    signupAt: user.signupDate,
    lastSignInAt: user.lastSignInAt,
    onboarding: user.onboarding,
    onboardingStepLabel: user.onboardingStepLabel,
    onboardingChapterLabel: user.onboardingChapterLabel,
    trialStartAt,
    trialEndAt,
    canceledAt,
    firstChargeAt,
    daysToCancel,
    planTried,
    planLabel: planLabelOrNull(planTried),
    planAssumed,
    planMonthlyCents: planAssumed ? DEFAULT_TRIAL_MONTHLY_CENTS : planTried ? PLAN_MONTHLY_CENTS[planTried] ?? 0 : 0,
    planOneTimeCents: planTried ? PLAN_ONE_TIME_CENTS[planTried] ?? 0 : 0,
    outcome,
    stripe: stripe
      ? {
          status: stripe.status,
          cancelReason: stripe.cancelReason,
          cancelFeedback: stripe.cancelFeedback,
          cancelComment: stripe.cancelComment,
          paymentFailed: stripe.paymentFailed,
          refunded: stripe.refunded,
          chargedCents: stripe.chargedCents,
        }
      : null,
    engagement,
    warnings,
  };
}

export function buildLifecycles(
  users: UserRecord[],
  subs: LifecycleSubRow[],
  activity: Map<string, ActivityRows>,
  facts: StripeFacts,
  now: Date = new Date(),
): UserLifecycle[] {
  const subByUser = new Map(subs.map(s => [s.user_id, s]));
  return conversionCandidates(users).map(u => buildLifecycle(u, subByUser.get(u.id), activity.get(u.id) ?? NO_ACTIVITY, facts, now));
}

interface TimestampRow {
  user_id: string | null;
  at: string | null;
}

type Client = ReturnType<typeof adminClient>;

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

function rowsFor(map: Map<string, ActivityRows>, userId: string): ActivityRows {
  let rows = map.get(userId);
  if (!rows) {
    rows = { emailSentAt: [], originalEmailAt: [], replyAt: [], campaignSentAt: [], listCreatedAt: [], projectCreatedAt: [], videosPublished: 0, eventAt: [] };
    map.set(userId, rows);
  }
  return rows;
}

/** Every activity timestamp per user, from the tables the athlete app actually writes to. */
async function loadActivityRows(supabase: Client): Promise<Map<string, ActivityRows>> {
  const map = new Map<string, ActivityRows>();

  const [emails, lists, projects, events] = await Promise.all([
    pageAll<{ user_id: string | null; sent_at: string | null; created_at: string; replied_at: string | null; email_type: string | null }>((from, to) =>
      supabase.from('user_sent_emails').select('user_id, sent_at, created_at, replied_at, email_type').eq('status', 'sent').order('created_at').range(from, to),
    ),
    pageAll<{ user_id: string | null; created_at: string; sent_at: string | null; status: string | null; emails_sent: number | null }>((from, to) =>
      supabase.from('outreach_lists').select('user_id, created_at, sent_at, status, emails_sent').order('created_at').range(from, to),
    ),
    pageAll<{ user_id: string | null; created_at: string; youtube_url: string | null }>((from, to) =>
      supabase.from('projects').select('user_id, created_at, youtube_url').order('created_at').range(from, to),
    ),
    pageAll<TimestampRow>((from, to) => supabase.from('product_events').select('user_id, at:created_at').order('created_at').range(from, to)),
  ]);

  for (const e of emails) {
    if (!e.user_id) continue;
    const rows = rowsFor(map, e.user_id);
    const at = e.sent_at ?? e.created_at;
    rows.emailSentAt.push(at);
    if (!e.email_type || e.email_type === 'original') rows.originalEmailAt.push(at);
    if (e.replied_at) rows.replyAt.push(e.replied_at);
  }
  for (const l of lists) {
    if (!l.user_id) continue;
    const rows = rowsFor(map, l.user_id);
    rows.listCreatedAt.push(l.created_at);
    if ((l.status && SENT_LIST_STATUSES.has(l.status)) || (l.emails_sent ?? 0) > 0) rows.campaignSentAt.push(l.sent_at ?? l.created_at);
  }
  for (const p of projects) {
    if (!p.user_id) continue;
    const rows = rowsFor(map, p.user_id);
    rows.projectCreatedAt.push(p.created_at);
    if (p.youtube_url) rows.videosPublished += 1;
  }
  for (const ev of events) if (ev.user_id && ev.at) rowsFor(map, ev.user_id).eventAt.push(ev.at);

  return map;
}

async function loadSubRows(supabase: Client): Promise<LifecycleSubRow[]> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, plan, payment_type, stripe_customer_id, stripe_subscription_id, amount_cents, paid_at, updated_at, expires_at, created_at');
  if (error) throw error;
  return (data ?? []) as LifecycleSubRow[];
}

export interface LifecycleLoad {
  lifecycles: UserLifecycle[];
  stripe: Pick<StripeFacts, 'configured' | 'error'>;
}

/** Loads the lifecycle of every conversion candidate. Read only. */
export async function loadLifecycles(users: UserRecord[], now: Date = new Date()): Promise<LifecycleLoad> {
  const supabase = adminClient();
  const [subs, activity, facts] = await Promise.all([loadSubRows(supabase), loadActivityRows(supabase), loadStripeFacts()]);
  return {
    lifecycles: buildLifecycles(users, subs, activity, facts, now),
    stripe: { configured: facts.configured, error: facts.error },
  };
}
