import { NextResponse } from 'next/server';
import { generateCaseInsight, openaiConfigured } from '@/lib/conversion/ai';
import type { ChurnCase } from '@/lib/conversion/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Protected by the password middleware like every other route. */
export async function POST(request: Request) {
  if (!openaiConfigured()) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 503 });
  }
  const body = (await request.json()) as { item?: ChurnCase; refresh?: boolean };
  if (!body.item?.lifecycle?.userId) {
    return NextResponse.json({ error: 'Missing case' }, { status: 400 });
  }
  try {
    return NextResponse.json(await generateCaseInsight(body.item, body.refresh === true));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
