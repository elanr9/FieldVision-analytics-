import type { ScreenEvent } from './onboarding-analytics';
import type { FlowScreenDef } from './onboarding-flow.generated';
import { FLOWS, FLOW_KEYS, PAYWALL_SECTION_KEY, exclusiveScreenIds, flowOfScreen, flowScreens, sectionByNumber, type FlowDef, type FlowKey, type FlowScreen, type FlowSectionKey } from './onboarding-flow';
import { currentPlanKeys, isPlanKey, planLabel } from './plans';
import type { UserRecord } from './types';

/**
 * Paywall funnel signals. These are derived keys, not raw product_events names: the athlete app's
 * onboarding flow emits `onboarding_screen_view` / `onboarding_answer` with a `screen` property, the parent
 * pay function emits `parent_pay_*`, and the retention offer function emits `retention_offer_accepted`.
 * See derivePaywallKeys in lib/onboarding-analytics.ts.
 */
export const PAYWALL_EVENTS = {
  tryFreeViewed: 'try_free_viewed', // screen view s36_try_free
  paywallViewed: 'paywall_viewed', // screen view s37_paywall
  checkoutStarted: 'checkout_started', // plan answer on s37_paywall: the athlete went to Stripe checkout
  paywallClosed: 'paywall_closed', // tapped "Not now" on the paywall, which opens the wheel
  wheelViewed: 'wheel_viewed', // screen view of the deal wheel
  wheelSpun: 'wheel_spun', // answer on the wheel: a $30 or $150 credit was won
  creditCheckout: 'credit_checkout', // plan answer on s37_paywall carrying a wheel credit
  parentAsked: 'parent_asked', // opened "ask a parent to pay" (s37d_parent_pay) or sent the link
  parentSent: 'parent_sent', // parent_pay_sent: the pay link went out
  parentPaid: 'parent_paid', // parent_pay_paid: the parent finished checkout
  paywallIdle10m: 'paywall_idle_10m', // analytics_notifications type stalled
  saveOfferShown: 'save_offer_shown', // churned in range or accepted the free month (no shown event exists)
  saveOfferAccepted: 'save_offer_accepted', // retention_offer_accepted
} as const;

/** Screen ids from the athlete app's onboarding flow (inkbound-web and inkbound-mobile src/flow). */
export const PAYWALL_SCREENS = {
  tryFree: 's36_try_free',
  paywall: 's37_paywall',
  wheel: 's37c_deal_wheel',
  parentPay: 's37d_parent_pay',
} as const;

/** The wheel under its current id and the one it had before the redesign, so history still counts. */
export const WHEEL_SCREENS: ReadonlySet<string> = new Set([PAYWALL_SCREENS.wheel, 's37c_spin_wheel']);

/** One chapter per flow section; the last section is the paywall. */
export type FunnelChapterKey = FlowSectionKey;

/** Funnel steps that come from account data instead of a flow screen. They close the paywall chapter. */
export const TRIAL_STEP_ID = 'trial_started';
export const SUBSCRIBED_STEP_ID = 'subscribed';

/** The classic flow's first screen. Each flow names its own in lib/onboarding-flow.ts (FLOWS[flow].startScreen). */
export const STARTED_SCREEN_ID = FLOWS.classic.startScreen;

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
  /** Which onboarding flow this funnel follows. */
  flow: FlowKey;
  flowLabel: string;
  steps: FunnelStep[];
  chapters: Chapter[];
  started: number;
  /** How `started` was measured. accounts_created is the fallback while screens before sign-in are not recorded. */
  startedSource: StartedSource;
  /** Screen ids seen in product_events that the generated mirror lacks. Run scripts/sync-onboarding-flow.mjs. */
  unknownScreens: string[];
  /** Steps before the first screen the apps record; they render as "—". */
  untrackedSteps: number;
  /** Of those who started a trial in range, how many have paid. Paying without a trial is possible, so this is not paid ÷ trial. */
  trialConverted: number;
}

export interface PaywallPlan {
  /** Stripe payment_type, e.g. inkbound_elite_annual. */
  key: string;
  label: string;
  trials: number;
  paid: number;
}

export interface Paywall {
  seen: number | null;
  /** Picked a plan and went to Stripe checkout. */
  checkout: number | null;
  /** Tapped "Not now". The deal wheel opens next. */
  closed: number | null;
  wheel: {
    entered: number | null;
    spun: number | null;
    /** Went to checkout with a wheel credit applied. */
    checkout: number | null;
    /** Of those, now on a trial or paying. */
    converted: number | null;
  };
  parent: {
    /** Opened "ask a parent to pay". */
    asked: number | null;
    sent: number | null;
    paid: number | null;
  };
  /** Started a trial or paid in range, among people who saw the paywall in range. */
  converted: number | null;
  stalled10m: number | null;
  plans: PaywallPlan[];
  save: { shown: number | null; accepted: number | null };
}

