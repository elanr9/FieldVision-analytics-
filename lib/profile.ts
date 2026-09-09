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
  outreachBody: string | null;
  replyBody: string | null;
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
      return [`${label} · cancelled`, user.cancelledAt ? `Cancelled ${formatAgo(user.cancelledAt, now)}` : 'Cancelled'];
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

/** "Men's soccer" from the intake's sport field, which is stored as "Mens Soccer" or plain "soccer". */
function programLabel(sport: string | null | undefined): string {
  if (!sport) return MISSING;
  const lower = sport.toLowerCase();
  if (lower.startsWith('men')) return "Men's soccer";
  if (lower.startsWith('women')) return "Women's soccer";
  return 'Soccer';
}

/** "Mar 14, 2009" from a YYYY-MM-DD date column. */
function formatBirthday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return MISSING;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Up to four state codes, otherwise a count so the cell never overflows. */
function regionsLabel(states: string[]): string {
  if (!states.length) return MISSING;
  if (states.length > 4) return `${states.length} states`;
  return states.join(' · ');
}

/** Collapses the two wordings the intake has used for the pro question. */
function proLabel(answer: string): string {
  const lower = answer.toLowerCase();
  if (lower.includes('going pro')) return 'Yes, going pro';
  if (lower.includes('education')) return 'No, college is the goal';
  return answer;
}

/**
 * The intake stores full sentences ("I'm currently recruiting myself but it's a mess").
 * Background cells are one line wide, so each known answer maps to the short
 * phrase the mock used. Unknown answers pass through untouched.
 */
const SHORT_ANSWERS: Record<string, string> = {
  "i want to play college soccer and don't know where to start": "Don't know where to start",
  "i'm just exploring my options": 'Exploring options',
  "i'm currently recruiting myself but it's a mess": "Recruiting solo, it's a mess",
  "i'm not getting enough interest from coaches": 'Not enough coach interest',
  'keep playing my sport': 'Keep playing',
  'earn a scholarship': 'Scholarship',
  'go pro one day': 'Go pro',
  "get into schools i couldn't otherwise academically": 'Better schools',
  'i have a rough idea': 'Somewhat',
  'i have no clue': 'Not really',
  'i have no idea where to start': 'Not really',
  'i have a clear plan': 'Yes',
  'i know what to do but not the time': 'Yes, no time',
  "i don't know which coaches to email": 'Finding the right coaches',
  'writing good emails takes forever': 'Writing takes forever',
  "i don't have the time": 'Time',
  "i just don't have the time": 'Time',
  'it stresses me out': 'Stress',
  'the whole thing stresses me out': 'Stress',
  'i never hear back': 'No replies',
  'i email coaches but never hear back': 'No replies',
  'editing takes forever': 'Editing takes forever',
  'editing them takes way too long': 'Editing takes forever',
  "i don't know how to make one": 'Not sure how to make one',
  "i don't know how to edit them": 'Not sure how to edit',
  "i'm not sure how to order my video": 'Not sure how to order clips',
  "i don't have clips to work with": 'No good footage',
  'i am not sure which clips matter': 'Not sure what coaches want',
  'mine are not getting coaches to notice me': 'Coaches not noticing',
  'paying someone else is too expensive': 'Editors too expensive',
  "under 1 hour, i'm swamped": 'Under 1 hour',
  'barely any, i am swamped': 'Under 1 hour',
  '1-3 hours a week': '1–3 hours',
  'a few hours a week': '1–3 hours',
  'maybe an hour or two': '1–3 hours',
  '4-6 hours a week': '4–6 hours',
  "10+ hours, i'm grinding": '10+ hours',
  'pretty stressed': 'Stressful',
  'calm and in control': 'Under control',
  'completely overwhelmed': 'Overwhelmed',
  'scholarships / financial aid': 'Scholarship',
  'highest level possible': 'Level of play',
  'pro pathway': 'Pro pathway',
  large: 'Large (15k+)',
  small: 'Small (under 5k)',
  urban: 'City',
};

function short(answer: string | null | undefined): string {
  if (!answer) return MISSING;
  return SHORT_ANSWERS[answer.trim().toLowerCase()] ?? answer;
}

/**
 * Five chapters, labels and order copied from the mock. Values come only from
 * DossierBackground and UserRecord; anything the dossier does not load is "—".
 */
