import { NextResponse } from 'next/server';
import { generateSummary } from '@/lib/ai-summary';
import type { UserRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Protected by the password middleware like every other route. */
export async function POST(request: Request) {
  const body = (await request.json()) as { user?: UserRecord };
  if (!body.user?.id) {
    return NextResponse.json({ error: 'Missing user' }, { status: 400 });
  }
  const result = await generateSummary(body.user);
  return NextResponse.json(result);
}
