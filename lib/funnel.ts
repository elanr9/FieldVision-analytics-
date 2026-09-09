import type { ScreenEvent } from './onboarding-analytics';
import type { FlowScreenDef } from './onboarding-flow.generated';
import { FLOW_SECTIONS, flowScreens, sectionByNumber, type FlowSectionKey } from './onboarding-flow';
import type { UserRecord } from './types';

/**
 * Paywall funnel signals. These are derived keys, not raw product_events names: the athlete app's
 * onboarding flow emits `onboarding_screen_view` / `onboarding_answer` with a `screen` property
 * (s36_try_free, s37_paywall, s37c_spin_wheel, s38_one_time_offer) and the retention offer edge
 * function emits `retention_offer_accepted`. See derivePaywallKeys in lib/onboarding-analytics.ts.
 */
export const PAYWALL_EVENTS = {
  tryFreeViewed: 'try_free_viewed', // screen view s36_try_free
  paywallViewed: 'paywall_viewed', // screen view s37_paywall
  tryFreeTapped: 'try_free_tapped', // answer on s37_paywall with a plan (trial started right away)
  paywallClosed: 'paywall_closed', // left s37_paywall for the wheel (same people as wheel_viewed)
  checkoutStarted: 'checkout_started', // any plan answer on s37_paywall or s38_one_time_offer
  wheelViewed: 'wheel_viewed', // screen view s37c_spin_wheel
  wheelSpun: 'wheel_spun', // answer on s37c_spin_wheel
  offer90Viewed: 'offer_90_viewed', // screen view s38_one_time_offer
  offerTrialStarted: 'offer_trial_started', // answer on s38_one_time_offer
  offerPaid: 'offer_paid', // paying user on the inkbound_offer plan (from users, not events)
  paywallIdle10m: 'paywall_idle_10m', // analytics_notifications type stalled
  saveOfferShown: 'save_offer_shown', // churned in range or accepted the free month (no shown event exists)
  saveOfferAccepted: 'save_offer_accepted', // retention_offer_accepted
} as const;

/** Screen ids from the athlete app's onboarding flow (inkbound-web and inkbound-mobile src/flow). */
export const PAYWALL_SCREENS = {
  tryFree: 's36_try_free',
  paywall: 's37_paywall',
  wheel: 's37c_spin_wheel',
  offer: 's38_one_time_offer',
} as const;

/** Stripe payment_type of the one time offer plan. */
export const OFFER_PAYMENT_TYPE = 'inkbound_offer';

/** One chapter per flow section; the last section is the paywall. */
export type FunnelChapterKey = FlowSectionKey;

/** Funnel steps that come from account data instead of a flow screen. They close the paywall chapter. */
export const TRIAL_STEP_ID = 'trial_started';
export const SUBSCRIBED_STEP_ID = 'subscribed';

/** The first flow screen; a view of it is what "started" means once the apps record screens before sign-in. */
export const STARTED_SCREEN_ID = 's01_welcome';

export type StartedSource = 'welcome_screen' | 'accounts_created';

export interface FunnelStep {
  id: string;
  label: string;
  chapter: FunnelChapterKey;
  chapterLabel: string;
  /** Shown only for some answers (or only reachable through a branch), so fewer people here is not a drop. */
  conditional: boolean;
  /** False for screens the apps emit that lib/onboarding-flow.generated.ts does not know yet. */
  known: boolean;
  /** Distinct started users who reached this step. null when the apps do not record this screen yet. */
  reached: number | null;
  /** reached / started × 100, one decimal. */
  pct: number | null;
  /** reached(previous unconditional step) − reached(step). null for conditional or untracked steps. */
  dropped: number | null;
  /** dropped / reached(previous unconditional step) × 100, one decimal. */
  dropPct: number | null;
}

export interface Chapter {
  key: FunnelChapterKey;
  label: string;
  short: string;
  steps: FunnelStep[];
  /** People who arrived at the first step of the chapter. null while that screen is untracked. */
  enter: number | null;
  /** People who reached the last unconditional step of the chapter. null while that screen is untracked. */
  exit: number | null;
}

export interface Funnel {
  steps: FunnelStep[];
  chapters: Chapter[];
  started: number;
  /** How `started` was measured. accounts_created is the fallback while screens before sign-in are not recorded. */
  startedSource: StartedSource;
  /** Screen ids seen in product_events that the generated mirror lacks. Run scripts/sync-onboarding-flow.mjs. */
  unknownScreens: string[];
  /** Steps before the first screen the apps record; they render as "—". */
  untrackedSteps: number;
}

