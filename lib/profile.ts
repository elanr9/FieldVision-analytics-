import type { PlanInterval, UserRecord } from './types';
import type { DossierBackground, UserDossier } from './user-dossier';

export type BackgroundChapterKey = 'basic' | 'checkin' | 'academic' | 'athletic' | 'goals';

export interface BackgroundChapter {
  key: BackgroundChapterKey;
  label: string;
  rows: [string, string][];
}

export interface ProfileVideo {
  id: string;
  title: string;
  createdAt: string;
  /** "Published" when a YouTube link exists, otherwise the raw project status in sentence case */
  status: string;
  published: boolean;
  uniqueCoaches: number;
  coachViews: number;
}

export interface ProfileReply {
  id: string;
  school: string;
  coach: string;
  subject: string | null;
  /** When the athlete's outreach email went out, if the dossier still has that email */
  sentAt: string | null;
  repliedAt: string;
  snippet: string;
}

export interface Profile {
  planLabel: string;
  planFact: [string, string];
  facts: string;
  checkinEligible: boolean;
  lastCheckin: string;
  stats: { emails: number; replies: number; views: number; calls: number };
  videos: ProfileVideo[];
  replies: ProfileReply[];
  background: BackgroundChapter[];
}

export interface ThreadMessage {
  from: 'athlete' | 'coach';
  text: string;
  at: string | null;
}

const MISSING = '—';
const DAY_MS = 24 * 60 * 60 * 1000;

/** "Sep 10", or "Sep 10, 2027" when the date falls outside the current year */
export function formatShortDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const year = d.getFullYear() === now.getFullYear() ? undefined : 'numeric';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year });
}

function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** "today" | "yesterday" | "3d ago" for a past date */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const days = calendarDaysBetween(new Date(iso), now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

/** "in 14h" under two days, otherwise "in 6d" */
function formatUntil(iso: string, now: Date): string {
  const hours = Math.max(1, Math.ceil((new Date(iso).getTime() - now.getTime()) / 3600000));
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.ceil(hours / 24)}d`;
}

function sentenceCase(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function gradShort(gradYear: number | null): string | null {
  return gradYear ? `'${String(gradYear).slice(-2)}` : null;
}

/**
 * Human plan name. The amount only lives inside Stripe's payment_type slug
 * (monthly_29_99, yearly_240_trial, lifetime_499), so it is parsed from there.
 */
/** Live Inkbound prices per Stripe payment_type. */
const INKBOUND_PLAN_LABELS: Record<string, string> = {
  inkbound_semester: '$120 semester',
  inkbound_offer: '$60 semester',
  inkbound_monthly: '$40 monthly',
  inkbound_quarterly: '$60 quarterly',
  inkbound_weekly: '$10 weekly',
};

export function planLabel(paymentType: string | null, interval: PlanInterval): string {
  if (paymentType && INKBOUND_PLAN_LABELS[paymentType]) return INKBOUND_PLAN_LABELS[paymentType];
  const priced = paymentType?.match(/^(?:monthly|yearly|lifetime)_(\d+)(?:_(\d{1,2}))?/);
  if (priced) {
    const dollars = Math.round(Number(priced[1]) + (priced[2] ? Number(`0.${priced[2]}`) : 0));
    const word = interval === 'unknown' ? 'plan' : interval;
    return `$${dollars} ${word}`;
  }
  if (interval !== 'unknown') return sentenceCase(interval);
  return 'Full plan';
}

function nextChargeLine(user: UserRecord, now: Date): string {
  if (user.interval === 'lifetime') return 'No renewal';
  if (!user.paidAt) return MISSING;
  if (user.interval === 'unknown') return `Paid ${formatShortDay(user.paidAt, now)}`;
  const next = new Date(user.paidAt);
  while (next.getTime() <= now.getTime()) {
    if (user.interval === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1);
  }
  return `Next charge ${formatShortDay(next.toISOString(), now)}`;
}

