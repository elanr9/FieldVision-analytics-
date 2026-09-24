import { createClient } from '@supabase/supabase-js';
import { classifyUser, fakeReason, pipelineStage, TRIAL_MS } from './classify';
import { normalizePhone } from './contact';
import { deriveOnboardingStatus, resolveFromIntake, type FlowProgress } from './onboarding-resolve';
import type { IntakeRow, ProfileRow, SubscriptionRow, UserRecord } from './types';

/** Intake updated within this window means the user is likely still onboarding right now */
const ONBOARDING_ACTIVE_MS = 60 * 60 * 1000;

const PAGE_SIZE = 1000;
const PAYWALL_SCREEN_ID = 's37_paywall';
const ABOUT_YOU_SCREEN_ID = 's30_about_you';

interface FlowEventRow {
  user_id: string | null;
  name: string;
  properties: { screen?: unknown; fullName?: unknown } | null;
}

interface FlowEvents {
  progress: Map<string, FlowProgress>;
  /** Name typed on the about-you screen, for profiles the app has not named yet. */
  names: Map<string, string>;
}

/** What the new onboarding flow's events say about each user. */
async function loadFlowEvents(supabase: ReturnType<typeof adminClient>): Promise<FlowEvents> {
  const progress = new Map<string, FlowProgress>();
  const names = new Map<string, string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('product_events')
      .select('user_id, name, properties')
      .in('name', ['onboarding_screen_view', 'onboarding_answer'])
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as FlowEventRow[];
    for (const row of rows) {
      if (!row.user_id) continue;
      const screen = typeof row.properties?.screen === 'string' ? row.properties.screen : null;
      if (screen === PAYWALL_SCREEN_ID) progress.set(row.user_id, 'reached_paywall');
      else if (!progress.has(row.user_id)) progress.set(row.user_id, 'started');
      const fullName = row.properties?.fullName;
      if (row.name === 'onboarding_answer' && screen === ABOUT_YOU_SCREEN_ID && typeof fullName === 'string' && fullName.trim()) {
        names.set(row.user_id, fullName.trim());
      }
    }
    if (rows.length < PAGE_SIZE) return { progress, names };
  }
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

interface ParentInviteRow {
  player_user_id: string;
  parent_email: string | null;
}

/**
 * Loads every user with classification, contact info, and pipeline stage.
 * Read only.
 */
