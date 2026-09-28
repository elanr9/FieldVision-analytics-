import { NextResponse } from 'next/server';
import { cachedInsights, insightsKey, openaiConfigured, streamAgentReply, type AgentMessage } from '@/lib/conversion/ai';
import { loadCachedBriefing, parseRange } from '@/lib/conversion/server-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 8000;

function validMessages(input: unknown): AgentMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: AgentMessage[] = [];
  for (const m of input as { role?: unknown; content?: unknown }[]) {
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    out.push({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) });
  }
  return out[out.length - 1].role === 'user' ? out : null;
}

/** Streams plain text. Protected by the password middleware like every other route. */
export async function POST(request: Request) {
  if (!openaiConfigured()) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 503 });
  }
  const body = (await request.json()) as { messages?: unknown; range?: string };
  const messages = validMessages(body.messages);
  if (!messages) {
    return NextResponse.json({ error: 'Messages must alternate and end with a user message' }, { status: 400 });
  }
  try {
    const { range, key } = parseRange(body.range ?? 'all');
    const briefing = await loadCachedBriefing(key);
    const stream = await streamAgentReply(messages, briefing, cachedInsights(insightsKey(range)));
    return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