export function buildPlanFact(user: UserRecord, now: Date): [string, string] {
  const label = planLabel(user.paymentType, user.interval);
  switch (user.status) {
    case 'trialing':
      return [
        `${label} · trial`,
        user.trialEndsAt
          ? `Trial ends ${formatShortDay(user.trialEndsAt, now)} · ${formatUntil(user.trialEndsAt, now)}`
          : 'Trial ends soon',
      ];
    case 'paying':
      return [label, nextChargeLine(user, now)];
    case 'churned':
      // TODO(handoff-3): UserRecord has no cancellation date, so the day cannot be shown yet.
      return [`${label} · cancelled`, 'Cancelled'];
    case 'trial_ended':
      return [`${label} · trial`, user.trialEndsAt ? `Trial ended ${formatAgo(user.trialEndsAt, now)}` : 'Trial ended'];
    case 'comped':
      return ['Comped', 'No charge'];
    case 'signed_up':
      if (user.onboarding === 'in_progress') return ['No plan', `In onboarding · ${user.onboardingStepId ?? 'unknown step'}`];
      return ['No plan', user.onboarding === 'completed' ? 'Stopped at paywall' : 'Never started onboarding'];
  }
}

/** "Solar SC · CM · '27", omitting whatever is missing */
export function buildFacts(user: Pick<UserRecord, 'team' | 'position' | 'gradYear'>): string {
  return [user.team, user.position, gradShort(user.gradYear)].filter(Boolean).join(' · ');
}

function heightWeight(bg: DossierBackground): string {
  const parts: string[] = [];
  if (bg.heightIn) parts.push(`${Math.floor(bg.heightIn / 12)}'${bg.heightIn % 12}"`);
  if (bg.weightLb) parts.push(`${bg.weightLb} lb`);
  return parts.join(' · ') || MISSING;
}

function testScores(bg: DossierBackground): string {
  const parts: string[] = [];
  if (bg.satTotal) parts.push(`SAT ${bg.satTotal}`);
  if (bg.actComposite) parts.push(`ACT ${bg.actComposite}`);
  return parts.join(' · ') || MISSING;
}

/** Current grade, mirroring the mock's formula: seniors are the class graduating this school year. */
function gradeLabel(gradYear: number | null, now: Date): string {
  if (!gradYear) return MISSING;
  const seniorClass = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const grade = 12 - (gradYear - seniorClass);
  if (grade > 12) return 'Graduated';
  if (grade < 1) return MISSING;
  const suffix = grade === 1 ? 'st' : grade === 2 ? 'nd' : grade === 3 ? 'rd' : 'th';
  return `${grade}${suffix}`;
}

function text(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return MISSING;
  return String(value);
}

function list(values: string[]): string {
  return values.length ? values.join(' · ') : MISSING;
}

/**
 * Five chapters, labels and order copied from the mock. Values come only from
 * DossierBackground and UserRecord; anything the dossier does not load is "—".
 */
