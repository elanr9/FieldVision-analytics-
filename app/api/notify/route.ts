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
  amount_cents?: number | null;
  paid_at?: string | null;
}

interface WebhookPayload {
  table: string;
  op: 'INSERT' | 'UPDATE';
  record: ProfileRecord & SubscriptionRecord;
  old_record: (ProfileRecord & SubscriptionRecord) | null;
}

function dollars(cents: number | null | undefined): string {
  if (!cents) return '';
  return ` $${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
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

  let title = 'FieldVision';
  let body = 'Something happened';

  if (table === 'user_profiles' && op === 'INSERT') {
    const name = record.full_name ?? 'Someone';
    const email = record.email ?? record.notification_email ?? '';
    title = 'New signup';
    body = email ? `${name} (${email}) just created an account` : `${name} just created an account`;
  } else if (table === 'user_profiles' && op === 'UPDATE') {
    const name = record.full_name ?? 'Someone';
    title = 'Trial started';
    body = `${name} just started their 7 day trial`;
  } else if (table === 'user_subscriptions') {
    const name = await lookupName(record.user_id);
    const plan = record.plan ?? 'unknown plan';
    const paidChanged = op === 'INSERT'
      ? Boolean(record.paid_at)
      : record.paid_at !== oldRecord?.paid_at && Boolean(record.paid_at);

    if (paidChanged) {
      title = 'New payment';
      body = `${name} paid${dollars(record.amount_cents)} on the ${plan} plan`;
    } else if (op === 'INSERT') {
      title = 'New subscription';
      body = `${name} is now on the ${plan} plan`;
    } else {
      title = 'Plan changed';
      body = `${name} moved from ${oldRecord?.plan ?? 'unknown'} to ${plan}`;
    }
  }

  try {
    await sendPushToAll(title, body);
  } catch (err) {
    console.error('Push send failed', err);
    return NextResponse.json({ error: 'Push send failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
