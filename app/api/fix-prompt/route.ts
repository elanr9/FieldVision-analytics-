import { NextResponse } from 'next/server';
import { generateRepoPrompt, openaiConfigured, type ChurnFix, type ChurnProblem } from '@/lib/conversion/ai';
import { loadCachedBriefing, parseRange } from '@/lib/conversion/server-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Only the aggregate half of the briefing; the prompt does not need every trial line. */
const SUMMARY_CHARS = 3000;

/** Protected by the password middleware like every other route. */
export async function POST(request: Request) {
  if (!openaiConfigured()) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 503 });
  }
  const body = (await request.json()) as { fix?: ChurnFix; problems?: ChurnProblem[]; range?: string; refresh?: boolean };
  if (!body.fix?.title) {
    return NextResponse.json({ error: 'Missing fix' }, { status: 400 });
  }
  try {
    const { key } = parseRange(body.range ?? 'all');
    const briefing = await loadCachedBriefing(key);
    const result = await generateRepoPrompt(body.fix, body.problems ?? [], briefing.slice(0, SUMMARY_CHARS), body.refresh === true);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