export interface PaywallPlan {
  /** Stripe payment_type, e.g. inkbound_semester. */
  key: string;
  label: string;
  trials: number;
  paid: number;
}

export interface Paywall {
  seen: number | null;
  trialDirect: number | null;
  closed: number | null;
  wheel: {
    entered: number | null;
    spun: number | null;
    offer90: number | null;
    trial: number | null;
    paid: number | null;
  };
  stalled10m: number | null;
  plans: PaywallPlan[];
  save: { shown: number | null; accepted: number | null };
}

export interface DateRange {
  from: Date;
  to: Date;
}

export const CHAPTER_ORDER: FunnelChapterKey[] = FLOW_SECTIONS.map(s => s.key);

export const FUNNEL_CHAPTER_LABELS: Record<FunnelChapterKey, string> = Object.fromEntries(
  FLOW_SECTIONS.map(s => [s.key, s.label]),
) as Record<FunnelChapterKey, string>;

export const FUNNEL_CHAPTER_SHORT: Record<FunnelChapterKey, string> = Object.fromEntries(
  FLOW_SECTIONS.map(s => [s.key, s.short]),
) as Record<FunnelChapterKey, string>;

/** Inkbound plans shown in "Trial → paid by plan", keyed by Stripe payment_type. Prices from the live product. */
export const PLAN_LABELS: Record<string, string> = {
  inkbound_semester: '$120 semester',
  inkbound_offer: '$60 semester',
  inkbound_monthly: '$40 monthly',
  inkbound_quarterly: 'Quarterly',
  yearly_240_trial: '$240 yearly',
  monthly_29_99: '$30 monthly',
  lifetime_499: '$499 lifetime',
};

export function rangeForDays(days: number, now: Date = new Date()): DateRange {
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now };
}

function pct1(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 10;
}

