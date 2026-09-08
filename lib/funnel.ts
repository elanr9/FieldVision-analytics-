import type { OnboardingChapter, OnboardingStepDef } from './onboarding-steps';
import type { StepView } from './onboarding-analytics';
import type { PlanInterval, UserRecord } from './types';

/**
 * product_events names the paywall funnel looks for. Checked against the athlete app on 2026-09-08:
 * none of these are emitted yet, so every event-backed paywall metric renders "—" until handoff 5 adds them.
 */
export const PAYWALL_EVENTS = {
  paywallViewed: 'paywall_viewed', // TODO(handoff-5): emit paywall_viewed
  tryFreeTapped: 'try_free_tapped', // TODO(handoff-5): emit try_free_tapped
  paywallClosed: 'paywall_closed', // TODO(handoff-5): emit paywall_closed
  checkoutStarted: 'checkout_started', // TODO(handoff-5): emit checkout_started
  wheelViewed: 'wheel_viewed', // TODO(handoff-5): emit wheel_viewed
  wheelSpun: 'wheel_spun', // TODO(handoff-5): emit wheel_spun
  offer90Viewed: 'offer_90_viewed', // TODO(handoff-5): emit offer_90_viewed
  offerTrialStarted: 'offer_trial_started', // TODO(handoff-5): emit offer_trial_started
  offerPaid: 'offer_paid', // TODO(handoff-5): emit offer_paid
  paywallIdle10m: 'paywall_idle_10m', // TODO(handoff-5): emit paywall_idle_10m
  saveOfferShown: 'save_offer_shown', // TODO(handoff-5): emit save_offer_shown
  saveOfferAccepted: 'save_offer_accepted', // TODO(handoff-5): emit save_offer_accepted
} as const;

export type FunnelChapterKey = OnboardingChapter | 'paywall';

export interface FunnelStep {
  id: string;
  label: string;
  chapter: FunnelChapterKey;
  chapterLabel: string;
  /** Distinct started users who reached this step. null when the source event does not exist yet. */
  reached: number | null;
  /** reached / started × 100, one decimal. */
  pct: number | null;
  /** reached(previous measured step) − reached(step). */
  dropped: number | null;
  /** dropped / reached(previous measured step) × 100, one decimal. */
  dropPct: number | null;
}

export interface Chapter {
  key: FunnelChapterKey;
  label: string;
  short: string;
  steps: FunnelStep[];
  /** People who arrived at the first step of the chapter. */
  enter: number;
  /** People who reached the last step of the chapter. */
  exit: number;
}

export interface Funnel {
  steps: FunnelStep[];
  chapters: Chapter[];
  started: number;
}

