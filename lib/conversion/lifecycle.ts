import { createClient } from '@supabase/supabase-js';
import { TRIAL_MS } from '../classify';
import { PLAN_LABELS } from '../funnel';
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
  inkbound_quarterly: 0,
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
  emailSentAt: string[];
  replyAt: string[];
  listCreatedAt: string[];
  projectCreatedAt: string[];
  videosPublished: number;
  eventAt: string[];
}

export const NO_ACTIVITY: ActivityRows = {
  emailSentAt: [],
  replyAt: [],
  listCreatedAt: [],
  projectCreatedAt: [],
  videosPublished: 0,
  eventAt: [],
};

/** What the user did inside their decision window (trial start to cancel, or signup to now). */
export interface Engagement {
  emailsSent: number;
  repliesReceived: number;
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

function ms(isoDate: string | null | undefined): number | null {
  return isoDate ? new Date(isoDate).getTime() : null;
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
 * Without Stripe, the closest thing to a cancel date. expires_at holds the period end the app
 * scheduled the cancel for; updated_at is when the row was last touched, which for canceled rows
 * is often a later cleanup pass. The earliest one on or after the trial start wins.
 */
function supabaseCanceledAt(sub: LifecycleSubRow | undefined, trialStartAt: string | null): string | null {
  if (!sub || sub.payment_type !== 'canceled') return null;
  const floor = ms(trialStartAt) ?? 0;
  const candidates = [sub.expires_at, sub.updated_at].filter((d): d is string => d !== null && new Date(d).getTime() >= floor);
  return candidates.sort()[0] ?? sub.updated_at;
}

function planLabelFor(plan: string | null): string | null {
  if (!plan) return null;
  return PLAN_LABELS[plan] ?? plan.replace(/_/g, ' ');
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
  const lists = inWindow(rows.listCreatedAt);
  const projects = inWindow(rows.projectCreatedAt);
  const events = inWindow(rows.eventAt);

  const stamps = [...emails, ...lists, ...projects, ...events].sort();
  const days = new Set(stamps.map(dayOf));
  const first = stamps[0] ?? null;
  const last = stamps[stamps.length - 1] ?? null;

  return {
    emailsSent: emails.length,
    repliesReceived: replies.length,
    campaignsCreated: lists.length,
    videosCreated: projects.length,
    videosPublished: rows.videosPublished,
    activeDays: days.size,
    firstActiveAt: first,
    lastActiveAt: last,
    daysSilentBeforeEnd: last ? Math.max(0, Math.round((to - new Date(last).getTime()) / DAY_MS)) : null,
    lifetimeActions: rows.emailSentAt.length + rows.listCreatedAt.length + rows.projectCreatedAt.length + rows.eventAt.length,
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
      if (!charged) warnings.push('Counted as paying but no charge is recorded in Supabase or Stripe');
      if (stripe && (stripe.status === 'canceled' || stripe.status === 'unpaid')) {
        warnings.push(`Supabase says full plan, Stripe says ${stripe.status}`);
        return { outcome: stripe.paymentFailed ? 'payment_failed' : charged ? 'paid_churned' : 'canceled_in_trial', warnings };
      }
      if (stripe?.paymentFailed) return { outcome: 'payment_failed', warnings };
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

  const canceledAt =
    outcome === 'paid_churned' || outcome === 'canceled_in_trial' || outcome === 'payment_failed' || outcome === 'refunded'
      ? stripe?.canceledAt ?? supabaseCanceledAt(sub, trialStartAt)
      : null;

  const charged = (sub?.amount_cents ?? 0) > 0 || (stripe?.chargedCents ?? 0) > 0;
  const firstChargeAt = charged ? sub?.paid_at ?? null : null;

  const nowIso = now.toISOString();
  const windowStart = trialStartAt ?? user.signupDate;
  const windowEndCandidates = [canceledAt, outcome === 'trial_expired' ? trialEndAt : null, outcome === 'converted' ? trialEndAt : null].filter(
    (d): d is string => d !== null,
  );
  const windowEnd = windowEndCandidates.length > 0 ? windowEndCandidates.sort()[0] : nowIso;
  const engagement = buildEngagement(rows, windowStart, windowEnd < windowStart ? nowIso : windowEnd);

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
    planLabel: planLabelFor(planTried),
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
    rows = { emailSentAt: [], replyAt: [], listCreatedAt: [], projectCreatedAt: [], videosPublished: 0, eventAt: [] };
    map.set(userId, rows);
  }
  return rows;
}

/** Every activity timestamp per user, from the tables the athlete app actually writes to. */
async function loadActivityRows(supabase: Client): Promise<Map<string, ActivityRows>> {
  const map = new Map<string, ActivityRows>();

  const [emails, lists, projects, events] = await Promise.all([
    pageAll<{ user_id: string | null; sent_at: string | null; created_at: string; replied_at: string | null }>((from, to) =>
      supabase.from('user_sent_emails').select('user_id, sent_at, created_at, replied_at').eq('status', 'sent').order('created_at').range(from, to),
    ),
    pageAll<TimestampRow>((from, to) => supabase.from('outreach_lists').select('user_id, at:created_at').order('created_at').range(from, to)),
    pageAll<{ user_id: string | null; created_at: string; youtube_url: string | null }>((from, to) =>
      supabase.from('projects').select('user_id, created_at, youtube_url').order('created_at').range(from, to),
    ),
    pageAll<TimestampRow>((from, to) => supabase.from('product_events').select('user_id, at:created_at').order('created_at').range(from, to)),
  ]);

  for (const e of emails) {
    if (!e.user_id) continue;
    const rows = rowsFor(map, e.user_id);
    rows.emailSentAt.push(e.sent_at ?? e.created_at);
    if (e.replied_at) rows.replyAt.push(e.replied_at);
  }
  for (const l of lists) if (l.user_id && l.at) rowsFor(map, l.user_id).listCreatedAt.push(l.at);
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
