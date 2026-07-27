export type UserStatus =
  | 'paying'
  | 'comped'
  | 'trialing'
  | 'trial_ended'
  | 'signed_up'
  | 'churned';

export type PlanInterval = 'monthly' | 'annual' | 'lifetime' | 'unknown';

/** Raw row from user_profiles */
export interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  notification_email: string | null;
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

/** One fully classified user, safe to send to the client */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  signupDate: string;
  trialStartedAt: string | null;
  paidAt: string | null;
  status: UserStatus;
  interval: PlanInterval;
  isParent: boolean;
  /** True for demo, ambassador, and admin accounts. Excluded from all metrics. */
  excludedFromMetrics: boolean;
}

export const STATUS_LABEL: Record<UserStatus, string> = {
  paying: 'Paying',
  comped: 'Comped',
  trialing: 'Trialing',
  trial_ended: 'Trial ended',
  signed_up: 'Signed up',
  churned: 'Churned',
};
