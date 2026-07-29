import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Registers a device token for push notifications.
 * Reached only through the authenticated dashboard (middleware enforces the
 * session cookie), so no extra auth is needed here.
 */
export async function POST(request: NextRequest) {
  const { token, platform } = (await request.json()) as {
    token?: string;
    platform?: string;
  };

  if (!token || !/^[a-f0-9]{32,200}$/i.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase
    .from('analytics_push_tokens')
    .upsert({ token, platform: platform ?? 'ios' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