export function buildBackground(user: UserRecord, bg: DossierBackground | null, now: Date): BackgroundChapter[] {
  const hometown = bg ? [bg.homeCity, bg.homeState].filter(Boolean).join(', ') : '';
  const contacted = bg?.schoolsContactedCount;
  return [
    {
      key: 'basic',
      label: 'Your background',
      rows: [
        ['Name', user.name],
        ['Account', user.isParent ? 'Parent' : 'Athlete'],
        ['Program', MISSING],
        ['Motivation', MISSING],
        ['Why college soccer', MISSING],
        ['Other services used', MISSING],
        ['Heard about us', MISSING],
        ['Phone', text(user.phone)],
        ['Birthday', MISSING],
        ['Hometown', text(hometown)],
      ],
    },
    {
      key: 'checkin',
      label: "Where you're at",
      rows: [
        ['Recruiting status', bg?.recruitingStartStatus ? sentenceCase(bg.recruitingStartStatus) : MISSING],
        ['Knows next step', MISSING],
        ['Emailed coaches', contacted == null ? MISSING : contacted > 0 ? 'Yes' : 'No'],
        ['Coaches emailed', text(contacted)],
        ['Biggest email blocker', MISSING],
        ['Highlight videos', MISSING],
        ['Biggest video blocker', MISSING],
        ['Time per week', MISSING],
        ['How recruiting feels', MISSING],
      ],
    },
    {
      key: 'academic',
      label: 'Your academics',
      rows: [
        ['Level', MISSING],
        ['School', text(bg?.highSchool)],
        ['Grade next year', gradeLabel(user.gradYear ?? bg?.gradYear ?? null, now)],
        ['GPA', text(bg?.gpaUnweighted ?? bg?.gpaWeighted)],
        ['SAT / ACT', bg ? testScores(bg) : MISSING],
        ['Wants to study', list(bg?.intendedMajors ?? [])],
      ],
    },
    {
      key: 'athletic',
      label: 'Your game',
      rows: [
        ['Height · weight', bg ? heightWeight(bg) : MISSING],
        ['Strongest foot', bg?.dominantFoot ? sentenceCase(bg.dominantFoot) : MISSING],
        ['Position', text(user.position ?? bg?.position)],
        ['Youth league', text(bg?.leagueLevel)],
        ['Club team', text(user.team ?? bg?.clubTeam)],
      ],
    },
    {
      key: 'goals',
      label: 'Your goals',
      rows: [
        ['Regions', list(bg?.preferredStates ?? [])],
        ['School size', MISSING],
        ['Setting', MISSING],
        ['Top 3 priorities', MISSING],
        ['Going pro?', MISSING],
        ['Community College path', MISSING],
        ['Parent invited', user.parentEmail ? 'Yes' : 'No'],
      ],
    },
  ];
}

export function buildProfile(user: UserRecord, dossier: UserDossier | null, now: Date = new Date(), lastCheckinAt: string | null = null): Profile {
  const sentAtById = new Map((dossier?.recentEmails ?? []).map(e => [e.id, e.sentAt]));
  const checkinEligible = (user.status === 'paying' || user.status === 'trialing') && Boolean(user.phone);
  return {
    planLabel: planLabel(user.paymentType, user.interval),
    planFact: buildPlanFact(user, now),
    facts: buildFacts(user),
    checkinEligible,
    lastCheckin: lastCheckinAt ? formatAgo(lastCheckinAt, now) : 'never',
    stats: {
      emails: dossier?.stats.emailsSent ?? 0,
      replies: dossier?.stats.replies ?? 0,
      views: dossier?.videos.reduce((sum, v) => sum + v.coachViews, 0) ?? 0,
      calls: dossier?.stats.callsBooked ?? 0,
    },
    videos: (dossier?.videos ?? []).map(v => {
      const published = Boolean(v.youtubeUrl);
      return {
        id: v.id,
        title: v.title,
        createdAt: v.createdAt,
        status: published ? 'Published' : sentenceCase(v.status),
        published,
        uniqueCoaches: v.uniqueCoaches,
        coachViews: v.coachViews,
      };
    }),
    replies: (dossier?.replies ?? []).map(r => ({
      id: r.id,
      school: r.schoolName ?? 'Unknown school',
      coach: r.coachName ?? r.coachEmail ?? 'Coach',
      subject: r.subject,
      sentAt: sentAtById.get(r.id) ?? null,
      repliedAt: r.repliedAt,
      snippet: r.preview ?? r.subject ?? '',
    })),
    background: buildBackground(user, dossier?.background ?? null, now),
  };
}

/** The athlete's outreach email followed by the coach's reply, oldest first. */
export function buildThread(reply: ProfileReply): ThreadMessage[] {
  // TODO(handoff-3): store outreach body. Only the subject is available, so it stands in for the sent email.
  return [
    { from: 'athlete', text: reply.subject ?? '(no subject)', at: reply.sentAt },
    { from: 'coach', text: reply.snippet, at: reply.repliedAt },
  ];
}
