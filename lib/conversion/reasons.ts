import type { Engagement, Outcome, UserLifecycle } from './lifecycle';

/** Why one athlete did not become (or stay) a paying customer. One reason per person. */
export type LossReason =
  | 'payment_failed'
  | 'refunded'
  | 'cancel_day_one'
  | 'never_activated'
  | 'sent_no_replies'
  | 'power_user_left'
  | 'went_silent'
  | 'expired_silently'
  | 'stopped_at_paywall'
  | 'abandoned_onboarding'
  | 'never_opened';

export interface Verdict {
  reason: LossReason;
  /** Short facts that back the verdict, shown under the reason */
  evidence: string[];
}

export interface ReasonMeta {
  title: string;
  /** What this pattern usually means for the product */
  meaning: string;
  accent: string;
}

export const REASON_META: Record<LossReason, ReasonMeta> = {
  payment_failed: {
    title: 'Card failed',
    meaning: 'They meant to pay. The charge did not go through and nothing recovered it.',
    accent: '#dc2626',
  },
  refunded: {
    title: 'Asked for a refund',
    meaning: 'Paid, then wanted the money back. Strongest signal the product missed expectations.',
    accent: '#b91c1c',
  },
  cancel_day_one: {
    title: 'Canceled within a day',
    meaning: 'Started the trial and canceled almost immediately, usually to avoid the charge before exploring.',
    accent: '#f97316',
  },
  never_activated: {
    title: 'Trial, but never used it',
    meaning: 'Had full access for a week and did not send an email, build a campaign, or make a video.',
    accent: '#f59e0b',
  },
  sent_no_replies: {
    title: 'Emailed coaches, no replies',
    meaning: 'Did the work the app asked for and saw nothing come back before the trial ended.',
    accent: '#eab308',
  },
  power_user_left: {
    title: 'Heavy user, still left',
    meaning: 'Got real value and canceled anyway. Almost always price or an unwanted long commitment.',
    accent: '#8b5cf6',
  },
  went_silent: {
    title: 'Used it, then went quiet',
    meaning: 'Active early in the trial, then days of silence before the cancel or expiry.',
    accent: '#0ea5e9',
  },
  expired_silently: {
    title: 'Trial ran out quietly',
    meaning: 'No cancel, no charge, no activity at the end. The card never charged or was never valid.',
    accent: '#64748b',
  },
  stopped_at_paywall: {
    title: 'Stopped at the paywall',
    meaning: 'Finished onboarding, saw the price, did not start a trial.',
    accent: '#a855f7',
  },
  abandoned_onboarding: {
    title: 'Quit during onboarding',
    meaning: 'Never reached the paywall. Something in the flow lost them.',
    accent: '#94a3b8',
  },
  never_opened: {
    title: 'Never came back',
    meaning: 'Created an account and did nothing else.',
    accent: '#cbd5e1',
  },
};

export const REASON_ORDER: LossReason[] = [
  'payment_failed',
  'refunded',
  'cancel_day_one',
  'never_activated',
  'sent_no_replies',
  'power_user_left',
  'went_silent',
  'expired_silently',
  'stopped_at_paywall',
  'abandoned_onboarding',
  'never_opened',
];

/** Trial outcomes that reasons are computed for. Converted and still trialing users have no loss reason. */
const LOST_OUTCOMES: ReadonlySet<Outcome> = new Set<Outcome>([
  'paid_churned',
  'payment_failed',
  'refunded',
  'canceled_in_trial',
  'trial_expired',
  'stopped_at_paywall',
  'abandoned_onboarding',
  'never_opened',
]);

export function isLost(outcome: Outcome): boolean {
  return LOST_OUTCOMES.has(outcome);
}

const POWER_USER_EMAILS = 30;
const SILENT_DAYS = 3;

