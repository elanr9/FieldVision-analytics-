import type { DateRange } from '../funnel';
import { OUTCOME_LABEL, type Outcome, type UserLifecycle } from './lifecycle';
import { REASON_META, REASON_ORDER, explainLoss, isLost, type LossReason, type Verdict } from './reasons';

/** One athlete's whole story, safe to send to the client. */
export interface ChurnCase {
  lifecycle: UserLifecycle;
  verdict: Verdict | null;
}

export interface ConversionData {
  cases: ChurnCase[];
  stripe: { configured: boolean; error: string | null };
  generatedAt: string;
}

export const EMPTY_CONVERSION_DATA: ConversionData = {
  cases: [],
  stripe: { configured: false, error: null },
  generatedAt: new Date(0).toISOString(),
};

export interface Headline {
  candidates: number;
  trials: number;
  converted: number;
  trialToPaidPct: number;
  paidChurned: number;
  stillTrialing: number;
  lost: number;
  lostMonthlyCents: number;
  lostOneTimeCents: number;
  medianDaysToCancel: number | null;
}

export interface LeakStep {
  key: string;
  label: string;
  count: number;
  /** count / first step, one decimal */
  pct: number;
  /** Lost from the previous step as a percentage of it, null for the first step */
  dropPct: number | null;
  userIds: string[];
}

export interface ReasonBucket {
  reason: LossReason;
  title: string;
  meaning: string;
  accent: string;
  count: number;
  pctOfLost: number;
  lostMonthlyCents: number;
  userIds: string[];
}

export interface Medians {
  people: number;
  emailsSent: number;
  repliesReceived: number;
  videosCreated: number;
  activeDays: number;
  /** Share who sent at least one coach email, whole percent */
  activatedPct: number;
}

export interface CancelBucket {
  label: string;
  count: number;
  userIds: string[];
}

export interface Cohort {
  month: string;
  label: string;
  signups: number;
  trials: number;
  converted: number;
  lost: number;
  ratePct: number | null;
}

export interface PlanSplit {
  plan: string;
  label: string;
  trials: number;
  converted: number;
  canceled: number;
  ratePct: number | null;
  userIds: string[];
}

export interface FeedbackTally {
  feedback: string;
  label: string;
  count: number;
}

export interface CancelComment {
  userId: string;
  name: string;
  comment: string;
  feedback: string | null;
}

export interface Warning {
  text: string;
  userIds: string[];
}

export interface Fix {
  reason: LossReason;
  title: string;
  action: string;
  why: string;
  affected: number;
  recoverableMonthlyCents: number;
  userIds: string[];
}

export interface OutcomeCount {
  outcome: Outcome;
  label: string;
  count: number;
  userIds: string[];
}

export interface ConversionReport {
  headline: Headline;
  leaks: LeakStep[];
  outcomes: OutcomeCount[];
  reasons: ReasonBucket[];
  comparison: { converters: Medians; lost: Medians };
  timeToCancel: CancelBucket[];
  cohorts: Cohort[];
  plans: PlanSplit[];
  stripeFeedback: FeedbackTally[];
  comments: CancelComment[];
  warnings: Warning[];
  fixes: Fix[];
}

