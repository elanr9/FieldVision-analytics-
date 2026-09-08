import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToAll } from '../../../lib/apns';

interface ProfileRecord {
  user_id?: string;
  full_name?: string | null;
  email?: string | null;
  notification_email?: string | null;
}

interface SubscriptionRecord {
  user_id?: string;
  plan?: string | null;
  payment_type?: string | null;
  amount_cents?: number | null;
  paid_at?: string | null;
}

interface FounderCallRecord {
  user_id?: string;
  scheduled_at?: string | null;
}

type EventRecord = ProfileRecord & SubscriptionRecord & FounderCallRecord;

interface WebhookPayload {
  table: string;
  op: 'INSERT' | 'UPDATE';
  record: EventRecord;
  old_record: EventRecord | null;
}

function dollars(cents: number | null | undefined): string {
  if (!cents) return '';
  return ` $${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

/** "Tue, Sep 9 at 4:30 PM ET" for a stored ISO timestamp. */
function callTime(iso: string | null | undefined): string {
  if (!iso) return 'an unknown time';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'an unknown time';
  const day = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${day} at ${time} ET`;
}

async function lookupName(userId: string | undefined): Promise<string> {
  if (!userId) return 'A user';
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'A user';
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from('user_profiles')
    .select('full_name, email')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.full_name ?? data?.email ?? 'A user';
}

/**
 * Receives database events from Supabase triggers and turns them into
 * push notifications. Exempt from the cookie middleware; authenticated by
 * a shared secret header set inside the trigger function.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || request.headers.get('x-notify-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  const { table, op, record, old_record: oldRecord } = payload;

  let title = '';
  let body = '';
  let userId = record.user_id ?? '';
  let eventType = '';

  if (table === 'user_profiles' && op === 'INSERT') {
    const name = record.full_name ?? 'Someone';
    const email = record.email ?? record.notification_email ?? '';
    title = 'New signup';
    body = email ? `${name} (${email}) just created an account` : `${name} just created an account`;
    userId = record.user_id ?? '';
    eventType = 'signup';
  } else if (table === 'user_profiles' && op === 'UPDATE') {
    const name = record.full_name ?? 'Someone';
    title = 'Trial started';
    body = `${name} just started their 7 day trial`;
    userId = record.user_id ?? '';
    eventType = 'trial';
  } else if (table === 'founder_calls' && op === 'INSERT') {
    const name = await lookupName(record.user_id);
    title = 'Call booked';
    body = `${name} booked a call with you for ${callTime(record.scheduled_at)}`;
    eventType = 'call';
  } else if (table === 'user_subscriptions') {
    // Trial checkouts write plan=full + paid_at with amount_cents=0.
    // Those are not payments — trial_started_at already covers the alert.
    if ((record.amount_cents ?? 0) <= 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_charge' });
    }

    const name = await lookupName(record.user_id);
    const plan = record.plan ?? 'unknown plan';
    const paidChanged =
      op === 'INSERT'
        ? Boolean(record.paid_at)
        : record.paid_at !== oldRecord?.paid_at && Boolean(record.paid_at);

    if (paidChanged) {
      title = 'New payment';
      body = `${name} paid${dollars(record.amount_cents)} on the ${plan} plan`;
      eventType = 'payment';
    } else if (op === 'INSERT') {
      title = 'New subscription';
      body = `${name} is now on the ${plan} plan`;
      eventType = 'subscription';
    } else if (record.plan !== oldRecord?.plan) {
      title = 'Plan changed';
      body = `${name} moved from ${oldRecord?.plan ?? 'unknown'} to ${plan}`;
      eventType = 'plan_change';
    } else {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_meaningful_change' });
    }
  } else {
    return NextResponse.json({ ok: true, skipped: true, reason: 'unhandled_event' });
  }

  const data: Record<string, string> = { eventType };
  if (userId) data.userId = userId;

  try {
    await sendPushToAll(title, body, data);
  } catch (err) {
    console.error('Push send failed', err);
    return NextResponse.json({ error: 'Push send failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