function isWithin(iso: string | null, range: DateRange): boolean {
  if (iso === null) return false;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

/** Real athletes only: drops internal, fake-flagged and parent accounts. */
export function includedUsers(users: UserRecord[]): UserRecord[] {
  return users.filter(u => !u.excludedFromMetrics && !u.isParent);
}

/** Distinct users per screen, counting a view or an answer on that screen. */
function usersByScreen(events: ScreenEvent[], allowed: Set<string>): Map<string, Set<string>> {
  const byScreen = new Map<string, Set<string>>();
  for (const e of events) {
    if (!allowed.has(e.userId)) continue;
    let set = byScreen.get(e.screen);
    if (!set) {
      set = new Set();
      byScreen.set(e.screen, set);
    }
    set.add(e.userId);
  }
  return byScreen;
}

/**
 * Who started onboarding. The apps only write product_events once a user is signed in, and the account is
 * created mid-flow (s31_verify_phone), so until they record the screens before sign-in the honest count is
 * accounts created in range: everyone with an account went through the flow to get it.
 * Once s01_welcome views arrive the funnel switches to them on its own.
 */
function startedUsers(
  byScreen: Map<string, Set<string>>,
  included: UserRecord[],
  range: DateRange,
): { users: Set<string>; source: StartedSource } {
  const viewers = byScreen.get(STARTED_SCREEN_ID);
  if (viewers && viewers.size > 0) return { users: viewers, source: 'welcome_screen' };
  return {
    users: new Set(included.filter(u => isWithin(u.signupDate, range)).map(u => u.id)),
    source: 'accounts_created',
  };
}

export interface BuildFunnelInput {
  events: ScreenEvent[];
  users: UserRecord[];
  range: DateRange;
  /** Defaults to the generated mirror; tests pass a small list. */
  defs?: FlowScreenDef[];
}

interface MeasuredStep {
  id: string;
  label: string;
  chapter: FunnelChapterKey;
  conditional: boolean;
  known: boolean;
  reached: number | null;
}

function countStarted(users: Set<string> | undefined, started: Set<string>): number {
  if (!users) return 0;
  let n = 0;
  for (const id of users) if (started.has(id)) n++;
  return n;
}

/**
 * Screen steps in flow order. Screens before the first one the apps have recorded are untracked (null);
 * everything from there on is a real count, including zeros.
 */
function screenSteps(
  byScreen: Map<string, Set<string>>,
  started: Set<string>,
  source: StartedSource,
  defs?: FlowScreenDef[],
): MeasuredStep[] {
  const screens = flowScreens(byScreen.keys(), defs);
  const firstTracked = screens.findIndex(s => (byScreen.get(s.id)?.size ?? 0) > 0);
  return screens.map((s, i) => {
    const untracked = firstTracked === -1 || i < firstTracked;
    const isStart = s.id === STARTED_SCREEN_ID && source === 'welcome_screen';
    const section = sectionByNumber(s.section);
    return {
      id: s.id,
      label: s.label,
      chapter: section.key,
      conditional: s.conditional,
      known: s.known,
      reached: isStart ? started.size : untracked ? null : countStarted(byScreen.get(s.id), started),
    };
  });
}

/** Trial and paid come from account data, so they are always measured. */
function accountSteps(started: Set<string>, included: UserRecord[], range: DateRange): MeasuredStep[] {
  const cohort = included.filter(u => started.has(u.id));
  const paywall = FLOW_SECTIONS[FLOW_SECTIONS.length - 1].key;
  return [
    { id: TRIAL_STEP_ID, label: 'Started a free trial', chapter: paywall, conditional: false, known: true, reached: cohort.filter(u => isWithin(u.trialStartedAt, range)).length },
    { id: SUBSCRIBED_STEP_ID, label: 'Paid', chapter: paywall, conditional: false, known: true, reached: cohort.filter(u => isWithin(u.paidAt, range)).length },
  ];
}

function toFunnelSteps(measured: MeasuredStep[], started: number): FunnelStep[] {
  let previousReached = started;
  return measured.map(m => {
    const base = { ...m, chapterLabel: FUNNEL_CHAPTER_LABELS[m.chapter] };
    if (m.reached === null) return { ...base, pct: null, dropped: null, dropPct: null };
    const pct = pct1(m.reached, started);
    if (m.conditional) return { ...base, pct, dropped: null, dropPct: null };
    const arrivals = previousReached;
    const dropped = Math.max(0, arrivals - m.reached);
    previousReached = m.reached;
    return { ...base, pct, dropped, dropPct: pct1(dropped, arrivals) };
  });
}

export function buildChapters(steps: FunnelStep[]): Chapter[] {
  return FLOW_SECTIONS.map(section => {
    const chapterSteps = steps.filter(s => s.chapter === section.key);
    // Arrivals are measured at the first tracked step; untracked leading screens carry no information.
    const first = chapterSteps.find(s => s.reached !== null);
    const lastUnconditional = [...chapterSteps].reverse().find(s => !s.conditional) ?? chapterSteps[chapterSteps.length - 1];
    return {
      key: section.key,
      label: section.label,
      short: section.short,
      steps: chapterSteps,
      enter: first?.reached == null ? null : first.reached + (first.dropped ?? 0),
      exit: lastUnconditional?.reached ?? null,
    };
  });
}

export function buildFunnel(input: BuildFunnelInput): Funnel {
  const included = includedUsers(input.users);
  const allowed = new Set(included.map(u => u.id));
  const byScreen = usersByScreen(input.events, allowed);
  const started = startedUsers(byScreen, included, input.range);
  const measured = [
    ...screenSteps(byScreen, started.users, started.source, input.defs),
    ...accountSteps(started.users, included, input.range),
  ];
  const steps = toFunnelSteps(measured, started.users.size);
  return {
    steps,
    chapters: buildChapters(steps),
    started: started.users.size,
    startedSource: started.source,
    unknownScreens: steps.filter(s => !s.known).map(s => s.id),
    untrackedSteps: steps.filter(s => s.reached === null).length,
  };
}

export interface BuildPaywallInput {
  users: UserRecord[];
  /** Distinct users per paywall event name in range. Absent names mean the event does not exist yet. */
  eventUsers: Map<string, Set<string>>;
  range: DateRange;
}

/** Tiles shown in "Trial → paid by plan". */
export const PLAN_TILES = 3;

/** payment_type values the billing functions write as a status, not a plan (cancel-subscription, parent invites). */
const NON_PLAN_PAYMENT_TYPES = /^(canceled|trial_expired)$|pending|expired/;

function planLabel(paymentType: string): string {
  const known = PLAN_LABELS[paymentType];
  if (known) return known;
  const words = paymentType.replace(/^inkbound_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Trial → paid per plan follows the trial cohort: people who started a trial in range, and how many of them have
 * paid. Plans come from the cohort's own Stripe payment_type values (most trials first) so a new price shows up on
 * its own; the current Inkbound plans fill any empty tiles.
 */
export function buildPlans(included: UserRecord[], range: DateRange): PaywallPlan[] {
  const byPlan = new Map<string, UserRecord[]>();
  for (const u of included) {
    const key = u.paymentType;
    if (key === null || NON_PLAN_PAYMENT_TYPES.test(key) || !isWithin(u.trialStartedAt, range)) continue;
    byPlan.set(key, [...(byPlan.get(key) ?? []), u]);
  }
  const keys = [...byPlan.keys()].sort((a, b) => (byPlan.get(b)?.length ?? 0) - (byPlan.get(a)?.length ?? 0) || a.localeCompare(b));
  for (const key of Object.keys(PLAN_LABELS)) {
    if (keys.length >= PLAN_TILES) break;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys.slice(0, PLAN_TILES).map(key => {
    const trials = byPlan.get(key) ?? [];
    return { key, label: planLabel(key), trials: trials.length, paid: trials.filter(u => u.paidAt !== null).length };
  });
}

export function buildPaywall(input: BuildPaywallInput): Paywall {
  const included = includedUsers(input.users);
  const allowed = new Set(included.map(u => u.id));
  const count = (event: string): number | null => {
    const users = input.eventUsers.get(event);
    return users ? [...users].filter(id => allowed.has(id)).length : null;
  };
  const plans = buildPlans(included, input.range);
  // Paid after the offer comes from subscriptions, not flow events.
  const offerPaid = input.eventUsers.has(PAYWALL_EVENTS.offer90Viewed)
    ? included.filter(u => u.paymentType === OFFER_PAYMENT_TYPE && u.status === 'paying' && isWithin(u.paidAt, input.range)).length
    : null;
  // Nobody records "save offer shown"; the closest real denominator is everyone who reached the cancel flow:
  // churned in range plus those who took the free month instead.
  const accepted = count(PAYWALL_EVENTS.saveOfferAccepted);
  const churned = included.filter(u => u.status === 'churned' && isWithin(u.paidAt, input.range)).length;
  return {
    seen: count(PAYWALL_EVENTS.paywallViewed),
    trialDirect: count(PAYWALL_EVENTS.tryFreeTapped),
    closed: count(PAYWALL_EVENTS.paywallClosed),
    wheel: {
      entered: count(PAYWALL_EVENTS.wheelViewed),
      spun: count(PAYWALL_EVENTS.wheelSpun),
      offer90: count(PAYWALL_EVENTS.offer90Viewed),
      trial: count(PAYWALL_EVENTS.offerTrialStarted),
      paid: offerPaid,
    },
    stalled10m: count(PAYWALL_EVENTS.paywallIdle10m),
    plans,
    save: { shown: accepted === null ? null : accepted + churned, accepted },
  };
}

/**
 * Client components import the builders and constants above, so the Supabase-backed modules are loaded lazily here
 * to keep them out of the browser bundle.
 */
async function loadDeps() {
  const [analytics, queries] = await Promise.all([import('./onboarding-analytics'), import('./queries')]);
  return { ...analytics, loadUsers: queries.loadUsers };
}

/** Distinct users per paywall signal that the app has ever emitted; never-seen signals are left out so they render as "—". */
async function loadPaywallEventUsers(deps: Awaited<ReturnType<typeof loadDeps>>, range: DateRange): Promise<Map<string, Set<string>>> {
  const [seen, byKey] = await Promise.all([
    deps.loadSeenPaywallKeys(),
    deps.loadPaywallKeyUsers(range.from.toISOString(), range.to.toISOString()),
  ]);
  return new Map([...byKey].filter(([key]) => seen.has(key)));
}

export async function loadFunnel(days = 30, users?: UserRecord[]): Promise<Funnel> {
  const deps = await loadDeps();
  const range = rangeForDays(days);
  const [allUsers, events] = await Promise.all([
    users ?? deps.loadUsers(),
    deps.loadScreenEvents(range.from.toISOString(), range.to.toISOString()),
  ]);
  return buildFunnel({ events, users: allUsers, range });
}

export async function loadPaywall(days = 30, users?: UserRecord[]): Promise<Paywall> {
  const deps = await loadDeps();
  const range = rangeForDays(days);
  const [allUsers, eventUsers] = await Promise.all([users ?? deps.loadUsers(), loadPaywallEventUsers(deps, range)]);
  return buildPaywall({ users: allUsers, eventUsers, range });
}