export interface PaywallPlan {
  key: PlanInterval;
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

export const CHAPTER_ORDER: FunnelChapterKey[] = ['basic', 'checkin', 'academic', 'athletic', 'goals', 'paywall'];

export const FUNNEL_CHAPTER_LABELS: Record<FunnelChapterKey, string> = {
  basic: 'Your background',
  checkin: "Where you're at",
  academic: 'Your academics',
  athletic: 'Your game',
  goals: 'Your goals',
  paywall: 'Paywall',
};

export const FUNNEL_CHAPTER_SHORT: Record<FunnelChapterKey, string> = {
  basic: 'Background',
  checkin: 'Where',
  academic: 'Academics',
  athletic: 'Game',
  goals: 'Goals',
  paywall: 'Paywall',
};

export const STARTED_STEP_ID = 'survey_intro';

/** The five paywall steps that follow the survey. Only account_created and subscribed have a source today. */
const PAYWALL_STEPS: { id: string; label: string; event: string | null }[] = [
  { id: 'account_created', label: 'Account created', event: null },
  { id: 'try_free', label: 'Try free', event: PAYWALL_EVENTS.tryFreeTapped },
  { id: 'paywall', label: 'Paywall', event: PAYWALL_EVENTS.paywallViewed },
  { id: 'checkout', label: 'Checkout', event: PAYWALL_EVENTS.checkoutStarted },
  { id: 'subscribed', label: 'Subscribed', event: null },
];

const PLAN_LABELS: Record<Exclude<PlanInterval, 'unknown'>, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  lifetime: 'Lifetime',
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

function usersByStep(views: StepView[], allowed: Set<string>): Map<string, Set<string>> {
  const byStep = new Map<string, Set<string>>();
  for (const v of views) {
    if (!allowed.has(v.userId)) continue;
    let set = byStep.get(v.stepId);
    if (!set) {
      set = new Set();
      byStep.set(v.stepId, set);
    }
    set.add(v.userId);
  }
  return byStep;
}

/**
 * Users who started the survey: a survey_intro view in range. When the athlete app sent no survey_intro
 * views at all in range, falls back to included users who signed up in range and have an intake row.
 */
function startedUsers(byStep: Map<string, Set<string>>, included: UserRecord[], range: DateRange): Set<string> {
  const viewers = byStep.get(STARTED_STEP_ID);
  if (viewers && viewers.size > 0) return viewers;
  return new Set(included.filter(u => u.onboarding !== 'none' && isWithin(u.signupDate, range)).map(u => u.id));
}

export interface BuildFunnelInput {
  defs: OnboardingStepDef[];
  views: StepView[];
  users: UserRecord[];
  /** Distinct users per paywall event name in range. Absent names mean the event does not exist yet. */
  eventUsers: Map<string, Set<string>>;
  range: DateRange;
}

interface MeasuredStep {
  id: string;
  label: string;
  chapter: FunnelChapterKey;
  reached: number | null;
}

function surveySteps(defs: OnboardingStepDef[], byStep: Map<string, Set<string>>, started: Set<string>): MeasuredStep[] {
  return defs.map(def => {
    const viewers = byStep.get(def.id) ?? new Set<string>();
    const reached = def.id === STARTED_STEP_ID ? started.size : [...viewers].filter(id => started.has(id)).length;
    return { id: def.id, label: def.question ?? def.lead ?? def.id, chapter: def.chapter, reached };
  });
}

function paywallSteps(input: BuildFunnelInput, started: Set<string>, included: UserRecord[]): MeasuredStep[] {
  const startedUsersList = included.filter(u => started.has(u.id));
  return PAYWALL_STEPS.map(step => {
    let reached: number | null;
    if (step.id === 'account_created') {
      reached = startedUsersList.filter(u => isWithin(u.signupDate, input.range)).length;
    } else if (step.id === 'subscribed') {
      reached = startedUsersList.filter(u => isWithin(u.paidAt, input.range)).length;
    } else {
      const users = step.event ? input.eventUsers.get(step.event) : undefined;
      reached = users ? [...users].filter(id => started.has(id)).length : null;
    }
    return { id: step.id, label: step.label, chapter: 'paywall', reached };
  });
}

function toFunnelSteps(measured: MeasuredStep[], started: number): FunnelStep[] {
  let previousReached = started;
  return measured.map(m => {
    if (m.reached === null) {
      return { ...m, chapterLabel: FUNNEL_CHAPTER_LABELS[m.chapter], pct: null, dropped: null, dropPct: null };
    }
    const dropped = Math.max(0, previousReached - m.reached);
    const step: FunnelStep = {
      ...m,
      chapterLabel: FUNNEL_CHAPTER_LABELS[m.chapter],
      pct: pct1(m.reached, started),
      dropped,
      dropPct: pct1(dropped, previousReached),
    };
    previousReached = m.reached;
    return step;
  });
}

export function buildChapters(steps: FunnelStep[]): Chapter[] {
  return CHAPTER_ORDER.map(key => {
    const chapterSteps = steps.filter(s => s.chapter === key);
    const first = chapterSteps[0];
    const last = chapterSteps[chapterSteps.length - 1];
    // First and last step of every chapter have a real source, so reached is never null there.
    const firstReached = first?.reached ?? 0;
    return {
      key,
      label: FUNNEL_CHAPTER_LABELS[key],
      short: FUNNEL_CHAPTER_SHORT[key],
      steps: chapterSteps,
      enter: firstReached + (first?.dropped ?? 0),
      exit: last?.reached ?? 0,
    };
  });
}

export function buildFunnel(input: BuildFunnelInput): Funnel {
  const included = includedUsers(input.users);
  const allowed = new Set(included.map(u => u.id));
  const byStep = usersByStep(input.views, allowed);
  const started = startedUsers(byStep, included, input.range);
  const measured = [...surveySteps(input.defs, byStep, started), ...paywallSteps(input, started, included)];
  const steps = toFunnelSteps(measured, started.size);
  return { steps, chapters: buildChapters(steps), started: started.size };
}

export interface BuildPaywallInput {
  users: UserRecord[];
  /** Distinct users per paywall event name in range. Absent names mean the event does not exist yet. */
  eventUsers: Map<string, Set<string>>;
  range: DateRange;
}

export function buildPaywall(input: BuildPaywallInput): Paywall {
  const included = includedUsers(input.users);
  const allowed = new Set(included.map(u => u.id));
  const count = (event: string): number | null => {
    const users = input.eventUsers.get(event);
    return users ? [...users].filter(id => allowed.has(id)).length : null;
  };
  // Trial → paid per plan follows the trial cohort: people who started a trial in range, and how many of them have paid.
  const plans = (Object.keys(PLAN_LABELS) as Exclude<PlanInterval, 'unknown'>[]).map(key => {
    const trials = included.filter(u => u.interval === key && isWithin(u.trialStartedAt, input.range));
    return { key, label: PLAN_LABELS[key], trials: trials.length, paid: trials.filter(u => u.paidAt !== null).length };
  });
  return {
    seen: count(PAYWALL_EVENTS.paywallViewed),
    trialDirect: count(PAYWALL_EVENTS.tryFreeTapped),
    closed: count(PAYWALL_EVENTS.paywallClosed),
    wheel: {
      entered: count(PAYWALL_EVENTS.wheelViewed),
      spun: count(PAYWALL_EVENTS.wheelSpun),
      offer90: count(PAYWALL_EVENTS.offer90Viewed),
      trial: count(PAYWALL_EVENTS.offerTrialStarted),
      paid: count(PAYWALL_EVENTS.offerPaid),
    },
    stalled10m: count(PAYWALL_EVENTS.paywallIdle10m),
    plans,
    save: { shown: count(PAYWALL_EVENTS.saveOfferShown), accepted: count(PAYWALL_EVENTS.saveOfferAccepted) },
  };
}

/**
 * Runtime modules are imported lazily so lib/funnel.test.ts can load this file under node's type stripping,
 * which cannot resolve extensionless TypeScript specifiers.
 */
async function loadDeps() {
  const [steps, analytics, queries] = await Promise.all([
    import('./onboarding-steps'),
    import('./onboarding-analytics'),
    import('./queries'),
  ]);
  return { ONBOARDING_STEPS: steps.ONBOARDING_STEPS, ...analytics, loadUsers: queries.loadUsers };
}

const ALL_PAYWALL_EVENTS = Object.values(PAYWALL_EVENTS);

/** Distinct users per paywall event that the app has ever emitted; never-seen events are left out so they render as "—". */
async function loadPaywallEventUsers(
  deps: Awaited<ReturnType<typeof loadDeps>>,
  range: DateRange,
): Promise<Map<string, Set<string>>> {
  const [seen, byName] = await Promise.all([
    deps.loadSeenEventNames(ALL_PAYWALL_EVENTS),
    deps.loadEventUsers(ALL_PAYWALL_EVENTS, range.from.toISOString(), range.to.toISOString()),
  ]);
  return new Map([...byName].filter(([name]) => seen.has(name)));
}

export async function loadFunnel(days = 30, users?: UserRecord[]): Promise<Funnel> {
  const deps = await loadDeps();
  const range = rangeForDays(days);
  const [allUsers, views, eventUsers] = await Promise.all([
    users ?? deps.loadUsers(),
    deps.loadStepViews(range.from.toISOString(), range.to.toISOString()),
    loadPaywallEventUsers(deps, range),
  ]);
  return buildFunnel({ defs: deps.ONBOARDING_STEPS, views, users: allUsers, eventUsers, range });
}

export async function loadPaywall(days = 30, users?: UserRecord[]): Promise<Paywall> {
  const deps = await loadDeps();
  const range = rangeForDays(days);
  const [allUsers, eventUsers] = await Promise.all([users ?? deps.loadUsers(), loadPaywallEventUsers(deps, range)]);
  return buildPaywall({ users: allUsers, eventUsers, range });
}
