import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendPushToAll } from '@/lib/apns';
import {
  buildNotificationCopy,
  pronounFromSport,
  recordEvent,
  type NotificationType,
  type NotificationVars,
  type Pronoun,
} from '@/lib/notifications';

type Json = string | number | boolean | null | undefined;
type Row = Record<string, Json>;

interface WebhookPayload {
  table: string;
  op: 'INSERT' | 'UPDATE';
  record: Row;
  old_record: Row | null;
}

/** One founder-facing event resolved from a database change. */
interface FounderEvent {
  type: NotificationType;
  userId: string;
  vars: NotificationVars;
  /** Skip when the same type was recorded for this user within this many minutes. */
  dedupeMinutes?: number;
}

const PAYWALL_SCREENS = new Set(['s37_paywall', 's37c_spin_wheel', 's38_one_time_offer']);

/** Plan label per Stripe payment_type. Prices from the live Inkbound product. */
const PLAN_LABELS: Record<string, string> = {
  inkbound_semester: '$120 semester',
  inkbound_offer: '$60 semester',
  inkbound_monthly: '$40 monthly',
  inkbound_quarterly: '$60 quarterly',
  inkbound_weekly: '$10 weekly',
  monthly_29_99: '$30 monthly',
  yearly_240_trial: '$240 yearly',
  lifetime_499: '$499 lifetime',
};

function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function str(value: Json): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function num(value: Json): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function planLabel(paymentType: Json): string | null {
  const key = str(paymentType);
  if (!key) return null;
  return PLAN_LABELS[key] ?? key.replace(/^inkbound_/, '').replace(/_/g, ' ');
}

/** "Thu 4:30pm" in Eastern time. */
function callSlot(iso: Json): string | null {
  const s = str(iso);
  if (!s) return null;
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  const time = date
    .toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
    .replace(' ', '')
    .toLowerCase();
  return `${day} ${time}`;
}