export interface DateRange {
  from: Date;
  to: Date;
}

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
  return users.filter(u => !u.excludedFromMetrics && !u.isParent && !u.fakeReason);
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
 * Whether the apps are really recording the screens before sign-in. A couple of returning users
 * replaying onboarding are enough to put rows on the first screen, which is not the same as the
 * instrumentation working, so this asks the pre-auth stretch to be reporting broadly first.
 */
function preAuthTracked(flow: FlowDef, screens: FlowScreen[], byScreen: Map<string, Set<string>>): boolean {
  const accountAt = screens.findIndex(s => s.id === flow.accountScreen);
  const preAuth = screens.slice(0, accountAt === -1 ? screens.length : accountAt);
  if (preAuth.length === 0) return false;
  const reporting = preAuth.filter(s => (byScreen.get(s.id)?.size ?? 0) > 0).length;
  return reporting * 2 >= preAuth.length;
}

/**
 * Who started onboarding. The apps only write product_events once a user is signed in and the account is
 * created mid-flow; they hold the earlier screens on the device and write them when the account exists.
 * Where that works, "started" is everyone who viewed the flow's start screen. Where it does not, the honest
 * count is accounts created in range that have any event in this flow. Either way a visitor who left before
 * creating an account is invisible here: product_events has no anonymous rows.
 */
function startedUsers(
  flow: FlowDef,
  preAuthOk: boolean,
  byScreen: Map<string, Set<string>>,
  included: UserRecord[],
  range: DateRange,
): { users: Set<string>; source: StartedSource } {
  const viewers = byScreen.get(flow.startScreen);
  if (viewers && viewers.size > 0 && preAuthOk) {
    return { users: viewers, source: 'welcome_screen' };
  }
  const inFlow = new Set<string>();
  for (const set of byScreen.values()) for (const id of set) inFlow.add(id);
  return {
    users: new Set(included.filter(u => inFlow.has(u.id) && isWithin(u.signupDate, range)).map(u => u.id)),
    source: 'accounts_created',
  };
}

