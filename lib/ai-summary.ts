import { createClient } from '@supabase/supabase-js';
import type { UserRecord } from './types';

export interface UserActivity {
  emailsSent: number;
  firstEmailAt: string | null;
  lastEmailAt: string | null;
  emailsOpened: number;
  repliesReceived: number;
  videoProjects: number;
  videosPublished: number;
}

interface EmailRow {
  sent_at: string | null;
  created_at: string;
  opened_at: string | null;
  replied_at: string | null;
}

interface ProjectRow {
  youtube_url: string | null;
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadActivity(userId: string): Promise<UserActivity> {
  const supabase = adminClient();

  const [emailsRes, projectsRes] = await Promise.all([
    supabase
      .from('user_sent_emails')
      .select('sent_at, created_at, opened_at, replied_at')
      .eq('user_id', userId)
      .eq('status', 'sent'),
    supabase.from('projects').select('youtube_url').eq('user_id', userId),
  ]);

  const emails = (emailsRes.data ?? []) as EmailRow[];
  const projects = (projectsRes.data ?? []) as ProjectRow[];

  const sentDates = emails
    .map(e => e.sent_at ?? e.created_at)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    emailsSent: emails.length,
    firstEmailAt: sentDates[0] ?? null,
    lastEmailAt: sentDates[sentDates.length - 1] ?? null,
    emailsOpened: emails.filter(e => e.opened_at).length,
    repliesReceived: emails.filter(e => e.replied_at).length,
    videoProjects: projects.length,
    videosPublished: projects.filter(p => p.youtube_url).length,
  };
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'about a month ago' : `about ${months} months ago`;
}

/** Deterministic rundown for user activity summaries. */
export function fallbackSummary(user: UserRecord, activity: UserActivity): string {
  const parts: string[] = [];

  if (user.onboarding === 'none') {
    parts.push(`${user.name.split(' ')[0]} signed up ${ago(user.signupDate)} and never even started onboarding`);
  } else if (user.onboarding === 'in_progress') {
    const stepBit = user.onboardingStepLabel
      ? `stalled at "${user.onboardingStepLabel}" (step ${(user.onboardingStepIndex ?? 0) + 1})`
      : `stalled at onboarding step ${(user.onboardingStepIndex ?? 0) + 1}`;
    parts.push(`${user.name.split(' ')[0]} signed up ${ago(user.signupDate)} but ${stepBit}`);
  } else if (!user.trialStartedAt) {
    parts.push(
      `${user.name.split(' ')[0]} finished onboarding but stopped cold at the paywall, no trial ever started`,
    );
  } else if (user.status === 'trialing') {
    parts.push(`${user.name.split(' ')[0]} is in an active free trial right now`);
  } else if (user.status === 'trial_ended') {
    parts.push(
      `${user.name.split(' ')[0]} ran through the free trial but the card never charged`,
    );
  } else if (user.status === 'churned') {
    parts.push(`${user.name.split(' ')[0]} was a paying customer but canceled`);
  } else if (user.status === 'paying') {
    parts.push(`${user.name.split(' ')[0]} is a paying ${user.interval} subscriber`);
  } else {
    parts.push(`${user.name.split(' ')[0]} has Pro access without paying`);
  }

  if (activity.emailsSent > 0) {
    const replies =
      activity.repliesReceived > 0
        ? ` and got ${activity.repliesReceived} coach ${activity.repliesReceived === 1 ? 'reply' : 'replies'}`
        : ' but no coach replies yet';
    parts.push(
      `sent ${activity.emailsSent} coach ${activity.emailsSent === 1 ? 'email' : 'emails'} (last ${ago(activity.lastEmailAt!)})${replies}`,
    );
  } else if (user.trialStartedAt) {
    parts.push('never sent a single coach email');
  }

  const joined = parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('. ')
    .replace(/\.\./g, '.');
  return `${joined}.`;
}

const cache = new Map<string, { summary: string; at: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function generateSummary(
  user: UserRecord,
): Promise<{ summary: string; source: 'rules' }> {
  const cached = cache.get(user.id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { summary: cached.summary, source: 'rules' };
  }

  const activity = await loadActivity(user.id);
  const summary = fallbackSummary(user, activity);
  cache.set(user.id, { summary, at: Date.now() });
  return { summary, source: 'rules' };
}
