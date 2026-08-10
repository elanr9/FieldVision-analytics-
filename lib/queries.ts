import { createClient } from '@supabase/supabase-js';
import { classifyUser, pipelineStage, TRIAL_MS } from './classify';
import { normalizePhone } from './contact';
import { resolveFromIntake } from './onboarding-resolve';
import type { IntakeRow, ProfileRow, SubscriptionRow, UserRecord } from './types';

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

  const [profilesRes, subsRes, intakeRes, parentRes, authRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select(
        'user_id, full_name, email, notification_email, phone_number, current_team, graduation_year, positions, created_at, trial_started_at, account_type, is_demo, is_ambassador, is_admin',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('user_subscriptions')
      .select('user_id, plan, payment_type, stripe_subscription_id, amount_cents, paid_at'),
    supabase
      .from('user_onboarding_intake')
      .select(
        'user_id, completed, current_step_index, phone_number, club_team, position, grad_year, parent_first_name, education_level, has_emailed_coaches, league_level, pro_aspiration, parent_invite_choice',
      ),
    supabase.from('parent_invites').select('player_user_id, parent_email'),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
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
  if (!authRes.error) {
    for (const u of authRes.data.users) {
      if (u.email) authEmailByUser.set(u.id, u.email);
    }
  }

  const now = new Date();

  return profiles.map(profile => {
    const sub = subByUser.get(profile.user_id);
    const intake = intakeByUser.get(profile.user_id);
    const c = classifyUser(profile, sub, now);

    const isParent = profile.account_type === 'parent';
    const onboarding: UserRecord['onboarding'] = !intake
      ? 'none'
      : intake.completed
        ? 'completed'
        : 'in_progress';

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
      name: profile.full_name ?? 'Unknown',
      email:
        authEmailByUser.get(profile.user_id) ??
        profile.email ??
        profile.notification_email ??
        '',
      phone: normalizePhone(profile.phone_number ?? intake?.phone_number ?? null),
      team: profile.current_team ?? intake?.club_team ?? null,
      position: profile.positions?.[0] ?? intake?.position ?? null,
      gradYear: profile.graduation_year ?? intake?.grad_year ?? null,
      parentName: intake?.parent_first_name ?? null,
      parentEmail: parentEmailByUser.get(profile.user_id) ?? null,
      signupDate: profile.created_at,
      trialStartedAt: profile.trial_started_at,
      trialEndsAt,
      paidAt: c.status === 'paying' || c.status === 'churned' ? sub?.paid_at ?? null : null,
      paymentType: sub?.payment_type ?? null,
      status: c.status,
      interval: c.interval,
      isParent,
      excludedFromMetrics: c.excludedFromMetrics,
      onboarding,
      onboardingStepIndex: intake?.current_step_index ?? null,
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
