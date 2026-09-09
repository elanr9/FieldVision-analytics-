import { NextResponse } from 'next/server';
import { loadUsage } from '@/lib/usage';

export const dynamic = 'force-dynamic';

/** Protected by the password middleware. Returns 30-day feature usage from product_events. */
export async function GET() {
  try {
    const usage = await loadUsage();
    return NextResponse.json(usage);
  } catch (err) {
    console.error('Usage load failed', err);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
