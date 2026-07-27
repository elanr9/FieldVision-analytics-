export type UserStatus =
  | 'paying'
  | 'comped'
  | 'trialing'
  | 'trial_ended'
  | 'signed_up'
  | 'churned';

export type PlanInterval = 'monthly' | 'annual' | 'lifetime' | 'unknown';

/** Where a not-yet-paying user sits in the sales pipeline */
export type PipelineStage =
  | 'trial_ending_soon'
  | 'trial_lost'
  | 'stopped_at_paywall'
  | 'churned'
  | 'in_onboarding'
  | 'never_onboarded';

/** Raw row from user_profiles */
export interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  notification_email: string | null;
  phone_number: string | null;
  current_team: string | null;
  graduation_year: number | null;
  positions: string[] | null;
  created_at: string;
  trial_started_at: string | null;
  account_type: string;
  is_demo: boolean;
  is_ambassador: boolean;
  is_admin: boolean;
}

/** Raw row from user_subscriptions */
export interface SubscriptionRow {
  user_id: string;
  plan: string;
  payment_type: string | null;
  stripe_subscription_id: string | null;
  amount_cents: number | null;
  paid_at: string | null;
}

/** Raw row from user_onboarding_intake, only the fields we need */
export interface IntakeRow {
  user_id: string;
  completed: boolean;
  current_step_index: number;
  phone_number: string | null;
  club_team: string | null;
  position: string | null;
  grad_year: number | null;
  parent_first_name: string | null;
}

/** One fully classified user, safe to send to the client */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  team: string | null;
  position: string | null;
  gradYear: number | null;
  parentName: string | null;
  parentEmail: string | null;
  signupDate: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  paidAt: string | null;
  paymentType: string | null;
  status: UserStatus;
  interval: PlanInterval;
  isParent: boolean;
  /** True for demo, ambassador, and admin accounts. Excluded from all metrics. */
  excludedFromMetrics: boolean;
  onboarding: 'none' | 'in_progress' | 'completed';
  onboardingStepIndex: number | null;
  /** Set for real, non-parent users who are not currently paying */
  pipeline: PipelineStage | null;
}

export const STATUS_LABEL: Record<UserStatus, string> = {
  paying: 'Paying',
  comped: 'Comped',
  trialing: 'Trialing',
  trial_ended: 'Trial ended',
  signed_up: 'Signed up',
  churned: 'Churned',
};

export const PIPELINE_META: Record<
  PipelineStage,
  { title: string; hint: string; accent: string }
> = {
  trial_ending_soon: {
    title: 'Trial ending soon',
    hint: 'Trial ends within 48 hours. Reach out before the card charges or they cancel.',
    accent: 'bg-sky-500',
  },
  trial_lost: {
    title: 'Trial expired, never paid',
    hint: 'Finished a trial but the card never charged or they canceled. Best win-back list.',
    accent: 'bg-amber-500',
  },
  stopped_at_paywall: {
    title: 'Stopped at paywall',
    hint: 'Finished onboarding but never started a trial. One nudge away.',
    accent: 'bg-violet-500',
  },
  churned: {
    title: 'Churned',
    hint: 'Paid at some point, then canceled. Ask why and offer a comeback deal.',
    accent: 'bg-red-500',
  },
  in_onboarding: {
    title: 'Stuck in onboarding',
    hint: 'Started onboarding but never finished it.',
    accent: 'bg-neutral-400',
  },
  never_onboarded: {
    title: 'Never started onboarding',
    hint: 'Created an account and did nothing else.',
    accent: 'bg-neutral-300',
  },
};

export const PIPELINE_ORDER: PipelineStage[] = [
  'trial_ending_soon',
  'trial_lost',
  'stopped_at_paywall',
  'churned',
  'in_onboarding',
  'never_onboarded',
];
