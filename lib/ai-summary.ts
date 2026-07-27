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

export function buildFactSheet(user: UserRecord, activity: UserActivity): string {
  const facts: string[] = [];
  facts.push(`Name: ${user.name}${user.isParent ? ' (parent account)' : ''}`);
  if (user.team) facts.push(`Team: ${user.team}`);
  if (user.gradYear) facts.push(`Grad year: ${user.gradYear}`);
  facts.push(`Signed up: ${ago(user.signupDate)}`);
  facts.push(
    `Onboarding: ${
      user.onboarding === 'completed'
        ? 'completed'
        : user.onboarding === 'in_progress'
          ? `stopped at step ${(user.onboardingStepIndex ?? 0) + 1}, never finished`
          : 'never started'
    }`,
  );
  if (user.trialStartedAt) {
    facts.push(`Free trial started: ${ago(user.trialStartedAt)}`);
    if (user.trialEndsAt) {
      const ended = new Date(user.trialEndsAt).getTime() < Date.now();
      facts.push(ended ? `Trial ended: ${ago(user.trialEndsAt)}` : 'Trial is still active');
    }
  } else {
    facts.push('Never started a free trial');
  }
  facts.push(`Current status: ${user.status}${user.status === 'paying' ? ` (${user.interval})` : ''}`);
  if (user.status === 'churned' && user.paidAt) facts.push(`Last payment: ${ago(user.paidAt)}`);
  if (activity.emailsSent > 0) {
    facts.push(
      `Coach outreach: sent ${activity.emailsSent} emails (first ${ago(activity.firstEmailAt!)}, last ${ago(activity.lastEmailAt!)}), ${activity.emailsOpened} opened, ${activity.repliesReceived} coach replies`,
    );
  } else {
    facts.push('Coach outreach: never sent a single email');
  }
  if (activity.videoProjects > 0) {
    facts.push(
      `Highlight videos: ${activity.videoProjects} projects, ${activity.videosPublished} published`,
    );
  } else {
    facts.push('Highlight videos: none');
  }
  return facts.join('\n');
}

/** Deterministic rundown used when OPENAI_API_KEY is not set or the API fails. */
export function fallbackSummary(user: UserRecord, activity: UserActivity): string {
  const parts: string[] = [];

  if (user.onboarding === 'none') {
    parts.push(`${user.name.split(' ')[0]} signed up ${ago(user.signupDate)} and never even started onboarding`);
  } else if (user.onboarding === 'in_progress') {
    parts.push(
      `${user.name.split(' ')[0]} signed up ${ago(user.signupDate)} but stalled at onboarding step ${(user.onboardingStepIndex ?? 0) + 1}`,
    );
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

const cache = new Map<string, { summary: string; source: 'ai' | 'rules'; at: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function generateSummary(
  user: UserRecord,
): Promise<{ summary: string; source: 'ai' | 'rules' }> {
  const cached = cache.get(user.id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { summary: cached.summary, source: cached.source };
  }

  const activity = await loadActivity(user.id);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  let summary: string;
  let source: 'ai' | 'rules';

  if (!apiKey) {
    summary = fallbackSummary(user, activity);
    source = 'rules';
  } else {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 130,
          messages: [
            {
              role: 'system',
              content:
                'You brief the founder of FieldVision, a soccer recruiting app, on one user. Write 1 to 3 short sentences in plain spoken English, like a teammate catching them up. Lead with where the user dropped off or what state they are in, then the most notable activity detail. Be specific with numbers and timing from the facts. No greetings, no bullet points, no advice unless the next step is obvious in one clause.',
            },
            {
              role: 'user',
              content: `Facts about this user:\n${buildFactSheet(user, activity)}`,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty completion');
      summary = text;
      source = 'ai';
    } catch {
      summary = fallbackSummary(user, activity);
      source = 'rules';
    }
  }

  cache.set(user.id, { summary, source, at: Date.now() });
  return { summary, source };
}