/** What to do about each loss pattern. Keep the action concrete enough to ship this week. */
export const FIX_PLAYBOOK: Record<LossReason, { action: string; why: string }> = {
  payment_failed: {
    action: 'Turn on Stripe Smart Retries and text every failed card within 24 hours with a one tap update link.',
    why: 'These athletes decided to pay. Nothing about the product needs to change, only the recovery.',
  },
  refunded: {
    action: 'Call every refund within 48 hours and ask what they expected. Offer a free month instead when the gap is fixable.',
    why: 'A refund is the loudest feedback you have. Each one is a product interview waiting to happen.',
  },
  cancel_day_one: {
    action: 'Ask for the card on day 5 instead of day 0, and build the first campaign inside the first session so there is something to lose.',
    why: 'Canceling in the first hour is about dodging the charge, not the product. Nobody saw the value yet.',
  },
  never_activated: {
    action: 'Auto build the first campaign from the onboarding answers and text the athlete the moment it is ready.',
    why: 'A trial with zero campaigns is a wasted trial. The app should do the first hard thing for them.',
  },
  sent_no_replies: {
    action: 'Extend the trial to 14 days for anyone who sends a campaign, and show coach opens and video views inside the app while replies are pending.',
    why: 'Coaches reply in two to three weeks. A 7 day trial ends before the proof arrives.',
  },
  power_user_left: {
    action: 'Call each one this week. Offer a cheaper monthly option or a pause instead of a cancel, and read their Stripe feedback first.',
    why: 'They used it heavily and still left. That is price or commitment, and both are negotiable.',
  },
  went_silent: {
    action: 'On day 3 of silence send the founder check in text plus a push about any coach opens. Make the return path one tap.',
    why: 'They were engaged and drifted. A timely nudge is cheap and the habit is still warm.',
  },
  expired_silently: {
    action: 'Verify the trial end webhook charges the card, and require a valid card before the trial starts.',
    why: 'Silent expiry means no cancel and no charge. Either the card was never valid or the billing did not fire.',
  },
  stopped_at_paywall: {
    action: 'Show trial terms before the price, test the paywall copy, and send the check in text within an hour of the paywall view.',
    why: 'They did all the onboarding work and balked at the ask. The price screen is the leak.',
  },
  abandoned_onboarding: {
    action: 'Cut the onboarding flow to the questions that change the first campaign. Use the Onboarding tab to find the exact screens that lose people.',
    why: 'Every screen before the paywall is a chance to leave.',
  },
  never_opened: {
    action: 'Send a welcome text within 10 minutes of signup with a link straight into onboarding.',
    why: 'Most of these are drive by signups. A fast personal touch is the only lever that works.',
  },
};

const FEEDBACK_LABEL: Record<string, string> = {
  too_expensive: 'Too expensive',
  unused: 'Did not use it',
  missing_features: 'Missing features',
  switched_service: 'Switched to something else',
  customer_service: 'Customer service',
  low_quality: 'Low quality',
  too_complex: 'Too complex',
  other: 'Other',
};