function activated(e: Engagement): boolean {
  return e.emailsSent > 0 || e.campaignsCreated > 0 || e.videosCreated > 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function usageEvidence(e: Engagement): string[] {
  const out: string[] = [];
  if (e.emailsSent > 0) out.push(`Sent ${plural(e.emailsSent, 'coach email', 'coach emails')}`);
  if (e.repliesReceived > 0) out.push(`Got ${plural(e.repliesReceived, 'reply', 'replies')}`);
  if (e.campaignsCreated > 0) out.push(`Built ${plural(e.campaignsCreated, 'campaign', 'campaigns')}`);
  if (e.videosCreated > 0) out.push(`Made ${plural(e.videosCreated, 'video', 'videos')}`);
  if (e.activeDays > 0) out.push(`Active ${plural(e.activeDays, 'day', 'days')}`);
  return out;
}

function stripeEvidence(l: UserLifecycle): string[] {
  const out: string[] = [];
  if (l.stripe?.cancelFeedback) out.push(`Stripe feedback: ${l.stripe.cancelFeedback.replace(/_/g, ' ')}`);
  if (l.stripe?.cancelComment) out.push(`"${l.stripe.cancelComment}"`);
  return out;
}

/**
 * Deterministic verdict for a lost athlete, checked in priority order so the most specific
 * explanation wins. Returns null for converted or still trialing users.
 */
export function explainLoss(l: UserLifecycle, powerUserEmails: number = POWER_USER_EMAILS): Verdict | null {
  if (!isLost(l.outcome)) return null;
  const e = l.engagement;

  if (l.outcome === 'payment_failed') {
    return { reason: 'payment_failed', evidence: [l.stripe?.status ? `Stripe status: ${l.stripe.status}` : 'Charge never succeeded', ...usageEvidence(e)] };
  }
  if (l.outcome === 'refunded') {
    return { reason: 'refunded', evidence: [...stripeEvidence(l), ...usageEvidence(e)] };
  }
  if (l.outcome === 'stopped_at_paywall') {
    return { reason: 'stopped_at_paywall', evidence: ['Finished onboarding, no trial started', ...(l.planTried ? [`Looked at ${l.planLabel}`] : [])] };
  }
  if (l.outcome === 'abandoned_onboarding') {
    return {
      reason: 'abandoned_onboarding',
      evidence: [l.onboardingStepLabel ? `Last seen at "${l.onboardingStepLabel}"` : 'Left before the paywall', ...(l.onboardingChapterLabel ? [l.onboardingChapterLabel] : [])],
    };
  }
  if (l.outcome === 'never_opened') {
    return { reason: 'never_opened', evidence: [l.lastSignInAt ? 'Signed in, never started onboarding' : 'Never signed in after creating the account'] };
  }

  const trialEvidence = [...(l.planLabel ? [`Chose ${l.planLabel}`] : []), ...(l.daysToCancel !== null ? [`Canceled after ${l.daysToCancel} days`] : []), ...stripeEvidence(l)];

  if (l.daysToCancel !== null && l.daysToCancel < 1 && !activated(e)) {
    return { reason: 'cancel_day_one', evidence: [...trialEvidence, 'No emails, campaigns, or videos first'] };
  }
  if (!activated(e)) {
    return {
      reason: l.outcome === 'trial_expired' ? 'expired_silently' : 'never_activated',
      evidence: [...trialEvidence, e.activeDays > 0 ? `Opened the app on ${plural(e.activeDays, 'day', 'days')} but did nothing` : 'Never opened the app during the trial'],
    };
  }
  if (e.emailsSent >= powerUserEmails || l.outcome === 'paid_churned') {
    return { reason: 'power_user_left', evidence: [...trialEvidence, ...usageEvidence(e)] };
  }
  if (e.emailsSent > 0 && e.repliesReceived === 0) {
    return { reason: 'sent_no_replies', evidence: [...trialEvidence, ...usageEvidence(e)] };
  }
  if ((e.daysSilentBeforeEnd ?? 0) >= SILENT_DAYS) {
    return { reason: 'went_silent', evidence: [...trialEvidence, `Quiet for ${plural(e.daysSilentBeforeEnd ?? 0, 'day', 'days')} before the end`, ...usageEvidence(e)] };
  }
  if (l.outcome === 'trial_expired') {
    return { reason: 'expired_silently', evidence: [...trialEvidence, ...usageEvidence(e)] };
  }
  return { reason: 'went_silent', evidence: [...trialEvidence, ...usageEvidence(e)] };
}