export function buildBackground(user: UserRecord, bg: DossierBackground | null, now: Date): BackgroundChapter[] {
  const hometown = bg ? [bg.homeCity, bg.homeState].filter(Boolean).join(', ') : '';
  const contacted = bg?.schoolsContactedCount;
  const emailedCoaches = bg?.hasEmailedCoaches ? sentenceCase(bg.hasEmailedCoaches) : contacted == null ? MISSING : contacted > 0 ? 'Yes' : 'No';
  return [
    {
      key: 'basic',
      label: 'Your background',
      rows: [
        ['Name', user.name],
        ['Account', user.isParent ? 'Parent' : 'Athlete'],
        ['Program', programLabel(bg?.sport)],
        ['Motivation', short(bg?.motivation)],
        ['Why college soccer', bg?.whyCollegeSoccer ? bg.whyCollegeSoccer.split(/,\s*/).map(short).join(' · ') : MISSING],
        ['Other services used', bg?.usedOtherServices ? sentenceCase(bg.usedOtherServices) : MISSING],
        ['Heard about us', bg?.heardAboutUs ? sentenceCase(bg.heardAboutUs) : MISSING],
        ['Phone', text(user.phone)],
        ['Birthday', bg?.birthday ? formatBirthday(bg.birthday) : MISSING],
        ['Hometown', text(hometown)],
      ],
    },
    {
      key: 'checkin',
      label: "Where you're at",
      rows: [
        ['Recruiting status', bg?.recruitingStartStatus ? sentenceCase(bg.recruitingStartStatus) : MISSING],
        ['Knows next step', short(bg?.recruitingClarity)],
        ['Emailed coaches', emailedCoaches],
        ['Coaches emailed', text(contacted)],
        ['Biggest email blocker', short(bg?.outreachChallenge)],
        ['Highlight videos', text(bg?.highlightVideosCount)],
        ['Biggest video blocker', short(bg?.highlightChallenge)],
        ['Time per week', short(bg?.weeklyTimeAvailable)],
        ['How recruiting feels', short(bg?.recruitingStressLevel)],
      ],
    },
    {
      key: 'academic',
      label: 'Your academics',
      rows: [
        ['Level', text(bg?.educationLevel)],
        ['School', text(bg?.educationLevel === 'College' ? bg.collegeName ?? bg.highSchool : bg?.highSchool)],
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
        ['Regions', regionsLabel(bg?.preferredStates ?? [])],
        ['School size', short(bg?.schoolSizePreference)],
        ['Setting', short(bg?.settingPreference)],
        ['Top 3 priorities', list((bg?.priorityRankings ?? []).slice(0, 3).map(short))],
        ['Going pro?', bg?.proAspiration ? proLabel(bg.proAspiration) : MISSING],
        ['Community College path', bg?.naiaJucoPathInterest ? (bg.naiaJucoPathInterest === 'Yes' ? 'Open to it' : 'No') : MISSING],
        ['Parent invited', user.parentEmail || bg?.parentInviteChoice === 'Yes' ? 'Yes' : 'No'],
      ],
    },
  ];
}

export function buildProfile(user: UserRecord, dossier: UserDossier | null, now: Date = new Date(), lastCheckinAt: string | null = null): Profile {
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
      coach: coachLabel(r.coachName, r.coachEmail),
      subject: r.subject,
      sentAt: r.sentAt,
      repliedAt: r.repliedAt,
      snippet: r.preview ?? r.subject ?? '',
      outreachBody: r.outreachBody,
      replyBody: r.replyBody,
    })),
    background: buildBackground(user, dossier?.background ?? null, now),
  };
}

/** "Coach Alvarez" from a stored coach name, falling back to the email or a generic label. */
function coachLabel(name: string | null, email: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const last = trimmed.split(/\s+/).pop() ?? trimmed;
    return `Coach ${last}`;
  }
  return email ?? 'Coach';
}

/** The athlete's outreach email followed by the coach's reply, oldest first. */
export function buildThread(reply: ProfileReply): ThreadMessage[] {
  return [
    { from: 'athlete', text: reply.outreachBody ?? reply.subject ?? '(no subject)', at: reply.sentAt },
    { from: 'coach', text: reply.replyBody ?? reply.snippet, at: reply.repliedAt },
  ];
}