export interface BuildFunnelInput {
  events: ScreenEvent[];
  users: UserRecord[];
  range: DateRange;
  /** Which flow to follow. Defaults to the classic flow. */
  flow?: FlowKey;
  /** Defaults to the flow's generated mirror; tests pass a small list. */
  defs?: FlowScreenDef[];
  /** Screen ids the apps have ever emitted, all time. Anything absent renders as "—" instead of a zero. */
  seenScreens?: Set<string>;
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
 * Screen steps in flow order. A screen the apps have never emitted is untracked (null) so it renders
 * as "—" rather than a drop nobody made; everything they do emit is a real count, including zeros.
 * `seen` is the all-time set of emitted ids. Without it, position is the only available clue and
 * screens before the first one with events are treated as untracked.
 */
function screenSteps(
  flow: FlowDef,
  screens: FlowScreen[],
  byScreen: Map<string, Set<string>>,
  started: Set<string>,
  source: StartedSource,
  preAuthOk: boolean,
  seen?: Set<string>,
): MeasuredStep[] {
  const firstTracked = screens.findIndex(s => (byScreen.get(s.id)?.size ?? 0) > 0);
  const accountAt = screens.findIndex(s => s.id === flow.accountScreen);
  const preAuthEnd = accountAt === -1 ? 0 : accountAt;
  const startAt = screens.findIndex(s => s.id === flow.startScreen);
  return screens.map((s, i) => {
    // Screens before the account exist only if the apps buffer pre-auth events, which either works
    // for the whole stretch or none of it. The few rows returning users leave behind are not coverage.
    const untracked = i < preAuthEnd
      ? !preAuthOk
      : seen
        ? !seen.has(s.id)
        : firstTracked === -1 || i < firstTracked;
    const isStart = s.id === flow.startScreen && source === 'welcome_screen';
    const section = sectionByNumber(s.section, flow.sections);
    return {
      id: s.id,
      label: s.label,
      chapter: section.key,
      // Anything ahead of the start screen is an entry point some people skip, never a drop.
      conditional: s.conditional || i < startAt,
      known: s.known,
      reached: isStart ? started.size : untracked ? null : countStarted(byScreen.get(s.id), started),
    };
  });
}

/** Trial and paid come from account data, so they are always measured. */
function accountSteps(started: Set<string>, included: UserRecord[], range: DateRange): MeasuredStep[] {
  const cohort = included.filter(u => started.has(u.id));
  const paywall = PAYWALL_SECTION_KEY;
  return [
    { id: TRIAL_STEP_ID, label: 'Started a free trial', chapter: paywall, conditional: false, known: true, reached: cohort.filter(u => isWithin(u.trialStartedAt, range)).length },
    { id: SUBSCRIBED_STEP_ID, label: 'Paid', chapter: paywall, conditional: false, known: true, reached: cohort.filter(u => isWithin(u.paidAt, range)).length },
  ];
}

function toFunnelSteps(measured: MeasuredStep[], started: number, flow: FlowDef): FunnelStep[] {
  let previousReached = started;
  const labels = new Map(flow.sections.map(sec => [sec.key, sec.label]));
  return measured.map(m => {
    const base = { ...m, chapterLabel: labels.get(m.chapter) ?? m.chapter };
    if (m.reached === null) return { ...base, pct: null, dropped: null, dropPct: null };
    const pct = pct1(m.reached, started);
    if (m.conditional) return { ...base, pct, dropped: null, dropPct: null };
    const arrivals = previousReached;
    previousReached = m.reached;
    // More people here than at the step before means the earlier step is under-tracked, not that
    // nobody left. There is no drop to report, and a negative one would be a lie.
    if (m.reached > arrivals) return { ...base, pct, dropped: null, dropPct: null };
    const dropped = arrivals - m.reached;
    return { ...base, pct, dropped, dropPct: pct1(dropped, arrivals) };
  });
}

export function buildChapters(steps: FunnelStep[], flow: FlowKey = 'classic'): Chapter[] {
  return FLOWS[flow].sections.map(section => {
    const chapterSteps = steps.filter(s => s.chapter === section.key);
    // Arrivals are measured at the first tracked step; untracked leading screens carry no information.
    // An optional entry screen ahead of it (a welcome only some people land on) says nothing about arrivals either.
    const first = chapterSteps.find(s => s.reached !== null && !s.conditional) ?? chapterSteps.find(s => s.reached !== null);
    const lastUnconditional = [...chapterSteps].reverse().find(s => !s.conditional) ?? chapterSteps[chapterSteps.length - 1];
    const exit = lastUnconditional?.reached ?? null;
    const entered = first?.reached == null ? null : first.reached + (first.dropped ?? 0);
    return {
      key: section.key,
      label: section.label,
      short: section.short,
      steps: chapterSteps,
      // A chapter cannot be finished by more people than entered it; when it looks that way the entry is what is unknown.
      enter: entered !== null && exit !== null && exit > entered ? null : entered,
      exit,
    };
  });
}

export function buildFunnel(input: BuildFunnelInput): Funnel {
  const flow = FLOWS[input.flow ?? 'classic'];
  const defs = input.defs ?? flow.defs;
  const included = includedUsers(input.users);
  // A person is in this flow once they touch a screen only it has. The paywall tail is shared, so on its
  // own it says nothing about which flow brought them there.
  const exclusive = input.defs ? null : exclusiveScreenIds(flow.key);
  const members = new Set<string>();
  for (const e of input.events) {
    if (!exclusive || exclusive.has(e.screen) || flowOfScreen(e.screen) === flow.key) members.add(e.userId);
  }
  const allowed = new Set(included.filter(u => members.has(u.id)).map(u => u.id));
  const events = input.events.filter(e => flow.accepts(e.screen) || defs.some(d => d.id === e.screen));
  const byScreen = usersByScreen(events, allowed);
  const screens = flowScreens(byScreen.keys(), defs, flow.accepts);
  const preAuthOk = preAuthTracked(flow, screens, byScreen);
  const started = startedUsers(flow, preAuthOk, byScreen, included, input.range);
  const measured = [
    ...screenSteps(flow, screens, byScreen, started.users, started.source, preAuthOk, input.seenScreens),
    ...accountSteps(started.users, included, input.range),
  ];
  const steps = toFunnelSteps(measured, started.users.size, flow);
  const cohort = included.filter(u => started.users.has(u.id));
  return {
    flow: flow.key,
    flowLabel: flow.label,
    steps,
    chapters: buildChapters(steps, flow.key),
    started: started.users.size,
    startedSource: started.source,
    unknownScreens: steps.filter(s => !s.known).map(s => s.id),
    untrackedSteps: steps.filter(s => s.reached === null).length,
    trialConverted: cohort.filter(u => isWithin(u.trialStartedAt, input.range) && u.paidAt !== null).length,
  };
}

/** The flow most people started in range leads; a flow nobody touched is left out unless both are empty. */
export function orderFunnels(funnels: Funnel[]): Funnel[] {
  const live = funnels.filter(f => f.started > 0).sort((a, b) => b.started - a.started);
  return live.length > 0 ? live : funnels.slice(0, 1);
}

export interface BuildPaywallInput {
  users: UserRecord[];
  /** Distinct users per paywall event name in range. Absent names mean the event does not exist yet. */
  eventUsers: Map<string, Set<string>>;
  range: DateRange;
}

/** Tiles shown in "Trial → paid by plan". */
export const PLAN_TILES = 3;

/**
 * Trial → paid per plan follows the trial cohort: people who started a trial in range, and how many of them have
 * paid. Plans come from the cohort's own Stripe payment_type values (most trials first) so a new price shows up on
 * its own; the plans sold today fill any empty tiles.
 */
export function buildPlans(included: UserRecord[], range: DateRange): PaywallPlan[] {
  const byPlan = new Map<string, UserRecord[]>();
  for (const u of included) {
    const key = u.paymentType;
    if (!isPlanKey(key) || !isWithin(u.trialStartedAt, range)) continue;
    byPlan.set(key, [...(byPlan.get(key) ?? []), u]);
  }
  const keys = [...byPlan.keys()].sort((a, b) => (byPlan.get(b)?.length ?? 0) - (byPlan.get(a)?.length ?? 0) || a.localeCompare(b));
  for (const key of currentPlanKeys()) {
    if (keys.length >= PLAN_TILES) break;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys.slice(0, PLAN_TILES).map(key => {
    const trials = byPlan.get(key) ?? [];
    return { key, label: planLabel(key) ?? key, trials: trials.length, paid: trials.filter(u => u.paidAt !== null).length };
  });
}

export function buildPaywall(input: BuildPaywallInput): Paywall {
  const included = includedUsers(input.users);
  const allowed = new Set(included.map(u => u.id));
  const ids = (event: string): string[] | null => {
    const users = input.eventUsers.get(event);
    return users ? [...users].filter(id => allowed.has(id)) : null;
  };
  const count = (event: string): number | null => ids(event)?.length ?? null;
  const byId = new Map(included.map(u => [u.id, u]));
  const live = (id: string) => {
    const status = byId.get(id)?.status;
    return status === 'trialing' || status === 'paying';
  };
  const converted = (id: string) => {
    const u = byId.get(id);
    return u !== undefined && (isWithin(u.trialStartedAt, input.range) || isWithin(u.paidAt, input.range)) && u.status !== 'signed_up';
  };
  const seen = ids(PAYWALL_EVENTS.paywallViewed);
  const credit = ids(PAYWALL_EVENTS.creditCheckout);
  // Nobody records "save offer shown"; the closest real denominator is everyone who reached the cancel flow:
  // churned in range plus those who took the free month instead.
  const accepted = count(PAYWALL_EVENTS.saveOfferAccepted);
  const churned = included.filter(u => u.status === 'churned' && isWithin(u.paidAt, input.range)).length;
  return {
    seen: seen?.length ?? null,
    checkout: count(PAYWALL_EVENTS.checkoutStarted),
    closed: count(PAYWALL_EVENTS.paywallClosed),
    wheel: {
      entered: count(PAYWALL_EVENTS.wheelViewed),
      spun: count(PAYWALL_EVENTS.wheelSpun),
      checkout: credit?.length ?? null,
      converted: credit ? credit.filter(live).length : null,
    },
    parent: {
      asked: count(PAYWALL_EVENTS.parentAsked),
      sent: count(PAYWALL_EVENTS.parentSent),
      paid: count(PAYWALL_EVENTS.parentPaid),
    },
    converted: seen ? seen.filter(converted).length : null,
    stalled10m: count(PAYWALL_EVENTS.paywallIdle10m),
    plans: buildPlans(included, input.range),
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

/** One funnel per onboarding flow, the flow most people started in range first. */
export async function loadFunnels(days = 30, users?: UserRecord[]): Promise<Funnel[]> {
  const deps = await loadDeps();
  const range = rangeForDays(days);
  const [allUsers, events, seenScreens] = await Promise.all([
    users ?? deps.loadUsers(),
    deps.loadScreenEvents(range.from.toISOString(), range.to.toISOString()),
    deps.loadSeenScreenIds(),
  ]);
  return orderFunnels(FLOW_KEYS.map(flow => buildFunnel({ events, users: allUsers, range, seenScreens, flow })));
}

/** The funnel of the flow that is live: the one most people started in range. */
export async function loadFunnel(days = 30, users?: UserRecord[]): Promise<Funnel> {
  return (await loadFunnels(days, users))[0];
}

export async function loadPaywall(days = 30, users?: UserRecord[]): Promise<Paywall> {
  const deps = await loadDeps();
  const range = rangeForDays(days);
  const [allUsers, eventUsers] = await Promise.all([users ?? deps.loadUsers(), loadPaywallEventUsers(deps, range)]);
  return buildPaywall({ users: allUsers, eventUsers, range });
}
