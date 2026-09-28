import { NextResponse } from 'next/server';
import { generateChurnInsights, openaiConfigured } from '@/lib/conversion/ai';
import { loadConversionData } from '@/lib/conversion/load';
import type { ConversionData } from '@/lib/conversion/report';
import { loadFunnel, loadPaywall, rangeForDays } from '@/lib/funnel';
import { loadUsers } from '@/lib/queries';
import type { UserRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATA_TTL_MS = 10 * 60 * 1000;
/** Onboarding screens are only tracked since August, so "all time" still reads the last year of events. */
const ALL_TIME_DAYS = 365;

interface Loaded {
  users: UserRecord[];
  data: ConversionData;
}

let dataCache: { at: number; promise: Promise<Loaded> } | null = null;

/** The conversion data is slow to build, so share one copy across requests for ten minutes. */
function cachedData(refresh: boolean): Promise<Loaded> {
  if (!refresh && dataCache && Date.now() - dataCache.at < DATA_TTL_MS) return dataCache.promise;
  const promise = loadUsers().then(async users => ({ users, data: await loadConversionData(users) }));
  dataCache = { at: Date.now(), promise };
  promise.catch(() => {
    dataCache = null;
  });
  return promise;
}

/** Protected by the password middleware like every other route. ?range=30|90|all, ?refresh=1 to skip caches. */
export async function GET(request: Request) {
  if (!openaiConfigured()) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 503 });
  }
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get('range') ?? 'all';
  const refresh = url.searchParams.get('refresh') === '1';
  const range = rangeParam === 'all' ? null : rangeForDays(Number(rangeParam));
  if (range && !Number.isFinite(range.from.getTime())) {
    return NextResponse.json({ error: 'Bad range' }, { status: 400 });
  }
  try {
    const { users, data } = await cachedData(refresh);
    const days = range ? Number(rangeParam) : ALL_TIME_DAYS;
    const [funnel, paywall] = await Promise.all([
      loadFunnel(days, users).catch(() => undefined),
      loadPaywall(days, users).catch(() => undefined),
    ]);
    const insights = await generateChurnInsights(data, range, refresh, { funnel, paywall });
    return NextResponse.json(insights);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
