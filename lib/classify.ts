import type {
  PipelineStage,
  PlanInterval,
  ProfileRow,
  SubscriptionRow,
  UserStatus,
} from './types';

/** Trial length used by the live app (useSubscription.ts), 7 days */
export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/** payment_type values that mean lifetime access. monthly_499 is legacy naming for the lifetime price. */
const LIFETIME_PAYMENT_TYPES = ['lifetime_499', 'monthly_499', 'lifetime_trial'];

export function planInterval(paymentType: string | null): PlanInterval {
  if (!paymentType) return 'unknown';
  if (LIFETIME_PAYMENT_TYPES.includes(paymentType)) return 'lifetime';
  if (paymentType.startsWith('monthly')) return 'monthly';
  if (paymentType.startsWith('yearly')) return 'annual';
  return 'unknown';
}

export function trialActive(trialStartedAt: string | null, now: Date): boolean {
  if (!trialStartedAt) return false;
  return now.getTime() < new Date(trialStartedAt).getTime() + TRIAL_MS;
}

export interface Classification {
  status: UserStatus;
  interval: PlanInterval;
  excludedFromMetrics: boolean;
}

/**
 * Single source of truth for what counts as a real paying customer.
 *
 * Rules, in order:
 * 1. Demo, ambassador, and admin accounts are comped and excluded from all
 *    metrics regardless of their plan.
 * 2. A full plan with no Stripe subscription and no recorded charge was
 *    granted manually or through a 100 percent off coupon: comped.
 * 3. A full plan inside the 7 day trial window with no charge yet: trialing.
 * 4. Any other full plan: paying. If the trial window passed and Stripe did
 *    not revoke access, the card was charged (the webhook downgrades the plan
 *    on payment failure or cancellation).
 * 5. No full plan: churned if they paid before being canceled, trial ended if
 *    a trial lapsed without converting, signed up otherwise.
 */
export function classifyUser(
  profile: ProfileRow,
  sub: SubscriptionRow | undefined,
  now: Date = new Date(),
): Classification {
  const flagged = profile.is_demo || profile.is_ambassador || profile.is_admin;
  const interval = planInterval(sub?.payment_type ?? null);

  if (flagged) {
    return { status: 'comped', interval, excludedFromMetrics: true };
  }

  const hasFullPlan = sub?.plan === 'full';
  const hasCharge = (sub?.amount_cents ?? 0) > 0;
  const inTrialWindow = trialActive(profile.trial_started_at, now);

  if (hasFullPlan) {
    if (!sub?.stripe_subscription_id && !hasCharge) {
      return { status: 'comped', interval, excludedFromMetrics: false };
    }
    if (inTrialWindow && !hasCharge) {
      return { status: 'trialing', interval, excludedFromMetrics: false };
    }
    return { status: 'paying', interval, excludedFromMetrics: false };
  }

  if (sub?.payment_type === 'canceled' && sub.paid_at) {
    return { status: 'churned', interval, excludedFromMetrics: false };
  }
  if (sub?.payment_type === 'trial_expired') {
    return { status: 'trial_ended', interval, excludedFromMetrics: false };
  }
  if (inTrialWindow) {
    return { status: 'trialing', interval, excludedFromMetrics: false };
  }
  if (profile.trial_started_at) {
    return { status: 'trial_ended', interval, excludedFromMetrics: false };
  }
  return { status: 'signed_up', interval, excludedFromMetrics: false };
}

/**
 * Sales pipeline stage for real, non-parent users who are not paying yet.
 * Ordered by how actionable the outreach is.
 */
export function pipelineStage(
  status: UserStatus,
  onboarding: 'none' | 'in_progress' | 'completed',
  trialEndsAt: string | null,
  isParent: boolean,
  excludedFromMetrics: boolean,
  now: Date = new Date(),
): PipelineStage | null {
  if (excludedFromMetrics || isParent) return null;
  if (status === 'paying' || status === 'comped') return null;

  if (status === 'trialing' && trialEndsAt) {
    const hoursLeft = (new Date(trialEndsAt).getTime() - now.getTime()) / 3600000;
    if (hoursLeft <= 48) return 'trial_ending_soon';
    return null;
  }
  if (status === 'trial_ended') return 'trial_lost';
  if (status === 'churned') return 'churned';
  if (status === 'signed_up') {
    if (onboarding === 'completed') return 'stopped_at_paywall';
    if (onboarding === 'in_progress') return 'in_onboarding';
    return 'never_onboarded';
  }
  return null;
}