export async function loadUsers(): Promise<UserRecord[]> {
  const supabase = adminClient();

  const [profilesRes, subsRes, intakeRes, parentRes, authRes, flowEvents] = await Promise.all([
    supabase
      .from('user_profiles')
      .select(
        'user_id, full_name, email, notification_email, phone_number, current_team, graduation_year, positions, created_at, trial_started_at, account_type, is_demo, is_ambassador, is_admin',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('user_subscriptions')
      .select('user_id, plan, payment_type, stripe_subscription_id, amount_cents, paid_at, updated_at'),
    supabase
      .from('user_onboarding_intake')
      .select(
        'user_id, completed, current_step_index, updated_at, phone_number, club_team, position, grad_year, parent_first_name, education_level, has_emailed_coaches, league_level, pro_aspiration, parent_invite_choice',
      ),
    supabase.from('parent_invites').select('player_user_id, parent_email'),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    loadFlowEvents(supabase),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (subsRes.error) throw subsRes.error;
  if (intakeRes.error) throw intakeRes.error;

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const subs = (subsRes.data ?? []) as SubscriptionRow[];
  const intakes = (intakeRes.data ?? []) as IntakeRow[];
  const parentInvites = (parentRes.data ?? []) as ParentInviteRow[];

  const subByUser = new Map(subs.map(s => [s.user_id, s]));
  const intakeByUser = new Map(intakes.map(i => [i.user_id, i]));

  const parentEmailByUser = new Map<string, string>();
  for (const p of parentInvites) {
    if (p.parent_email && !parentEmailByUser.has(p.player_user_id)) {
      parentEmailByUser.set(p.player_user_id, p.parent_email);
    }
  }

  const authEmailByUser = new Map<string, string>();
  const lastSignInByUser = new Map<string, string>();
  if (!authRes.error) {
    for (const u of authRes.data.users) {
      if (u.email) authEmailByUser.set(u.id, u.email);
      if (u.last_sign_in_at) lastSignInByUser.set(u.id, u.last_sign_in_at);
    }
  }

  const now = new Date();

  const resolveEmail = (profile: ProfileRow): string =>
    authEmailByUser.get(profile.user_id) ?? profile.email ?? profile.notification_email ?? '';

  const usersPerEmail = new Map<string, number>();
  for (const profile of profiles) {
    const email = resolveEmail(profile).toLowerCase();
    if (email) usersPerEmail.set(email, (usersPerEmail.get(email) ?? 0) + 1);
  }

  return profiles.map(profile => {
    const sub = subByUser.get(profile.user_id);
    const intake = intakeByUser.get(profile.user_id);
    const c = classifyUser(profile, sub, now);

    const isParent = profile.account_type === 'parent';
    const hasFullPlan = sub?.plan === 'full';
    const onboarding = deriveOnboardingStatus(intake, profile.trial_started_at, hasFullPlan, flowEvents.progress.get(profile.user_id) ?? 'none');
    const name = profile.full_name ?? flowEvents.names.get(profile.user_id) ?? 'Unknown';
    const email = resolveEmail(profile);
    const lastSignInAt = lastSignInByUser.get(profile.user_id) ?? null;

    const trialEndsAt = profile.trial_started_at
      ? new Date(new Date(profile.trial_started_at).getTime() + TRIAL_MS).toISOString()
      : null;

    const resolved =
      onboarding === 'in_progress' && intake
        ? resolveFromIntake(
            intake.current_step_index,
            {
              education_level: intake.education_level,
              has_emailed_coaches: intake.has_emailed_coaches,
              league_level: intake.league_level,
              pro_aspiration: intake.pro_aspiration,
              parent_invite_choice: intake.parent_invite_choice,
            },
            isParent,
          )
        : null;

    return {
      id: profile.user_id,
      name,
      email,
      phone: normalizePhone(profile.phone_number ?? intake?.phone_number ?? null),
      team: profile.current_team ?? intake?.club_team ?? null,
      position: profile.positions?.[0] ?? intake?.position ?? null,
      gradYear: profile.graduation_year ?? intake?.grad_year ?? null,
      parentName: intake?.parent_first_name ?? null,
      parentEmail: parentEmailByUser.get(profile.user_id) ?? null,
      signupDate: profile.created_at,
      lastSignInAt,
      fakeReason: isParent
        ? null
        : fakeReason(
            {
              name,
              email,
              status: c.status,
              onboarding,
              lastSignInAt,
              signupDate: profile.created_at,
              emailSharedWithAnotherUser: (usersPerEmail.get(email.toLowerCase()) ?? 0) > 1,
            },
            now,
          ),
      trialStartedAt: profile.trial_started_at,
      trialEndsAt,
      paidAt: c.status === 'paying' || c.status === 'churned' ? sub?.paid_at ?? null : null,
      cancelledAt: c.status === 'churned' ? sub?.updated_at ?? null : null,
      paymentType: sub?.payment_type ?? null,
      status: c.status,
      interval: c.interval,
      isParent,
      excludedFromMetrics: c.excludedFromMetrics,
      onboarding,
      onboardingActive:
        onboarding === 'in_progress' &&
        intake?.updated_at != null &&
        now.getTime() - new Date(intake.updated_at).getTime() < ONBOARDING_ACTIVE_MS,
      onboardingStepIndex: resolved?.stepIndex ?? null,
      onboardingStepId: resolved?.stepId ?? null,
      onboardingStepLabel: resolved?.label ?? null,
      onboardingChapter: resolved?.chapter ?? null,
      onboardingChapterLabel: resolved?.chapterLabel ?? null,
      onboardingStepKind: resolved?.kind ?? null,
      onboardingTotalSteps: resolved?.totalSteps ?? null,
      pipeline: pipelineStage(
        c.status,
        onboarding,
        trialEndsAt,
        isParent,
        c.excludedFromMetrics,
        now,
      ),
    };
  });
}

export async function loadUserById(id: string): Promise<UserRecord | null> {
  return (await loadUsers()).find(u => u.id === id) ?? null;
}
