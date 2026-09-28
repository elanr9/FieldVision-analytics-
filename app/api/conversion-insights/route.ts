import { NextResponse } from 'next/server';
import { generateChurnInsights, openaiConfigured } from '@/lib/conversion/ai';
import { loadCachedConversion, loadContext, parseRange } from '@/lib/conversion/server-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Protected by the password middleware like every other route. ?range=30|90|all, ?refresh=1 to skip caches. */
export async function GET(request: Request) {
  if (!openaiConfigured()) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 503 });
  }
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === '1';
  let parsed: ReturnType<typeof parseRange>;
  try {
    parsed = parseRange(url.searchParams.get('range'));
  } catch {
    return NextResponse.json({ error: 'Bad range' }, { status: 400 });
  }
  try {
    const { users, data } = await loadCachedConversion(refresh);
    const context = await loadContext(users, parsed.days);
    const insights = await generateChurnInsights(data, parsed.range, refresh, context);
    return NextResponse.json(insights);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