function daysBetween(fromIso: string | null, to: Date): number {
  if (!fromIso) return 0;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/** soccer_programs.division -> short label: "NCAA D1" -> "D1", "Junior College" -> "JUCO". */
function divisionLabel(division: string | null): string | null {
  if (!division) return null;
  if (division === 'Junior College') return 'JUCO';
  return division.replace(/^NCAA\s+/, '');
}

/** Division of the school's program for the athlete's sport; falls back to any program at the school. */
async function schoolDivision(supabase: SupabaseClient, schoolId: string, userId: string): Promise<string | null> {
  const [programs, intake] = await Promise.all([
    supabase.from('soccer_programs').select('gender, division').eq('school_id', schoolId),
    supabase.from('user_onboarding_intake').select('sport').eq('user_id', userId).maybeSingle(),
  ]);
  const rows = (programs.data ?? []) as { gender: string | null; division: string | null }[];
  const sport = ((intake.data as { sport: string | null } | null)?.sport ?? '').toLowerCase();
  const gender = sport.startsWith('women') ? 'womens' : sport.startsWith('men') ? 'mens' : null;
  const match = rows.find(r => r.gender === gender) ?? rows[0];
  return divisionLabel(match?.division ?? null);
}

async function onboardingFinishedDaysAgo(supabase: SupabaseClient, userId: string): Promise<number> {
  const [intake, profile] = await Promise.all([
    supabase.from('user_onboarding_intake').select('completed, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('user_profiles').select('created_at').eq('user_id', userId).maybeSingle(),
  ]);
  const intakeRow = intake.data as { completed: boolean | null; updated_at: string | null } | null;
  const profileRow = profile.data as { created_at: string | null } | null;
  const finishedAt = intakeRow?.completed ? intakeRow.updated_at : profileRow?.created_at ?? null;
  return daysBetween(finishedAt, new Date());
}

function subscriptionEvent(op: WebhookPayload['op'], record: Row, old: Row | null): FounderEvent | null {
  const userId = str(record.user_id);
  if (!userId) return null;
  const plan = str(record.plan);
  const amount = num(record.amount_cents) ?? 0;
  const label = planLabel(record.payment_type);

  if (plan === 'full') {
    const amountChanged = op === 'INSERT' || num(old?.amount_cents) !== num(record.amount_cents);
    const paidAtChanged = op === 'INSERT' || str(old?.paid_at) !== str(record.paid_at);
    if (amount > 0 && (amountChanged || paidAtChanged)) {
      return { type: 'paid', userId, vars: { amountCents: amount, plan: label }, dedupeMinutes: 10 };
    }
    const becameFull = op === 'INSERT' || str(old?.plan) !== 'full' || str(old?.payment_type) !== str(record.payment_type);
    if (amount <= 0 && becameFull) {
      return { type: 'trial', userId, vars: { plan: label }, dedupeMinutes: 60 * 24 };
    }
    return null;
  }

  if (plan === 'free' && str(record.payment_type) === 'canceled' && str(old?.plan) === 'full') {
    return { type: 'cancel', userId, vars: { plan: planLabel(old?.payment_type) }, dedupeMinutes: 60 };
  }
  return null;
}

async function productEvent(supabase: SupabaseClient, record: Row): Promise<FounderEvent | null> {
  const userId = str(record.user_id);
  const name = str(record.name);
  if (!userId || !name) return null;

  if (name === 'retention_offer_accepted') {
    return { type: 'save', userId, vars: {}, dedupeMinutes: 60 };
  }
  if (name !== 'onboarding_screen_view') return null;

  const properties = (record.properties ?? null) as unknown;
  const screen = properties && typeof properties === 'object' ? str((properties as Row).screen) : null;
  if (!screen || !PAYWALL_SCREENS.has(screen)) return null;

  if (screen === 's37_paywall') {
    const n = await onboardingFinishedDaysAgo(supabase, userId);
    return { type: 'paywall', userId, vars: { n }, dedupeMinutes: 30 };
  }
  return { type: 'wheel', userId, vars: {}, dedupeMinutes: 30 };
}

async function replyEvent(supabase: SupabaseClient, record: Row): Promise<FounderEvent | null> {
  const sentEmailId = str(record.sent_email_id);
  if (!sentEmailId) return null;
  const { data } = await supabase
    .from('user_sent_emails')
    .select('user_id, school_id')
    .eq('id', sentEmailId)
    .maybeSingle();
  const sent = data as { user_id: string | null; school_id: string | null } | null;
  if (!sent?.user_id) return null;

  let school: string | null = null;
  let division: string | null = null;
  if (sent.school_id) {
    const [schoolRow, div] = await Promise.all([
      supabase.from('schools').select('name').eq('school_id', sent.school_id).maybeSingle(),
      schoolDivision(supabase, sent.school_id, sent.user_id),
    ]);
    school = (schoolRow.data as { name: string | null } | null)?.name ?? null;
    division = div;
  }
  return { type: 'reply', userId: sent.user_id, vars: { school, division } };
}

function campaignEvent(record: Row): FounderEvent | null {
  const userId = str(record.user_id);
  if (!userId) return null;
  const schools = num(record.schools_count);
  const coaches = num(record.emails_sent) ?? schools;
  return { type: 'campaign', userId, vars: { n: coaches, m: schools } };
}

function videoEvent(record: Row): FounderEvent | null {
  const userId = str(record.user_id);
  if (!userId) return null;
  return { type: 'video', userId, vars: { videoTitle: str(record.title) ?? str(record.name) }, dedupeMinutes: 10 };
}

function callEvent(record: Row): FounderEvent | null {
  const userId = str(record.user_id) ?? str(record.student_user_id);
  if (!userId) return null;
  return { type: 'call', userId, vars: { slot: callSlot(record.scheduled_at ?? record.start_at) } };
}

function upcomingCallEvent(record: Row): FounderEvent | null {
  const userId = str(record.user_id) ?? str(record.student_user_id);
  if (!userId) return null;
  return { type: 'call_soon', userId, vars: { slot: callSlot(record.scheduled_at ?? record.start_at) }, dedupeMinutes: 20 };
}

function stalledEvent(record: Row): FounderEvent | null {
  const userId = str(record.user_id);
  if (!userId) return null;
  return { type: 'stalled', userId, vars: {} };
}

async function resolveEvent(supabase: SupabaseClient, payload: WebhookPayload): Promise<FounderEvent | null> {
  const { table, op, record, old_record: old } = payload;
  switch (table) {
    case 'user_subscriptions':
      return subscriptionEvent(op, record, old);
    case 'product_events':
      return productEvent(supabase, record);
    case 'paywall_stalls':
      return stalledEvent(record);
    case 'email_replies':
      return replyEvent(supabase, record);
    case 'outreach_lists':
      return campaignEvent(record);
    case 'projects':
      return videoEvent(record);
    case 'founder_calls':
      return callEvent(record);
    case 'upcoming_calls':
      return upcomingCallEvent(record);
    default:
      return null;
  }
}

async function userContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ fullName: string | null; pronoun: Pronoun; isDemo: boolean }> {
  const [profile, intake] = await Promise.all([
    supabase.from('user_profiles').select('full_name, is_demo, is_admin').eq('user_id', userId).maybeSingle(),
    supabase.from('user_onboarding_intake').select('sport').eq('user_id', userId).maybeSingle(),
  ]);
  const row = profile.data as { full_name: string | null; is_demo: boolean | null; is_admin: boolean | null } | null;
  const sport = (intake.data as { sport: string | null } | null)?.sport ?? null;
  return {
    fullName: row?.full_name ?? null,
    pronoun: pronounFromSport(sport),
    isDemo: Boolean(row?.is_demo || row?.is_admin),
  };
}

async function recordedRecently(
  supabase: SupabaseClient,
  type: NotificationType,
  userId: string,
  minutes: number,
): Promise<boolean> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data } = await supabase
    .from('analytics_notifications')
    .select('id')
    .eq('type', type)
    .eq('user_id', userId)
    .gte('created_at', since)
    .limit(1);
  return Boolean(data && data.length > 0);
}

/**
 * Receives database events from Supabase triggers (and the paywall stall cron)
 * and turns them into founder push notifications plus Activity feed rows.
 * Exempt from the cookie middleware; authenticated by a shared secret header
 * set inside the trigger function.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || request.headers.get('x-notify-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  const supabase = admin();

  const event = await resolveEvent(supabase, payload);
  if (!event) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_a_founder_event' });
  }

  const { fullName, pronoun, isDemo } = await userContext(supabase, event.userId);
  if (isDemo) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'internal_user' });
  }
  if (event.dedupeMinutes && (await recordedRecently(supabase, event.type, event.userId, event.dedupeMinutes))) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate' });
  }

  const first = fullName?.trim().split(/\s+/)[0] || null;
  const vars: NotificationVars = { ...event.vars, first, pronoun };
  const copy = buildNotificationCopy(event.type, vars);

  try {
    await recordEvent(event.type, event.userId, vars);
  } catch (err) {
    console.error('Feed insert failed', err);
  }

  try {
    const focusCall = event.type === 'call' || event.type === 'call_soon';
    await sendPushToAll(copy.title, copy.sub ?? fullName ?? '', {
      eventType: event.type,
      userId: event.userId,
      ...(focusCall ? { focus: 'call' } : {}),
    });
  } catch (err) {
    console.error('Push send failed', err);
    return NextResponse.json({ error: 'Push send failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, type: event.type });
}