function pct1(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

function ids(cases: ChurnCase[]): string[] {
  return cases.map(c => c.lifecycle.userId);
}

function anchorDate(l: UserLifecycle): string {
  return l.trialStartAt ?? l.signupAt;
}

function inRange(l: UserLifecycle, range: DateRange | null): boolean {
  if (!range) return true;
  const t = new Date(anchorDate(l)).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

function activated(l: UserLifecycle): boolean {
  const e = l.engagement;
  return e.emailsSent > 0 || e.campaignsCreated > 0 || e.videosCreated > 0;
}

function trialed(l: UserLifecycle): boolean {
  return l.trialStartAt !== null || l.outcome === 'converted' || l.outcome === 'paid_churned';
}

function canceledOutcome(o: Outcome): boolean {
  return o === 'canceled_in_trial' || o === 'paid_churned' || o === 'payment_failed' || o === 'refunded';
}

function medians(cases: ChurnCase[]): Medians {
  const e = cases.map(c => c.lifecycle.engagement);
  return {
    people: cases.length,
    emailsSent: median(e.map(x => x.emailsSent)),
    repliesReceived: median(e.map(x => x.repliesReceived)),
    videosCreated: median(e.map(x => x.videosCreated)),
    activeDays: median(e.map(x => x.activeDays)),
    activatedPct: cases.length === 0 ? 0 : Math.round((cases.filter(c => activated(c.lifecycle)).length / cases.length) * 100),
  };
}

function buildLeaks(cases: ChurnCase[]): LeakStep[] {
  const signedUp = cases;
  const finished = cases.filter(c => c.lifecycle.onboarding === 'completed' || trialed(c.lifecycle));
  const trials = cases.filter(c => trialed(c.lifecycle));
  const used = trials.filter(c => activated(c.lifecycle));
  const converted = cases.filter(c => c.lifecycle.outcome === 'converted');

  const steps = [
    { key: 'signed_up', label: 'Signed up', cases: signedUp },
    { key: 'finished_onboarding', label: 'Finished onboarding', cases: finished },
    { key: 'started_trial', label: 'Started a trial', cases: trials },
    { key: 'used_trial', label: 'Used the trial', cases: used },
    { key: 'converted', label: 'Paying', cases: converted },
  ];
  const first = steps[0].cases.length;
  return steps.map((s, i) => {
    const prev = i === 0 ? null : steps[i - 1].cases.length;
    return {
      key: s.key,
      label: s.label,
      count: s.cases.length,
      pct: pct1(s.cases.length, first),
      dropPct: prev === null ? null : pct1(Math.max(0, prev - s.cases.length), prev),
      userIds: ids(s.cases),
    };
  });
}

function buildReasons(lost: ChurnCase[]): ReasonBucket[] {
  return REASON_ORDER.map(reason => {
    const group = lost.filter(c => c.verdict?.reason === reason);
    const meta = REASON_META[reason];
    return {
      reason,
      title: meta.title,
      meaning: meta.meaning,
      accent: meta.accent,
      count: group.length,
      pctOfLost: lost.length === 0 ? 0 : Math.round((group.length / lost.length) * 100),
      lostMonthlyCents: group.reduce((sum, c) => sum + c.lifecycle.planMonthlyCents, 0),
      userIds: ids(group),
    };
  })
    .filter(b => b.count > 0)
    .sort((a, b) => b.count - a.count || b.lostMonthlyCents - a.lostMonthlyCents);
}

function buildTimeToCancel(cases: ChurnCase[]): CancelBucket[] {
  const canceled = cases.filter(c => canceledOutcome(c.lifecycle.outcome) && c.lifecycle.daysToCancel !== null);
  // Days 1 to 6 are hands on cancels; "Trial end" is the day 7 auto cancel; anything later happened after access was already gone or charged.
  const labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Trial end', 'Later'];
  const buckets: CancelBucket[] = labels.map(label => ({ label, count: 0, userIds: [] }));
  for (const c of canceled) {
    const days = c.lifecycle.daysToCancel ?? 0;
    const index = days >= 8 ? 7 : Math.min(6, Math.floor(days));
    buckets[index].count += 1;
    buckets[index].userIds.push(c.lifecycle.userId);
  }
  return buckets;
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function monthLabel(key: string): string {
  return new Date(`${key}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function buildCohorts(cases: ChurnCase[]): Cohort[] {
  const byMonth = new Map<string, ChurnCase[]>();
  for (const c of cases) {
    const key = monthKey(c.lifecycle.signupAt);
    byMonth.set(key, [...(byMonth.get(key) ?? []), c]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => {
      const trials = group.filter(c => trialed(c.lifecycle));
      const converted = group.filter(c => c.lifecycle.outcome === 'converted');
      const lost = trials.filter(c => isLost(c.lifecycle.outcome));
      return {
        month,
        label: monthLabel(month),
        signups: group.length,
        trials: trials.length,
        converted: converted.length,
        lost: lost.length,
        ratePct: trials.length === 0 ? null : Math.round((converted.length / trials.length) * 100),
      };
    });
}

function buildPlans(cases: ChurnCase[]): PlanSplit[] {
  const byPlan = new Map<string, ChurnCase[]>();
  for (const c of cases) {
    if (!c.lifecycle.planTried || !trialed(c.lifecycle)) continue;
    byPlan.set(c.lifecycle.planTried, [...(byPlan.get(c.lifecycle.planTried) ?? []), c]);
  }
  return [...byPlan.entries()]
    .map(([plan, group]) => {
      const converted = group.filter(c => c.lifecycle.outcome === 'converted').length;
      const canceled = group.filter(c => canceledOutcome(c.lifecycle.outcome)).length;
      return {
        plan,
        label: group[0].lifecycle.planLabel ?? plan,
        trials: group.length,
        converted,
        canceled,
        ratePct: Math.round((converted / group.length) * 100),
        userIds: ids(group),
      };
    })
    .sort((a, b) => b.trials - a.trials);
}

function buildFeedback(cases: ChurnCase[]): { tally: FeedbackTally[]; comments: CancelComment[] } {
  const counts = new Map<string, number>();
  const comments: CancelComment[] = [];
  for (const c of cases) {
    const s = c.lifecycle.stripe;
    if (!s) continue;
    if (s.cancelFeedback) counts.set(s.cancelFeedback, (counts.get(s.cancelFeedback) ?? 0) + 1);
    if (s.cancelComment) comments.push({ userId: c.lifecycle.userId, name: c.lifecycle.name, comment: s.cancelComment, feedback: s.cancelFeedback });
  }
  const tally = [...counts.entries()]
    .map(([feedback, count]) => ({ feedback, label: FEEDBACK_LABEL[feedback] ?? feedback.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count);
  return { tally, comments };
}

function buildWarnings(cases: ChurnCase[], stripe: ConversionData['stripe']): Warning[] {
  const grouped = new Map<string, string[]>();
  for (const c of cases) {
    for (const text of c.lifecycle.warnings) grouped.set(text, [...(grouped.get(text) ?? []), c.lifecycle.userId]);
  }
  const warnings: Warning[] = [...grouped.entries()].map(([text, userIds]) => ({ text, userIds })).sort((a, b) => b.userIds.length - a.userIds.length);
  if (!stripe.configured) warnings.unshift({ text: 'STRIPE_SECRET_KEY is not set, so cancel reasons, card failures, and refunds are missing from this view', userIds: [] });
  else if (stripe.error) warnings.unshift({ text: `Stripe could not be read: ${stripe.error}`, userIds: [] });
  return warnings;
}

function buildFixes(reasons: ReasonBucket[]): Fix[] {
  return reasons.map(b => {
    const play = FIX_PLAYBOOK[b.reason];
    return {
      reason: b.reason,
      title: b.title,
      action: play.action,
      why: play.why,
      affected: b.count,
      recoverableMonthlyCents: b.lostMonthlyCents,
      userIds: b.userIds,
    };
  });
}

function buildOutcomes(cases: ChurnCase[]): OutcomeCount[] {
  const order: Outcome[] = [
    'converted',
    'still_trialing',
    'paid_churned',
    'payment_failed',
    'refunded',
    'canceled_in_trial',
    'trial_expired',
    'stopped_at_paywall',
    'abandoned_onboarding',
    'never_opened',
  ];
  return order
    .map(outcome => {
      const group = cases.filter(c => c.lifecycle.outcome === outcome);
      return { outcome, label: OUTCOME_LABEL[outcome], count: group.length, userIds: ids(group) };
    })
    .filter(o => o.count > 0);
}

/** Attaches a verdict to every lifecycle. */
export function buildCases(lifecycles: UserLifecycle[]): ChurnCase[] {
  return lifecycles.map(lifecycle => ({ lifecycle, verdict: explainLoss(lifecycle) }));
}

/**
 * The whole conversion picture for the cases whose trial (or signup, when they never trialed)
 * falls inside the range. Pure, so the client can recompute it when the range toggle changes.
 */
export function buildConversionReport(data: ConversionData, range: DateRange | null = null): ConversionReport {
  const cases = data.cases.filter(c => inRange(c.lifecycle, range));
  const trials = cases.filter(c => trialed(c.lifecycle));
  const converted = cases.filter(c => c.lifecycle.outcome === 'converted');
  const lost = cases.filter(c => c.verdict !== null);
  const lostTrials = trials.filter(c => isLost(c.lifecycle.outcome));
  const daysToCancel = cases.map(c => c.lifecycle.daysToCancel).filter((d): d is number => d !== null);

  const reasons = buildReasons(lost);
  const feedback = buildFeedback(cases);

  return {
    headline: {
      candidates: cases.length,
      trials: trials.length,
      converted: converted.length,
      trialToPaidPct: pct1(converted.length, trials.length),
      paidChurned: cases.filter(c => c.lifecycle.outcome === 'paid_churned' || c.lifecycle.outcome === 'refunded').length,
      stillTrialing: cases.filter(c => c.lifecycle.outcome === 'still_trialing').length,
      lost: lost.length,
      lostMonthlyCents: lostTrials.reduce((sum, c) => sum + c.lifecycle.planMonthlyCents, 0),
      lostOneTimeCents: lostTrials.reduce((sum, c) => sum + c.lifecycle.planOneTimeCents, 0),
      medianDaysToCancel: daysToCancel.length === 0 ? null : median(daysToCancel),
    },
    leaks: buildLeaks(cases),
    outcomes: buildOutcomes(cases),
    reasons,
    comparison: { converters: medians(converted), lost: medians(lostTrials) },
    timeToCancel: buildTimeToCancel(cases),
    cohorts: buildCohorts(cases),
    plans: buildPlans(cases),
    stripeFeedback: feedback.tally,
    comments: feedback.comments,
    warnings: buildWarnings(cases, data.stripe),
    fixes: buildFixes(reasons),
  };
}